import { auth } from "@/lib/auth"
import { initDb } from "@/lib/db"
import { getAvatarUrl } from "@/lib/gravatar"
import { resolveCanonicalAppUrl } from "@/lib/http"
import { getSiteSettings } from "@/lib/site-settings"
import { ShortLinkCreator } from "@/components/short-link-creator"
import { Button } from "@/components/ui/button"
import { UserMenu } from "@/components/user-menu"
import { headers } from "next/headers"
import Link from "next/link"
import { redirect } from "next/navigation"
import type { ComponentType, CSSProperties, ReactNode } from "react"
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock3,
  Code2,
  Copy,
  Inbox,
  KeyRound,
  Link2,
  Mail,
  ShieldCheck,
  TimerReset,
} from "lucide-react"

const orzBackgroundMarks = [
  { text: "orz", className: "left-[6%] top-[18%] text-3xl sm:text-5xl", duration: "18s" },
  { text: "OTZ", className: "right-[9%] top-[24%] text-4xl sm:text-6xl", duration: "22s" },
  { text: "＿|￣|○", className: "left-[10%] top-[66%] text-2xl sm:text-4xl", duration: "20s" },
  { text: "_(:3」∠)_", className: "right-[7%] top-[72%] hidden text-2xl sm:block lg:text-4xl", duration: "24s" },
]

const shortLinkHighlights = [
  "自定义后缀",
  "点击统计",
  "有效期与点击上限",
  "API 与 ShareX 配置",
]

const tempMailHighlights = [
  "快速生成地址",
  "在线查看收件箱",
  "删除邮箱及邮件",
  "Addy.io 兼容接口",
]

const heroOrzVariants = [
  { text: "Orz", className: "font-black tracking-normal" },
  { text: "orz", className: "font-black tracking-normal" },
  { text: "ORZ", className: "font-black tracking-normal" },
  { text: "OTZ", className: "font-black tracking-normal" },
  { text: "OTL", className: "font-black tracking-normal" },
  { text: "orz...", className: "font-black tracking-tight" },
  { text: "o rz", className: "font-black tracking-normal" },
  { text: "O|￣|_", className: "text-[clamp(3.3rem,11vw,8rem)] font-semibold tracking-tight" },
  { text: "＿|￣|○", className: "text-[clamp(3.3rem,11vw,8rem)] font-semibold tracking-tight" },
  { text: "○|￣|＿", className: "text-[clamp(3.3rem,11vw,8rem)] font-semibold tracking-tight" },
  { text: "_|￣|○", className: "text-[clamp(3.3rem,11vw,8rem)] font-semibold tracking-tight" },
  { text: "○几", className: "font-semibold tracking-tight" },
  { text: "囧rz", className: "font-black tracking-normal" },
  { text: "冏rz", className: "font-black tracking-normal" },
  { text: "崩orz", className: "font-black tracking-tight" },
  { text: "orz?", className: "font-black tracking-normal" },
  { text: "orz!", className: "font-black tracking-normal" },
  { text: "_(:3」∠)_", className: "text-[clamp(2.45rem,8vw,5.75rem)] font-semibold tracking-tight" },
  { text: "(¦3[▓▓]", className: "text-[clamp(2.65rem,8.5vw,6rem)] font-semibold tracking-tight" },
  { text: "(:з」∠)_", className: "text-[clamp(2.65rem,8.5vw,6rem)] font-semibold tracking-tight" },
]

