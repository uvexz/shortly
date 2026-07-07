import { Button } from "@/components/ui/button"
import { UserMenu } from "@/components/user-menu"
import { auth } from "@/lib/auth"
import { initDb } from "@/lib/db"
import { getAvatarUrl } from "@/lib/gravatar"
import { resolveCanonicalAppUrl } from "@/lib/http"
import { getSiteSettings } from "@/lib/site-settings"
import { headers } from "next/headers"
import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowRight, Link2, LogIn, Mail, UserPlus } from "lucide-react"

const featureItems = [
  {
    icon: Link2,
    label: "短链接服务",
    title: "生成更短、更易分享的链接。",
    description: "支持管理、复制、有效期和访问记录。",
    href: "/dashboard",
  },
  {
    icon: Mail,
    label: "临时邮箱服务",
    title: "创建不暴露主邮箱的收件地址。",
    description: "适合验证码、测试收件和一次性沟通。",
    href: "/dashboard?tab=temp-email",
  },
]

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const headersList = await headers()
  const canonicalAppUrl = resolveCanonicalAppUrl(headersList)

  if (canonicalAppUrl) {
    const targetUrl = new URL(canonicalAppUrl)
    const homepageSearchParams = await searchParams

    for (const [key, value] of Object.entries(homepageSearchParams)) {
      if (Array.isArray(value)) {
        for (const item of value) {
          targetUrl.searchParams.append(key, item)
        }
        continue
      }

      if (value !== undefined) {
        targetUrl.searchParams.set(key, value)
      }
    }

    redirect(targetUrl.toString())
  }

  await initDb()
  const [settings, session] = await Promise.all([
    getSiteSettings(),
    auth.api.getSession({ headers: headersList }),
  ])
  const siteName = settings?.siteName?.trim() || "Shortly"
  const user = session?.user
    ? {
        name: session.user.name,
        email: session.user.email,
        image: getAvatarUrl(session.user.email, session.user.image),
        role: (session.user as { role?: string }).role,
      }
    : null

  const primaryHref = user ? "/dashboard" : "/login"
  const secondaryHref = user ? "/dashboard?tab=temp-email" : "/register"
  const primaryLabel = user ? "进入工作台" : "登录使用"
  const secondaryLabel = user ? "临时邮箱" : "注册使用"

  return (
    <main className="min-h-screen bg-[#fafafa] text-[#171717] selection:bg-[#171717] selection:text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 sm:px-6 lg:px-8">
        <header className="flex h-16 items-center justify-between gap-4 shadow-[0_1px_0_0_rgba(0,0,0,0.08)]">
          <Link
            href="/"
            className="group flex min-w-0 items-center gap-3 rounded-md outline-none focus-visible:shadow-[0_0_0_2px_#fff,0_0_0_4px_#0072f5]"
            aria-label={`${siteName} 首页`}
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-[#171717] text-sm font-semibold text-white">
              {siteName.slice(0, 1).toUpperCase()}
            </span>
            <span className="truncate text-sm font-medium text-[#171717]">{siteName}</span>
          </Link>

          <nav className="flex items-center gap-2" aria-label="主导航">
            {user ? (
              <UserMenu user={user} />
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                  className="h-9 rounded-md px-3 text-[#4d4d4d] hover:bg-[#ebebeb] hover:text-[#171717] focus-visible:ring-0 focus-visible:shadow-[0_0_0_2px_#fff,0_0_0_4px_#0072f5]"
                >
                  <Link href="/login">登录</Link>
                </Button>
                <Button
                  size="sm"
                  asChild
                  className="h-9 rounded-md bg-[#171717] px-3 text-white hover:bg-[#333333] focus-visible:ring-0 focus-visible:shadow-[0_0_0_2px_#fff,0_0_0_4px_#0072f5]"
                >
                  <Link href="/register">注册</Link>
                </Button>
              </>
            )}
          </nav>
        </header>

        <section className="grid flex-1 items-center gap-10 py-12 md:grid-cols-[minmax(0,1fr)_minmax(20rem,25rem)] lg:gap-16 lg:py-16">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#ffffff] px-3 py-1.5 text-xs font-medium text-[#4d4d4d] shadow-[0_0_0_1px_rgba(0,0,0,0.08)]">
              <span className="size-2 rounded-full bg-[#0072f5]" />
              短链接 / 临时邮箱服务
            </div>
            <h1 className="mt-6 max-w-2xl text-4xl font-semibold leading-tight tracking-normal text-[#171717] sm:text-5xl lg:text-6xl">
              为临时分享和一次性收件提供服务。
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-[#4d4d4d] sm:text-lg">
              需要公开链接时，我们提供可管理的短链接。需要接收验证码或测试邮件时，我们提供临时邮箱。登录或注册即可开始使用。
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button
                size="lg"
                asChild
                className="h-11 rounded-md bg-[#171717] px-5 text-white hover:bg-[#333333] focus-visible:ring-0 focus-visible:shadow-[0_0_0_2px_#fff,0_0_0_4px_#0072f5]"
              >
                <Link href={primaryHref}>
                  {user ? <ArrowRight className="size-4" /> : <LogIn className="size-4" />}
                  {primaryLabel}
                </Link>
              </Button>
              <Button
                variant="outline"
                size="lg"
                asChild
                className="h-11 rounded-md border-0 bg-[#ffffff] px-5 text-[#171717] shadow-[0_0_0_1px_rgba(0,0,0,0.08)] hover:bg-[#f2f2f2] focus-visible:ring-0 focus-visible:shadow-[0_0_0_2px_#fff,0_0_0_4px_#0072f5]"
              >
                <Link href={secondaryHref}>
                  {user ? <Mail className="size-4" /> : <UserPlus className="size-4" />}
                  {secondaryLabel}
                </Link>
              </Button>
            </div>
          </div>

          <div className="rounded-[8px] bg-[#ffffff] p-4 shadow-[0_0_0_1px_rgba(0,0,0,0.08),0_24px_64px_rgba(0,0,0,0.06)]">
            <div className="flex items-center justify-between gap-3 pb-4">
              <div>
                <p className="text-sm font-medium text-[#171717]">服务入口</p>
                <p className="mt-1 text-xs text-[#8f8f8f]">短链接与临时邮箱</p>
              </div>
              <span className="rounded-full bg-[#f2f2f2] px-2.5 py-1 text-xs font-medium text-[#4d4d4d]">
                {user ? "已启用" : "登录启用"}
              </span>
            </div>
            <div className="divide-y divide-[#ebebeb] shadow-[0_-1px_0_0_rgba(0,0,0,0.08)]">
              {featureItems.map((item) => {
                const Icon = item.icon
                const href = user ? item.href : "/login"

                return (
                  <Link
                    key={item.label}
                    href={href}
                    className="group grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-3 py-4 outline-none transition-colors hover:bg-[#fafafa] focus-visible:shadow-[0_0_0_2px_#fff,0_0_0_4px_#0072f5]"
                  >
                    <span className="flex size-9 items-center justify-center rounded-md bg-[#f2f2f2] text-[#171717]">
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-[#171717]">{item.label}</span>
                      <span className="mt-1 block truncate text-xs text-[#8f8f8f]">{item.title}</span>
                    </span>
                    <ArrowRight className="size-4 text-[#8f8f8f] transition-colors group-hover:text-[#0072f5]" />
                  </Link>
                )
              })}
            </div>
          </div>
        </section>

        <footer className="flex flex-col gap-3 py-6 text-xs text-[#8f8f8f] sm:flex-row sm:items-center sm:justify-between">
          <p>{siteName} 提供短链接与临时邮箱服务。</p>
          <div className="flex items-center gap-4">
            {user ? (
              <>
                <Link href="/dashboard" className="transition-colors hover:text-[#0072f5]">
                  工作台
                </Link>
                <Link href="/dashboard?tab=temp-email" className="transition-colors hover:text-[#0072f5]">
                  临时邮箱
                </Link>
              </>
            ) : (
              <>
                <Link href="/login" className="transition-colors hover:text-[#0072f5]">
                  登录
                </Link>
                <Link href="/register" className="transition-colors hover:text-[#0072f5]">
                  注册
                </Link>
              </>
            )}
          </div>
        </footer>
      </div>
    </main>
  )
}
