import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { initDb } from "@/lib/db"
import { parseBoundedInt } from "@/lib/http"
import { listTempMessagesForUser } from "@/lib/temp-email"

export async function GET(req: NextRequest) {
  await initDb()

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const page = parseBoundedInt(searchParams.get("page"), 1, 1, 100000)
  const limit = parseBoundedInt(searchParams.get("limit"), 20, 1, 100)
  const search = searchParams.get("search")
  const mailboxId = searchParams.get("mailboxId")

  const result = await listTempMessagesForUser(session.user.id, page, limit, { search, mailboxId })
  return NextResponse.json(result)
}