const heroOrzCycleStep = 1.25

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
  const siteName = settings?.siteName?.trim() || "Orz"
  const sampleShortHost = getSampleShortHost(settings?.siteUrl, siteName)
  const user = session?.user
    ? {
        name: session.user.name,
        email: session.user.email,
        image: getAvatarUrl(session.user.email, session.user.image),
        role: (session.user as { role?: string }).role,
      }
    : null

  const dashboardHref = user ? "/dashboard" : "/login"
  const tempEmailHref = user ? "/dashboard?tab=temp-email" : "/login"
  const apiHref = user ? "/dashboard?tab=api" : "/login"

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#fbfcfb] text-foreground selection:bg-primary selection:text-primary-foreground">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(15,23,42,0.035)_1px,transparent_1px),linear-gradient(180deg,rgba(15,23,42,0.03)_1px,transparent_1px)] bg-[size:4.5rem_4.5rem]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-foreground/15 to-transparent" />
        {orzBackgroundMarks.map((mark) => (
          <span
            key={mark.text}
            className={`orz-bg-mark absolute font-mono font-black text-foreground/[0.055] ${mark.className}`}
            style={{ animationDuration: mark.duration }}
          >
            {mark.text}
          </span>
        ))}
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-[86rem] flex-col px-[var(--page-gutter)] py-5 sm:py-6 lg:py-7">
        <header className="flex items-center justify-between gap-4">
          <Link href="/" className="group flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-foreground/10 bg-white font-mono text-lg font-black tracking-tighter shadow-sm transition-transform group-hover:-translate-y-0.5">
              Orz
            </span>
            <span className="hidden min-w-0 text-lg font-semibold tracking-tight sm:block">短链接及临时邮箱</span>
          </Link>

          <nav className="flex items-center gap-2 sm:gap-5">
            <div className="hidden items-center gap-5 md:flex">
              <Link href={dashboardHref} className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                短链接
              </Link>
              <Link href={tempEmailHref} className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                临时邮箱
              </Link>
              <Link href={apiHref} className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                API
              </Link>
              <Link href="https://github.com/uvexz/shortly" target="_blank" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                GitHub
              </Link>
            </div>
            <div className="hidden h-5 w-px bg-border sm:block" />
            {user ? (
              <UserMenu user={user} />
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" asChild className="hidden font-semibold sm:inline-flex">
                  <Link href="/login">登录</Link>
                </Button>
                <Button size="sm" asChild className="h-9 rounded-md px-4 font-semibold shadow-sm">
                  <Link href="/register">开始使用</Link>
                </Button>
              </div>
            )}
          </nav>
        </header>

        <section className="grid flex-1 items-center gap-10 pb-12 pt-14 sm:pt-20 lg:grid-cols-[minmax(0,1fr)_minmax(25rem,0.86fr)] lg:gap-12 lg:pb-16 lg:pt-20">
          <div className="mx-auto max-w-3xl text-center lg:mx-0 lg:text-left">
            <div className="flex justify-center lg:justify-start">
              <div className="orz-hero-text relative h-[clamp(5rem,19vw,12rem)] w-full max-w-[44rem] overflow-visible font-mono text-[clamp(4.2rem,15vw,10.5rem)] leading-none text-foreground sm:text-[clamp(5rem,19vw,12rem)]">
                {heroOrzVariants.map((variant, index) => (
                  <span
                    key={variant.text}
                    className={`orz-hero-variant absolute inset-0 flex items-center justify-center lg:justify-start ${variant.className}`}
                    style={{
                      "--orz-cycle-delay": `${index * heroOrzCycleStep}s`,
                      "--orz-cycle-duration": `${heroOrzVariants.length * heroOrzCycleStep}s`,
                      zIndex: heroOrzVariants.length - index,
                    } as CSSProperties}
                    data-text={variant.text}
                    aria-hidden={index === 0 ? undefined : "true"}
                  >
                    {variant.text}
                  </span>
                ))}
              </div>
            </div>

            <p className="mx-auto mt-5 max-w-2xl text-pretty text-base leading-7 text-muted-foreground sm:text-lg lg:mx-0 lg:text-xl">
              把长链接轻轻放下，顺手拿一个临时邮箱。适合分享、验证、测试和任何“不想留下太多痕迹”的小任务。
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start">
              <Button size="lg" asChild className="h-11 rounded-md px-5 font-semibold sm:h-12">
                <Link href={dashboardHref}>
                  <Link2 className="h-4 w-4" />
                  管理短链接
                </Link>
              </Button>
              <Button variant="outline" size="lg" asChild className="h-11 rounded-md border-foreground/15 bg-white/70 px-5 font-semibold sm:h-12">
                <Link href={tempEmailHref}>
                  <Mail className="h-4 w-4" />
                  获取临时邮箱
                </Link>
              </Button>
            </div>

            <div className="mt-8 hidden gap-3 text-left sm:grid sm:grid-cols-3">
              <MiniSignal icon={TimerReset} title="自动过期" description="适合一次性分享和临时验证。" />
              <MiniSignal icon={ShieldCheck} title="隐私优先" description="少留痕迹，操作更可控。" />
              <MiniSignal icon={BarChart3} title="清晰统计" description="点击、日志和状态一眼可查。" />
            </div>
          </div>

          <div className="mx-auto w-full max-w-xl lg:mx-0">
            <div className="relative rounded-md border border-foreground/10 bg-white/85 p-4 shadow-[0_24px_80px_rgba(15,23,42,0.09)] backdrop-blur sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-4 border-b pb-3">
                <div>
                  <p className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">quick shortener</p>
                  <h2 className="mt-1 text-lg font-semibold tracking-tight">先粘贴一条长链接</h2>
                </div>
                <span className="rounded-md bg-emerald-50 px-2.5 py-1 font-mono text-xs font-bold text-emerald-700 ring-1 ring-emerald-100">
                  orz.to/abc
                </span>
              </div>
              <ShortLinkCreator user={user} mode="homepage" siteName={siteName} />
            </div>
          </div>
        </section>

        <section className="grid gap-5 pb-12 lg:grid-cols-2 lg:pb-16">
          <FeaturePanel
            title="短链接"
            eyebrow="SHORT LINKS"
            description="从创建、复制、统计到自动失效，短链保持轻巧，但该有的控制都在。"
            icon={Link2}
            href={dashboardHref}
            action="创建短链接"
            highlights={shortLinkHighlights}
            visual={
              <div className="space-y-3">
                <div className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 font-mono text-sm">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  {sampleShortHost}/orz
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <StatTile label="点击" value="1,248" />
                  <StatTile label="有效期" value="7 天" />
                  <StatTile label="状态" value="在线" />
                </div>
              </div>
            }
          />

          <FeaturePanel
            title="临时邮箱"
            eyebrow="TEMP MAIL"
            description="给注册验证、测试环境和一次性沟通一个干净收件箱，用完就收起来。"
            icon={Inbox}
            href={tempEmailHref}
            action="打开临时邮箱"
            highlights={tempMailHighlights}
            visual={
              <div className="space-y-3">
                <div className="rounded-md border bg-background p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-sm font-semibold">hello-orz@temp.mail</p>
                      <p className="text-xs text-muted-foreground">新验证码刚刚抵达</p>
                    </div>
                    <Copy className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
                <div className="grid gap-2">
                  <MailRow title="登录验证码" time="刚刚" />
                  <MailRow title="欢迎使用测试环境" time="2 分钟前" />
                </div>
              </div>
            }
          />
        </section>

        <section className="border-y border-foreground/10 py-10">
          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">for power users</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Orz 可以很轻，也可以很能打。</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Capability icon={Code2} title="开放 API" description="用 API key 接入短链和临时邮箱流程。" href={apiHref} />
              <Capability icon={KeyRound} title="Passkey 登录" description="减少密码负担，账户进入更直接。" href={user ? "/dashboard?tab=security" : "/login"} />
              <Capability icon={Clock3} title="生命周期控制" description="按有效期、点击上限和删除动作管理链接。" href={dashboardHref} />
              <Capability icon={CheckCircle2} title="清晰后台" description="链接、邮箱、日志和密钥集中管理。" href={dashboardHref} />
            </div>
          </div>
        </section>

        <footer className="flex flex-col gap-5 py-9 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="font-mono text-2xl font-black text-foreground">Orz</span>
            <span>短链接及临时邮箱</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Link href="https://github.com/uvexz/shortly" target="_blank" className="transition-colors hover:text-foreground">
              GitHub
            </Link>
            <Link href={apiHref} className="transition-colors hover:text-foreground">
              API
            </Link>
            <span>© 2026 {siteName}</span>
          </div>
        </footer>
      </div>
    </main>
  )
}

