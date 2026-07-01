import { ShortLinkCreator } from "@/components/short-link-creator"
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
import type { ReactNode } from "react"
import { ArrowDownRight, ArrowRight, Code2, KeyRound, Link2, Mail, ShieldCheck, TimerReset } from "lucide-react"

const controlRows = [
  {
    label: "短链",
    title: "可读、可复制、可回收。",
    description: "自定义后缀、域名选择、点击统计和状态日志保持在同一条记录里。",
  },
  {
    label: "边界",
    title: "限制清楚写在前面。",
    description: "有效期和点击上限让临时分享自然结束，不需要事后补救。",
  },
  {
    label: "邮箱",
    title: "临时收件箱不占用主邮箱。",
    description: "注册验证、测试环境和一次性沟通可以单独处理，用完即删。",
  },
]

const productLinks = [
  {
    hrefKey: "dashboard" as const,
    icon: Link2,
    label: "Short Links",
    title: "短链接工作台",
    description: "创建、复制、查看点击与操作日志。",
  },
  {
    hrefKey: "tempEmail" as const,
    icon: Mail,
    label: "Temp Mail",
    title: "临时邮箱",
    description: "快速生成地址，在线查看邮件内容。",
  },
  {
    hrefKey: "api" as const,
    icon: Code2,
    label: "API",
    title: "开放接口",
    description: "API key、OpenAPI 文档和 ShareX 配置集中管理。",
  },
  {
    hrefKey: "security" as const,
    icon: KeyRound,
    label: "Access",
    title: "账户入口",
    description: "支持 GitHub、邮箱验证码和 Passkey。",
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
  const sampleShortHost = getSampleShortHost(settings?.siteUrl, siteName)
  const user = session?.user
    ? {
        name: session.user.name,
        email: session.user.email,
        image: getAvatarUrl(session.user.email, session.user.image),
        role: (session.user as { role?: string }).role,
      }
    : null

  const hrefs = {
    dashboard: user ? "/dashboard" : "/login",
    tempEmail: user ? "/dashboard?tab=temp-email" : "/login",
    api: user ? "/dashboard?tab=api" : "/login",
    security: user ? "/dashboard?tab=security" : "/login",
  }

  return (
    <main className="wabi-paper min-h-screen overflow-hidden text-[#1d1b18] selection:bg-[#1d1b18] selection:text-[#efebe3]">
      <div className="relative mx-auto w-full max-w-[92rem] px-[var(--page-gutter)]">
        <header className="flex items-center justify-between gap-4 border-b border-[#1d1b18]/15 py-5">
          <Link href="/" className="group flex min-w-0 items-center gap-3" aria-label={`${siteName} 首页`}>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-[#1d1b18]/35 bg-[#e7e2d8] font-mono text-[11px] font-semibold uppercase text-[#1d1b18] transition-colors group-hover:bg-[#1d1b18] group-hover:text-[#efebe3]">
              {siteName.slice(0, 2)}
            </span>
            <span className="min-w-0 font-mono text-[11px] uppercase text-[#5f5a51]">
              <span className="block text-[#1d1b18]">{siteName}</span>
              <span className="hidden sm:block">Short links / temp mail</span>
            </span>
          </Link>

          <nav className="flex items-center gap-3 sm:gap-5" aria-label="主导航">
            <div className="hidden items-center gap-5 md:flex">
              <TextLink href={hrefs.dashboard}>短链接</TextLink>
              <TextLink href={hrefs.tempEmail}>临时邮箱</TextLink>
              <TextLink href={hrefs.api}>API</TextLink>
              <TextLink href="https://github.com/uvexz/shortly" external>
                GitHub
              </TextLink>
            </div>
            <div className="hidden h-5 w-px bg-[#1d1b18]/15 sm:block" />
            {user ? (
              <UserMenu user={user} />
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" asChild className="hidden text-[#4c4841] hover:bg-[#d8d2c6] sm:inline-flex">
                  <Link href="/login">登录</Link>
                </Button>
                <Button size="sm" asChild className="h-9 bg-[#1d1b18] px-4 text-[#efebe3] hover:bg-[#35312c]">
                  <Link href="/register">
                    开始
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            )}
          </nav>
        </header>

        <section className="grid gap-8 border-b border-[#1d1b18]/15 py-10 sm:py-12 lg:grid-cols-12 lg:gap-8 lg:py-10">
          <aside className="wabi-reveal lg:col-span-2">
            <div className="lg:sticky lg:top-8">
              <p className="font-mono text-[10px] uppercase text-[#706a5f]">§ 00</p>
              <p className="mt-2 max-w-28 font-mono text-[10px] uppercase leading-5 text-[#706a5f]">Quiet link desk</p>
            </div>
          </aside>

          <div className="grid gap-10 lg:col-span-10 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,0.72fr)] lg:items-start xl:gap-14">
            <div className="wabi-reveal" data-delay="1">
              <p className="font-mono text-[11px] uppercase text-[#706a5f]">{sampleShortHost} / managed</p>
              <h1 className="font-wabi-display mt-6 max-w-[7em] text-[clamp(3rem,6.2vw,5.6rem)] leading-[0.94] text-[#1d1b18]">
                <span className="block">短链接，</span>
                <span className="block">轻任务。</span>
              </h1>
              <p className="mt-7 max-w-[42rem] text-pretty text-lg leading-8 text-[#4c4841] sm:text-xl">
                把长链接、临时邮箱和 API 密钥放在一张安静的工作台里。少一点噪音，多一点可控。
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button size="lg" asChild className="h-11 bg-[#1d1b18] px-5 text-[#efebe3] hover:bg-[#35312c]">
                  <Link href={hrefs.dashboard}>
                    <Link2 className="h-4 w-4" />
                    管理短链接
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  asChild
                  className="h-11 border-[#1d1b18]/25 bg-[#efebe3]/50 px-5 text-[#1d1b18] hover:bg-[#ded8cc]"
                >
                  <Link href={hrefs.tempEmail}>
                    <Mail className="h-4 w-4" />
                    获取临时邮箱
                  </Link>
                </Button>
              </div>

              <dl className="mt-10 hidden gap-5 border-t border-[#1d1b18]/15 pt-5 sm:grid sm:grid-cols-3">
                <Metric label="Created for" value="分享 / 验证 / 测试" />
                <Metric label="Controls" value="过期 / 上限 / 日志" />
                <Metric label="Access" value="网页 / API / ShareX" />
              </dl>
            </div>

            <div className="wabi-reveal" data-delay="2">
              <div className="relative border border-[#1d1b18]/25 bg-[#eee9df]/82 p-4 shadow-[0_24px_80px_rgba(29,27,24,0.08)] sm:p-5">
                <div className="mb-5 flex items-start justify-between gap-4 border-b border-[#1d1b18]/15 pb-4">
                  <div>
                    <p className="font-mono text-[10px] uppercase text-[#706a5f]">Quick shortener</p>
                    <h2 className="mt-2 text-xl font-medium text-[#1d1b18]">先粘贴一条长链接</h2>
                  </div>
                  <span className="shrink-0 border border-[#1d1b18]/20 px-2.5 py-1 font-mono text-[10px] uppercase text-[#5f5a51]">
                    ready
                  </span>
                </div>
                <ShortLinkCreator user={user} mode="homepage" siteName={siteName} />
              </div>
            </div>
          </div>
        </section>

        <SectionShell marker="§ 01" label="Record" title="一条短链，应该像一张记录。">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,0.84fr)_minmax(19rem,0.5fr)] lg:items-start">
            <LinkRecordProof host={sampleShortHost} />
            <div className="space-y-6">
              <p className="max-w-[34rem] text-lg leading-8 text-[#4c4841]">
                不是只有一个跳转地址。它还要告诉你谁创建、何时失效、是否达到点击上限，以及下一步该复制、暂停还是删除。
              </p>
              <div className="border-y border-[#1d1b18]/15">
                <ProofNote title="少装饰" description="状态、数字和动作直接写在界面上，不靠夸张图形解释。" />
                <ProofNote title="可回收" description="临时分享有自然边界，过期后不会继续在外流动。" />
                <ProofNote title="可追踪" description="日志保留关键事件，回看时不用翻服务器输出。" />
              </div>
            </div>
          </div>
        </SectionShell>

        <SectionShell marker="§ 02" label="Control" title="控制项保持克制，但不缺席。">
          <div className="divide-y divide-[#1d1b18]/15 border-y border-[#1d1b18]/15">
            {controlRows.map((item) => (
              <article key={item.label} className="grid gap-4 py-6 sm:grid-cols-[8rem_minmax(0,1fr)] lg:grid-cols-[10rem_minmax(0,0.74fr)]">
                <p className="font-mono text-[10px] uppercase text-[#706a5f]">{item.label}</p>
                <div>
                  <h3 className="text-2xl font-medium text-[#1d1b18]">{item.title}</h3>
                  <p className="mt-2 max-w-[46rem] leading-7 text-[#4c4841]">{item.description}</p>
                </div>
              </article>
            ))}
          </div>
        </SectionShell>

        <SectionShell marker="§ 03" label="Tools" title="从一次性任务，到日常管理。">
          <div className="grid border-y border-[#1d1b18]/15 lg:grid-cols-2">
            {productLinks.map((item, index) => {
              const Icon = item.icon
              const href = hrefs[item.hrefKey]

              return (
                <Link
                  key={item.label}
                  href={href}
                  className={`group flex min-h-40 flex-col justify-between gap-8 border-[#1d1b18]/15 p-5 transition-colors hover:bg-[#e3ded3] sm:p-6 ${
                    index % 2 === 0 ? "lg:border-r" : ""
                  } ${index > 1 ? "border-t" : index === 1 ? "border-t lg:border-t-0" : ""}`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <p className="font-mono text-[10px] uppercase text-[#706a5f]">{item.label}</p>
                    <Icon className="h-4 w-4 text-[#706a5f]" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-medium text-[#1d1b18]">{item.title}</h3>
                    <p className="mt-2 max-w-[27rem] leading-7 text-[#4c4841]">{item.description}</p>
                  </div>
                  <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase text-[#1d1b18]">
                    打开
                    <ArrowDownRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:translate-y-0.5" />
                  </span>
                </Link>
              )
            })}
          </div>
        </SectionShell>

        <section className="grid gap-8 border-b border-[#1d1b18]/15 py-12 sm:py-16 lg:grid-cols-12">
          <div className="lg:col-span-2">
            <p className="font-mono text-[10px] uppercase text-[#706a5f]">§ 04 / close</p>
          </div>
          <div className="lg:col-span-7">
            <h2 className="font-wabi-display text-balance text-[clamp(3rem,8vw,7rem)] leading-[0.95] text-[#1d1b18]">
              需要时出现，用完后退场。
            </h2>
          </div>
          <div className="flex flex-col justify-end gap-4 lg:col-span-3">
            <p className="leading-7 text-[#4c4841]">适合短期活动、测试验证、分享文件和任何不想把主账号暴露在外的场景。</p>
            <Button asChild className="h-11 w-fit bg-[#1d1b18] px-5 text-[#efebe3] hover:bg-[#35312c]">
              <Link href={hrefs.dashboard}>
                进入工作台
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>

        <footer className="flex flex-col gap-5 py-8 font-mono text-[11px] uppercase text-[#706a5f] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="text-[#1d1b18]">{siteName}</span>
            <span>Short links and temporary mail</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Link href="https://github.com/uvexz/shortly" target="_blank" className="transition-colors hover:text-[#1d1b18]">
              GitHub
            </Link>
            <Link href={hrefs.api} className="transition-colors hover:text-[#1d1b18]">
              API
            </Link>
            <span>© 2026</span>
          </div>
        </footer>
      </div>
    </main>
  )
}

function TextLink({
  href,
  external,
  children,
}: {
  href: string
  external?: boolean
  children: ReactNode
}) {
  return (
    <Link
      href={href}
      target={external ? "_blank" : undefined}
      className="font-mono text-[11px] uppercase text-[#5f5a51] transition-colors hover:text-[#1d1b18]"
    >
      {children}
    </Link>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase text-[#706a5f]">{label}</dt>
      <dd className="mt-2 text-sm text-[#1d1b18]">{value}</dd>
    </div>
  )
}

function SectionShell({
  marker,
  label,
  title,
  children,
}: {
  marker: string
  label: string
  title: string
  children: ReactNode
}) {
  return (
    <section className="grid gap-8 border-b border-[#1d1b18]/15 py-12 sm:py-16 lg:grid-cols-12 lg:gap-8">
      <aside className="lg:col-span-2">
        <div className="lg:sticky lg:top-8">
          <p className="font-mono text-[10px] uppercase text-[#706a5f]">{marker}</p>
          <p className="mt-2 font-mono text-[10px] uppercase leading-5 text-[#706a5f]">{label}</p>
        </div>
      </aside>
      <div className="lg:col-span-10">
        <h2 className="font-wabi-display max-w-[12ch] text-balance text-[clamp(2.75rem,7vw,6.25rem)] leading-[0.98] text-[#1d1b18]">
          {title}
        </h2>
        <div className="mt-8 sm:mt-10">{children}</div>
      </div>
    </section>
  )
}

function LinkRecordProof({ host }: { host: string }) {
  return (
    <div className="wabi-proof relative border border-[#1d1b18]/25 bg-[#eee9df] p-4 sm:p-6">
      <div className="flex items-start justify-between gap-4 border-b border-[#1d1b18]/15 pb-4">
        <div>
          <p className="font-mono text-[10px] uppercase text-[#706a5f]">Link record</p>
          <p className="mt-2 break-all font-mono text-sm text-[#1d1b18]">{host}/stone-042</p>
        </div>
        <span className="border border-[#1d1b18]/20 px-2.5 py-1 font-mono text-[10px] uppercase text-[#5f5a51]">active</span>
      </div>

      <div className="py-7">
        <p className="text-sm leading-6 text-[#706a5f]">目标地址</p>
        <p className="mt-2 break-all font-mono text-lg leading-8 text-[#1d1b18]">
          https://example.com/archive/long-form-release-notes
        </p>
      </div>

      <dl className="grid gap-px overflow-hidden border border-[#1d1b18]/15 bg-[#1d1b18]/15 sm:grid-cols-2">
        <RecordCell label="Clicks" value="248" />
        <RecordCell label="Limit" value="500" />
        <RecordCell label="Expires" value="7 天后" />
        <RecordCell label="Last event" value="复制短链" />
      </dl>

      <div className="mt-6 grid gap-3 text-sm leading-6 text-[#4c4841] sm:grid-cols-3">
        <Annotation icon={<TimerReset className="h-4 w-4" />} title="自动失效" />
        <Annotation icon={<ShieldCheck className="h-4 w-4" />} title="日志留痕" />
        <Annotation icon={<Link2 className="h-4 w-4" />} title="一键复制" />
      </div>
    </div>
  )
}

function RecordCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#eee9df] p-4">
      <dt className="font-mono text-[10px] uppercase text-[#706a5f]">{label}</dt>
      <dd className="mt-2 text-lg font-medium text-[#1d1b18]">{value}</dd>
    </div>
  )
}

function Annotation({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 border border-[#1d1b18]/15 bg-[#e7e2d8]/70 px-3 py-2">
      <span className="text-[#5f5a51]">{icon}</span>
      <span>{title}</span>
    </div>
  )
}

function ProofNote({ title, description }: { title: string; description: string }) {
  return (
    <div className="grid gap-2 border-b border-[#1d1b18]/15 py-5 last:border-b-0 sm:grid-cols-[6rem_minmax(0,1fr)]">
      <h3 className="font-mono text-[10px] uppercase text-[#1d1b18]">{title}</h3>
      <p className="leading-7 text-[#4c4841]">{description}</p>
    </div>
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

  return asciiName ? `${asciiName}.link` : "short.ly"
}
