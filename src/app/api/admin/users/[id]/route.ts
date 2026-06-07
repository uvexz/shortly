import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db, initDb } from "@/lib/db"
import { session as authSession, user } from "@/lib/schema"
import { isRequestOriginAllowed } from "@/lib/http"
import { eq } from "drizzle-orm"
import { headers } from "next/headers"
import { z } from "zod"

const updateUserStatusSchema = z.object({
  banned: z.boolean(),
  banReason: z.string().trim().max(500).optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await initDb()
  const headersList = await headers()
  const session = await auth.api.getSession({ headers: headersList })
  if (!session || (session.user as { role?: string }).role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  if (!isRequestOriginAllowed(headersList)) {
    return NextResponse.json({ error: "Forbidden origin" }, { status: 403 })
  }

  const { id } = await params
  if (id === session.user.id) {
    return NextResponse.json({ error: "Cannot ban yourself" }, { status: 400 })
  }

  const rawBody = await req.json().catch(() => null)
  const parsedBody = updateUserStatusSchema.safeParse(rawBody)
  if (!parsedBody.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const existingUser = await db.select().from(user).where(eq(user.id, id)).get()
  if (!existingUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  const banReason = parsedBody.data.banned
    ? parsedBody.data.banReason?.trim() || "管理员封禁"
    : null

  const updatedUser = await db
    .update(user)
    .set({
      banned: parsedBody.data.banned,
      banReason,
      banExpires: null,
      updatedAt: new Date(),
    })
    .where(eq(user.id, id))
    .returning({
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
    })
    .get()

  if (parsedBody.data.banned) {
    await db.delete(authSession).where(eq(authSession.userId, id))
  }

  return NextResponse.json({ user: updatedUser })
}