function MiniSignal({
  icon: Icon,
  title,
  description,
}: {
  icon: ComponentType<{ className?: string }>
  title: string
  description: string
}) {
  return (
    <div className="rounded-md border border-foreground/10 bg-white/60 p-3 shadow-sm backdrop-blur">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Icon className="h-4 w-4 text-emerald-700" />
        {title}
      </div>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
    </div>
  )
}

function FeaturePanel({
  title,
  eyebrow,
  description,
  icon: Icon,
  href,
  action,
  highlights,
  visual,
}: {
  title: string
  eyebrow: string
  description: string
  icon: ComponentType<{ className?: string }>
  href: string
  action: string
  highlights: string[]
  visual: ReactNode
}) {
  return (
    <article className="group overflow-hidden rounded-md border border-foreground/10 bg-white/78 p-5 shadow-sm backdrop-blur transition-shadow hover:shadow-md sm:p-6">
      <div className="flex items-start justify-between gap-5">
        <div className="min-w-0">
          <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">{eyebrow}</p>
          <h2 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">{title}</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">{description}</p>
        </div>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border bg-background text-foreground">
          <Icon className="h-5 w-5" />
        </span>
      </div>

      <div className="mt-6 rounded-md border bg-muted/20 p-3">{visual}</div>

      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        {highlights.map((item) => (
          <div key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-emerald-700" />
            <span>{item}</span>
          </div>
        ))}
      </div>

      <Button variant="ghost" asChild className="mt-6 h-9 px-0 font-semibold hover:bg-transparent">
        <Link href={href}>
          {action}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </Button>
    </article>
  )
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold">{value}</p>
    </div>
  )
}

function MailRow({ title, time }: { title: string; time: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2">
      <span className="min-w-0 truncate text-sm font-medium">{title}</span>
      <span className="shrink-0 text-xs text-muted-foreground">{time}</span>
    </div>
  )
}

function Capability({
  icon: Icon,
  title,
  description,
  href,
}: {
  icon: ComponentType<{ className?: string }>
  title: string
  description: string
  href: string
}) {
  return (
    <Link href={href} className="rounded-md border border-foreground/10 bg-white/70 p-4 shadow-sm transition-colors hover:bg-white">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-foreground text-background">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h3 className="font-semibold tracking-tight">{title}</h3>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">{description}</p>
        </div>
      </div>
    </Link>
  )
}

function getSampleShortHost(siteUrl: string | undefined, siteName: string) {
  if (siteUrl) {
    try {
      return new URL(siteUrl).host
    } catch {
      // Fall through to a neutral sample below.
    }
  }

  const asciiName = siteName
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "")
    .slice(0, 18)

  return asciiName ? `${asciiName}.link` : "orz.local"
}
