import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db, initDb } from "@/lib/db"
import { user, shortLink } from "@/lib/schema"
import { desc, eq, sql } from "drizzle-orm"
import { headers } from "next/headers"

export async function GET() {
  await initDb()
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || (session.user as { role?: string }).role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const users = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified,
      image: user.image,
      banned: user.banned,
      banReason: user.banReason,
      banExpires: user.banExpires,
      createdAt: user.createdAt,
      linkCount: sql<number>`count(${shortLink.id})`,
    })
    .from(user)
    .leftJoin(shortLink, eq(shortLink.userId, user.id))
    .groupBy(user.id)
    .orderBy(desc(user.createdAt))

  return NextResponse.json(users)
}
