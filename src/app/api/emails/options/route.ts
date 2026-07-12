import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { initDb } from "@/lib/db"
import { listTempMailboxOptionsForUser } from "@/lib/temp-email"

export async function GET() {
  await initDb()

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const data = await listTempMailboxOptionsForUser(session.user.id)
  return NextResponse.json({ data })
}
