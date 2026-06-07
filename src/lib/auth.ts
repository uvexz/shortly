import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { emailOTP } from "better-auth/plugins/email-otp"
import { passkey } from "@better-auth/passkey"
import { Resend } from "resend"
import { db } from "./db"
import * as schema from "./schema"
import { eq } from "drizzle-orm"
import { APIError } from "better-auth/api"

const resendApiKey = process.env.RESEND_API_KEY
const resendFrom = process.env.RESEND_FROM_EMAIL || "noreply@example.com"
const githubClientId = process.env.GITHUB_CLIENT_ID
const githubClientSecret = process.env.GITHUB_CLIENT_SECRET
const bootstrapAdminEmails = new Set(
  (process.env.BOOTSTRAP_ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
)

const plugins: Parameters<typeof betterAuth>[0]["plugins"] = [
  passkey({
    rpName: "Shortly",
  }),
]

if (resendApiKey) {
  const resend = new Resend(resendApiKey)
  plugins.push(
    emailOTP({
      async sendVerificationOTP({ email, otp }) {
        await resend.emails.send({
          from: resendFrom,
          to: email,
          subject: "Your Shortly login code",
          html: `<p>Your verification code is: <strong>${otp}</strong></p><p>This code expires in 10 minutes.</p>`,
        })
      },
      otpLength: 6,
      expiresIn: 600,
    })
  )
}

const socialProviders: Parameters<typeof betterAuth>[0]["socialProviders"] = {}

if (githubClientId && githubClientSecret) {
  socialProviders.github = {
    clientId: githubClientId,
    clientSecret: githubClientSecret,
  }
}

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET!,
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
      passkey: schema.passkey,
    },
  }),
  emailAndPassword: {
    enabled: false,
  },
  socialProviders,
  plugins,
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "user",
        input: false,
      },
      banned: {
        type: "boolean",
        defaultValue: false,
        input: false,
      },
      banReason: {
        type: "string",
        required: false,
        input: false,
      },
      banExpires: {
        type: "date",
        required: false,
        input: false,
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          if (!bootstrapAdminEmails.has(user.email.trim().toLowerCase())) {
            return
          }

          await db
            .update(schema.user)
            .set({ role: "admin" })
            .where(eq(schema.user.id, user.id))
        },
      },
    },
    session: {
      create: {
        before: async (session) => {
          const user = await db
            .select({
              id: schema.user.id,
              banned: schema.user.banned,
              banExpires: schema.user.banExpires,
            })
            .from(schema.user)
            .where(eq(schema.user.id, session.userId))
            .get()

          if (!user?.banned) {
            return
          }

          if (user.banExpires && user.banExpires.getTime() <= Date.now()) {
            await db
              .update(schema.user)
              .set({ banned: false, banReason: null, banExpires: null, updatedAt: new Date() })
              .where(eq(schema.user.id, user.id))
            return
          }

          throw APIError.from("FORBIDDEN", {
            message: "账号已被封禁。如有疑问，请联系管理员。",
            code: "BANNED_USER",
          })
        },
      },
    },
  },
})

export type Session = typeof auth.$Infer.Session
export type User = typeof auth.$Infer.Session.user
