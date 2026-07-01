import { beforeAll, beforeEach, describe, expect, it, mock } from "bun:test"
import { NextRequest } from "next/server"

type RouteGet = (typeof import("./route"))["GET"]

type LinkRecord = {
  id: string
  userId: string | null
  domain: string
  slug: string
  originalUrl: string
  clicks: number
  maxClicks: number | null
  expiresAt: Date | null
  createdAt: Date
}

type AllowedShortDomain = {
  host: string
}

let GET: RouteGet

let allowedShortDomain: AllowedShortDomain | null = { host: "sho.rt" }
let selectResults: Array<LinkRecord | null> = []
let updateRunResult: { rowsAffected?: number } = { rowsAffected: 1 }
let initDbCalls = 0
let updateRunCalls = 0
let deleteCalls = 0
let logInputs: Array<Record<string, unknown>> = []
let allowedDomainInputs: Array<string | null> = []

const ACTIVE_EXPIRES_AT = new Date("2099-04-06T12:00:00.000Z")
const EXPIRED_EXPIRES_AT = new Date("2000-04-04T12:00:00.000Z")

mock.module("@/lib/db", () => ({
  initDb: async () => {
    initDbCalls += 1
  },
  db: {
    select() {
      return {
        from() {
          return {
            where() {
              return {
                get: async () => selectResults.shift() ?? null,
              }
            },
          }
        },
      }
    },
    update() {
      return {
        set() {
          return {
            where() {
              return {
                run: async () => {
                  updateRunCalls += 1
                  return updateRunResult
                },
              }
            },
          }
        },
      }
    },
    delete() {
      return {
        where: async () => {
          deleteCalls += 1
        },
      }
    },
  },
}))

mock.module("@/lib/site-domains", () => ({
  getAllowedShortDomain: async (host: string | null) => {
    allowedDomainInputs.push(host)
    return allowedShortDomain
  },
  getAllowedEmailDomain: async () => null,
  parseDomainHost: (value: string) => value,
}))

mock.module("@/lib/link-logs", () => ({
  createLinkLog: async (input: Record<string, unknown>) => {
    logInputs.push(input)
  },
}))

function createLink(overrides: Partial<LinkRecord> = {}): LinkRecord {
  return {
    id: "link_123",
    userId: "user_123",
    domain: "sho.rt",
    slug: "abc",
    originalUrl: "https://example.com/target",
    clicks: 1,
    maxClicks: null,
    expiresAt: ACTIVE_EXPIRES_AT,
    createdAt: new Date("2026-04-05T10:00:00.000Z"),
    ...overrides,
  }
}

function createRequest() {
  return new NextRequest("https://sho.rt/abc", {
    headers: {
      host: "sho.rt",
      referer: "https://ref.example/source",
      "user-agent": "TestAgent/1.0",
      "x-forwarded-for": "203.0.113.10",
    },
  })
}

async function callRoute() {
  return GET(createRequest(), { params: Promise.resolve({ slug: "abc" }) })
}

beforeAll(async () => {
  ;({ GET } = await import("./route"))
})

beforeEach(() => {
  allowedShortDomain = { host: "sho.rt" }
  selectResults = []
  updateRunResult = { rowsAffected: 1 }
  initDbCalls = 0
  updateRunCalls = 0
  deleteCalls = 0
  logInputs = []
  allowedDomainInputs = []
})

describe("short-link redirect route", () => {
  it("redirects active links and writes a success log", async () => {
    selectResults = [createLink()]

    const response = await callRoute()

    expect(response.status).toBe(302)
    expect(response.headers.get("location")).toBe("https://example.com/target")
    expect(initDbCalls).toBe(1)
    expect(updateRunCalls).toBe(1)
    expect(deleteCalls).toBe(0)
    expect(allowedDomainInputs).toEqual(["sho.rt"])
    expect(logInputs).toHaveLength(1)
    expect(logInputs[0]).toMatchObject({
      linkId: "link_123",
      linkSlug: "abc",
      ownerUserId: "user_123",
      eventType: "redirect_success",
      statusCode: 302,
      referrer: "https://ref.example/source",
      userAgent: "TestAgent/1.0",
      ipAddress: "203.0.113.10",
    })
  })

  it("blocks links expired by date without deleting them", async () => {
    selectResults = [createLink({ expiresAt: EXPIRED_EXPIRES_AT })]

    const response = await callRoute()

    expect(response.status).toBe(410)
    await expect(response.json()).resolves.toEqual({
      error: "This link has expired.",
    })
    expect(updateRunCalls).toBe(0)
    expect(deleteCalls).toBe(0)
    expect(logInputs.map((entry) => entry.eventType)).toEqual(["redirect_blocked_expired"])
    expect(logInputs[0]).toMatchObject({ statusCode: 410 })
  })

  it("blocks links that already reached the click limit without deleting them", async () => {
    selectResults = [createLink({ clicks: 5, maxClicks: 5 })]

    const response = await callRoute()

    expect(response.status).toBe(410)
    await expect(response.json()).resolves.toEqual({
      error: "This link reached the click limit.",
    })
    expect(updateRunCalls).toBe(0)
    expect(deleteCalls).toBe(0)
    expect(logInputs.map((entry) => entry.eventType)).toEqual(["redirect_blocked_max_clicks"])
  })

  it("falls back to the expired-by-date branch when the atomic update loses a race", async () => {
    selectResults = [
      createLink(),
      createLink({ expiresAt: EXPIRED_EXPIRES_AT }),
    ]
    updateRunResult = { rowsAffected: 0 }

    const response = await callRoute()

    expect(response.status).toBe(410)
    await expect(response.json()).resolves.toEqual({
      error: "This link has expired.",
    })
    expect(updateRunCalls).toBe(1)
    expect(deleteCalls).toBe(0)
    expect(logInputs.map((entry) => entry.eventType)).toEqual(["redirect_blocked_expired"])
  })

  it("falls back to the click-limit branch when the atomic update loses a race", async () => {
    selectResults = [
      createLink({ clicks: 4, maxClicks: 5 }),
      createLink({ clicks: 5, maxClicks: 5 }),
    ]
    updateRunResult = { rowsAffected: 0 }

    const response = await callRoute()

    expect(response.status).toBe(410)
    await expect(response.json()).resolves.toEqual({
      error: "This link reached the click limit.",
    })
    expect(updateRunCalls).toBe(1)
    expect(deleteCalls).toBe(0)
    expect(logInputs.map((entry) => entry.eventType)).toEqual(["redirect_blocked_max_clicks"])
  })

  it("returns gone when the link disappears after a failed update", async () => {
    selectResults = [createLink(), null]
    updateRunResult = { rowsAffected: 0 }

    const response = await callRoute()

    expect(response.status).toBe(410)
    await expect(response.json()).resolves.toEqual({
      error: "This link is no longer available.",
    })
    expect(updateRunCalls).toBe(1)
    expect(deleteCalls).toBe(0)
    expect(logInputs).toHaveLength(0)
  })
})
