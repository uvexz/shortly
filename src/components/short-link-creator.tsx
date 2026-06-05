"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import {
  createClientErrorReporter,
  getResponseErrorMessage,
  getUserFacingErrorMessage,
  readOptionalJson,
} from "@/lib/client-feedback"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SHORT_LINK_EXPIRES_IN_OPTIONS, type ShortLinkExpiresIn } from "@/lib/short-link-expiration"
import { toast } from "sonner"
import { Scissors, Copy, ExternalLink, LogIn, X } from "lucide-react"
import Link from "next/link"

interface ShortDomainOption {
  host: string
  isDefault: boolean
  minSlugLength: number
}

interface DomainsResponse {
  shortDomains: ShortDomainOption[]
}

interface CreatorUser {
  name: string
  email: string
  image?: string | null
  role?: string
}

interface ShortenResult {
  shortUrl: string
  slug: string
  domain: string
  maxClicks?: number
}

type ShortLinkCreatorMode = "homepage" | "dashboard"
type ShortLinkCreatorSurface = "card" | "embedded"

interface ShortLinkCreatorProps {
  user: CreatorUser | null
  onCreated?: (result: ShortenResult) => void | Promise<void>
  mode?: ShortLinkCreatorMode
  surface?: ShortLinkCreatorSurface
  siteName?: string
}

const shortLinkCreatorReporter = createClientErrorReporter("short_link_creator")

const creatorModeMeta: Record<
  ShortLinkCreatorMode,
  {
    showContainer: boolean
    title: string
    description: string
  }
> = {
  homepage: {
    showContainer: false,
    title: "快速创建短链",
    description: "",
  },
  dashboard: {
    showContainer: true,
    title: "创建短链",
    description: "粘贴长链接并设置可选项；创建后的短链会显示在右侧，方便继续管理。",
  },
}

function getFieldHint(mode: ShortLinkCreatorMode, field: "domain" | "customSlug" | "maxClicks" | "expiresIn") {
  if (mode === "homepage") {
    switch (field) {
      case "domain":
        return "使用可用域名"
      case "customSlug":
        return "留空则自动生成"
      case "maxClicks":
        return "留空则不限制"
      case "expiresIn":
        return "留空则长期有效"
    }
  }

  switch (field) {
    case "domain":
      return "默认使用管理员配置的短链域名；你也可以在这里切换到其他可用域名。"
    case "customSlug":
      return "不填写时系统会自动生成；适合活动页、品牌词或便于记忆的链接。"
    case "maxClicks":
      return "适合限量传播、一次性口令或需要在达到阈值后自动失效的场景。"
    case "expiresIn":
      return "适合短期活动、临时分享或需要自动回收的链接。"
  }
}

export function ShortLinkCreator({
  user,
  onCreated,
  mode = "dashboard",
  surface = "card",
  siteName,
}: ShortLinkCreatorProps) {
  const isHomepageMode = mode === "homepage"
  const modeMeta = creatorModeMeta[mode]
  const submitLabel = isHomepageMode ? "生成" : "创建短链"

  const [url, setUrl] = useState("")
  const [customSlug, setCustomSlug] = useState("")
  const [maxClicks, setMaxClicks] = useState<string>("")
  const [expiresIn, setExpiresIn] = useState<ShortLinkExpiresIn | "none">("none")
  const [showOptions, setShowOptions] = useState(false)
  const [result, setResult] = useState<ShortenResult | null>(null)
  const [domainsLoading, setDomainsLoading] = useState(false)
  const [shortDomains, setShortDomains] = useState<ShortDomainOption[]>([])
  const [selectedDomain, setSelectedDomain] = useState("")
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (!user) return

    let cancelled = false
    setDomainsLoading(true)

    void (async () => {
      try {
        const res = await fetch("/api/domains")
        const body = await readOptionalJson<DomainsResponse & { error?: string }>(res)
        if (!res.ok) {
          shortLinkCreatorReporter.warn("fetch_domains_failed_response", { status: res.status })
          if (!cancelled) {
            toast.error(getResponseErrorMessage(body, "加载短链域名失败"))
          }
          return
        }

        if (cancelled) return
        const domains = body?.shortDomains || []
        setShortDomains(domains)
        setSelectedDomain((current) => current || domains.find((item) => item.isDefault)?.host || domains[0]?.host || "")
      } catch (error) {
        shortLinkCreatorReporter.report("fetch_domains_failed_exception", error)
        if (!cancelled) {
          toast.error(getUserFacingErrorMessage(error, "加载短链域名失败"))
        }
      } finally {
        if (!cancelled) {
          setDomainsLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [user])

  const selectedDomainConfig = useMemo(
    () => shortDomains.find((item) => item.host === selectedDomain) ?? null,
    [selectedDomain, shortDomains]
  )
  const selectedMinSlugLength = selectedDomainConfig?.minSlugLength ?? 1
  const normalizedCustomSlug = customSlug.trim()
  const customSlugTooShort = normalizedCustomSlug.length > 0 && normalizedCustomSlug.length < selectedMinSlugLength

  const canSubmit = useMemo(() => {
    if (!user) return false
    if (!url.trim()) return false
    if (!domainsLoading && shortDomains.length < 1) return false
    if (shortDomains.length > 0 && !selectedDomain) return false
    if (customSlugTooShort) return false
    return true
  }, [customSlugTooShort, domainsLoading, selectedDomain, shortDomains.length, url, user])

  function handleUrlChange(value: string) {
    setUrl(value)
    if (!value.trim()) {
      setShowOptions(false)
      setResult(null)
      return
    }

    if (!isHomepageMode) {
      setShowOptions(true)
    }
  }

  function handleShorten() {
    if (!user) {
      toast.error("请先登录后再创建短链")
      return
    }

    if (customSlugTooShort) {
      toast.error(`自定义后缀至少需要 ${selectedMinSlugLength} 个字符`)
      return
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/shorten", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: url.trim(),
            customSlug: customSlug.trim() || undefined,
            domain: selectedDomain || undefined,
            maxClicks: maxClicks ? parseInt(maxClicks, 10) : undefined,
            expiresIn: expiresIn === "none" ? undefined : expiresIn,
          }),
        })
        const data = await readOptionalJson<ShortenResult & { error?: string }>(res)
        if (!res.ok) {
          shortLinkCreatorReporter.warn("create_short_link_failed_response", {
            status: res.status,
            isAuthenticated: Boolean(user),
          })
          toast.error(getResponseErrorMessage(data, "创建短链失败"))
          return
        }
        if (!data) {
          toast.error("创建短链失败")
          return
        }
        setResult(data)
        toast.success("短链已创建")
        await onCreated?.(data)
      } catch (error) {
        shortLinkCreatorReporter.report("create_short_link_failed_exception", error, {
          isAuthenticated: Boolean(user),
        })
        toast.error(getUserFacingErrorMessage(error, "创建短链失败，请稍后重试"))
      }
    })
  }

  async function handleCopy() {
    if (!result) return
    try {
      await navigator.clipboard.writeText(result.shortUrl)
      toast.success("短链已复制")
    } catch (error) {
      shortLinkCreatorReporter.report("copy_short_link_failed_exception", error)
      toast.error(getUserFacingErrorMessage(error, "复制失败，请手动复制"))
    }
  }

  function handleReset() {
    setUrl("")
    setCustomSlug("")
    setMaxClicks("")
    setExpiresIn("none")
    setShowOptions(false)
    setResult(null)
  }

  const homepageOptionsButton = isHomepageMode && !result && url.trim()
  const shouldShowOptionsPanel = showOptions && user
  const showStandaloneCreate = isHomepageMode && !showOptions && !result
  const showCreateActions = !result && (!isHomepageMode || showOptions)
  const showNoDomainWarning = user && !domainsLoading && shortDomains.length < 1

  if (!isHomepageMode) {
    const containerClassName = surface === "embedded" ? "overflow-hidden bg-card" : "overflow-hidden rounded-xl border bg-card"
    const contentClassName = surface === "embedded" ? "grid gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]" : "grid gap-6 p-4 sm:p-5 xl:grid-cols-[minmax(0,1fr)_18rem]"

    return (
      <section className={containerClassName}>
        <div className={contentClassName}>
          <div className="space-y-5">
            <div className="flex flex-col gap-1">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Shorten</p>
              <h2 className="text-xl font-semibold tracking-tight">创建一条可控短链</h2>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                先粘贴目标地址，再按需设置域名、后缀、点击上限和有效期。
              </p>
            </div>

            <div className="space-y-2">
              <label htmlFor="short-link-url" className="text-sm font-medium">
                目标链接
              </label>
              <Input
                id="short-link-url"
                type="url"
                placeholder="https://example.com/very/long/path"
                value={url}
                onChange={(e) => handleUrlChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleShorten()
                }}
                className="h-12 text-base"
                autoFocus
              />
            </div>

            {user && (
              <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
                <div className="space-y-1.5">
                  <label htmlFor="short-link-domain" className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    域名
                  </label>
                  <Select value={selectedDomain} onValueChange={setSelectedDomain} disabled={domainsLoading || shortDomains.length < 1}>
                    <SelectTrigger id="short-link-domain" aria-label="短链域名" className="h-10 w-full bg-background">
                      <SelectValue placeholder={domainsLoading ? "加载中..." : "选择域名"} />
                    </SelectTrigger>
                    <SelectContent>
                      {shortDomains.map((domain) => (
                        <SelectItem key={domain.host} value={domain.host}>
                          {domain.host}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="short-link-custom-slug" className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    后缀
                  </label>
                  <Input
                    id="short-link-custom-slug"
                    placeholder="留空自动生成"
                    value={customSlug}
                    onChange={(e) => setCustomSlug(e.target.value)}
                    className="h-10 bg-background"
                    maxLength={50}
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="short-link-max-clicks" className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    点击上限
                  </label>
                  <Input
                    id="short-link-max-clicks"
                    type="number"
                    placeholder="不限"
                    value={maxClicks}
                    onChange={(e) => setMaxClicks(e.target.value)}
                    className="h-10 bg-background"
                    min="1"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="short-link-expires-in" className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    有效期
                  </label>
                  <Select value={expiresIn} onValueChange={(value) => setExpiresIn(value as ShortLinkExpiresIn | "none")}>
                    <SelectTrigger id="short-link-expires-in" aria-label="有效期" className="h-10 w-full bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">长期有效</SelectItem>
                      {SHORT_LINK_EXPIRES_IN_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {customSlugTooShort && (
              <p className="text-xs text-destructive">当前域名要求后缀至少 {selectedMinSlugLength} 个字符。</p>
            )}

            {showNoDomainWarning && (
              <div className="rounded-lg border border-dashed border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                当前没有可用的短链域名，请先让管理员启用短链域名后再创建。
              </div>
            )}
          </div>

          <aside className="flex flex-col justify-between gap-5 rounded-lg border bg-muted/20 p-4">
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Preview</p>
                <p className="mt-2 break-all font-mono text-sm text-foreground">
                  {selectedDomain || shortDomains[0]?.host || "short.domain"}/{normalizedCustomSlug || "auto"}
                </p>
              </div>
              <div className="grid gap-2 text-xs text-muted-foreground">
                <div className="flex items-center justify-between gap-3">
                  <span>点击限制</span>
                  <span className="font-medium text-foreground">{maxClicks || "不限"}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>有效期</span>
                  <span className="font-medium text-foreground">{expiresIn === "none" ? "长期" : expiresIn}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>后缀要求</span>
                  <span className="font-medium text-foreground">≥ {selectedMinSlugLength}</span>
                </div>
              </div>
            </div>

            <Button onClick={handleShorten} disabled={isPending || !canSubmit} className="h-11 w-full">
              <Scissors className="h-4 w-4" />
              {isPending ? "创建中..." : submitLabel}
            </Button>
          </aside>
        </div>

        {result && (
          <div className="border-t bg-background/60 p-4 sm:p-5">
            <div className="flex flex-col gap-4 rounded-lg border bg-card p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Created</p>
                <a
                  href={result.shortUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block break-all text-sm font-semibold text-primary hover:underline"
                >
                  {result.shortUrl}
                </a>
                <p className="break-all text-xs text-muted-foreground">
                  {result.domain}/{result.slug}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
                  <Copy className="h-4 w-4" />
                  复制
                </Button>
                <Button type="button" variant="outline" size="sm" asChild>
                  <a href={result.shortUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    打开
                  </a>
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={handleReset}>
                  <X className="h-4 w-4" />
                  新建
                </Button>
              </div>
            </div>
          </div>
        )}
      </section>
    )
  }

  const content = (
    <div className={isHomepageMode ? "mx-auto w-full max-w-3xl space-y-4" : "flex w-full max-w-none flex-col gap-4"}>
      {isHomepageMode && (
        <div className="space-y-2 text-center">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground/70">{siteName || "Shortly"}</p>
          <h1 className="text-balance text-[clamp(2rem,5vw,3.5rem)] font-medium tracking-[-0.04em]">快速创建短链</h1>
        </div>
      )}

      <div className={isHomepageMode ? "border-b" : "space-y-2"}>
        <Input
          id="short-link-url"
          type="url"
          placeholder="粘贴需要缩短的长链接"
          value={url}
          onChange={(e) => handleUrlChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (showOptions || isHomepageMode)) handleShorten()
          }}
          className={
            isHomepageMode
              ? "h-14 border-0 bg-transparent px-0 text-xl shadow-none focus-visible:ring-0 sm:h-16 sm:text-2xl"
              : "h-12 text-base"
          }
          autoFocus={!modeMeta.showContainer}
        />
      </div>

      {showStandaloneCreate && (
        <Button onClick={handleShorten} disabled={isPending || !canSubmit} className="h-11 w-full">
          <Scissors className="h-4 w-4" />
          {isPending ? "生成中..." : submitLabel}
        </Button>
      )}

      {homepageOptionsButton && (
        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="px-0 text-muted-foreground hover:text-foreground"
            onClick={() => setShowOptions((current) => !current)}
          >
            {showOptions ? "收起选项" : user ? "更多选项" : "登录后使用更多选项"}
          </Button>
          {!user && (
            <Button variant="ghost" size="sm" asChild className="px-0 text-muted-foreground hover:text-foreground">
              <Link href="/login">
                <LogIn className="h-4 w-4" />
                登录
              </Link>
            </Button>
          )}
        </div>
      )}

      {shouldShowOptionsPanel && (
        <div className={isHomepageMode ? "animate-in fade-in slide-in-from-top-1 flex flex-col gap-4 border-t pt-4 duration-200" : "animate-in fade-in slide-in-from-top-1 flex flex-col gap-4 rounded-lg border bg-muted/20 p-4 duration-200"}>
          <div className={isHomepageMode ? "grid gap-4 sm:grid-cols-2" : "grid gap-3"}>
            <div className="space-y-1.5">
              <label
                htmlFor="short-link-domain"
                className={isHomepageMode ? "text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground" : "text-sm font-medium"}
              >
                短链域名
              </label>
              <Select value={selectedDomain} onValueChange={setSelectedDomain} disabled={domainsLoading || shortDomains.length < 1}>
                <SelectTrigger id="short-link-domain" aria-label="短链域名" className="h-10 w-full bg-background">
                  <SelectValue placeholder={domainsLoading ? "加载短链域名中..." : "选择短链域名"} />
                </SelectTrigger>
                <SelectContent>
                  {shortDomains.map((domain) => (
                    <SelectItem key={domain.host} value={domain.host}>
                      {domain.host}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground/80">{getFieldHint(mode, "domain")}</p>
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="short-link-custom-slug"
                className={isHomepageMode ? "text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground" : "text-sm font-medium"}
              >
                自定义后缀
              </label>
              <Input
                id="short-link-custom-slug"
                placeholder="例如：summer-sale"
                value={customSlug}
                onChange={(e) => setCustomSlug(e.target.value)}
                className="h-10 bg-background"
                maxLength={50}
              />
              <p className={`text-[11px] ${customSlugTooShort ? "text-destructive" : "text-muted-foreground/80"}`}>
                当前域名要求后缀至少 {selectedMinSlugLength} 个字符。{getFieldHint(mode, "customSlug")}
              </p>
            </div>
          </div>

          <div className={isHomepageMode ? "grid gap-4 sm:grid-cols-2" : "grid gap-3"}>
            <div className="space-y-1.5">
              <label
                htmlFor="short-link-max-clicks"
                className={isHomepageMode ? "text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground" : "text-sm font-medium"}
              >
                最大点击次数
              </label>
              <Input
                id="short-link-max-clicks"
                type="number"
                placeholder="不填则不限制"
                value={maxClicks}
                onChange={(e) => setMaxClicks(e.target.value)}
                className="h-10 bg-background"
                min="1"
              />
              <p className="text-[11px] text-muted-foreground/80">{getFieldHint(mode, "maxClicks")}</p>
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="short-link-expires-in"
                className={isHomepageMode ? "text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground" : "text-sm font-medium"}
              >
                有效期
              </label>
              <Select value={expiresIn} onValueChange={(value) => setExpiresIn(value as ShortLinkExpiresIn | "none")}>
                <SelectTrigger id="short-link-expires-in" aria-label="有效期" className="h-10 w-full bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">不设置有效期</SelectItem>
                  {SHORT_LINK_EXPIRES_IN_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground/80">{getFieldHint(mode, "expiresIn")}</p>
            </div>
          </div>

          {showCreateActions && (
            <div className={isHomepageMode ? "flex flex-col gap-2 pt-1 sm:flex-row" : "flex flex-col gap-2 sm:flex-row"}>
              <Button onClick={handleShorten} disabled={isPending || !canSubmit} className="h-10 flex-1">
                <Scissors className="h-4 w-4" />
                {isPending ? "创建中..." : submitLabel}
              </Button>
            </div>
          )}
        </div>
      )}

      {showNoDomainWarning && (
        <div className={isHomepageMode ? "border-t pt-3 text-sm text-destructive" : "rounded-lg border border-dashed border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive"}>
          {isHomepageMode ? "暂无可用短链域名" : "当前没有可用的短链域名，请先让管理员启用短链域名后再创建。"}
        </div>
      )}

      {result && (
        <div className={isHomepageMode ? "space-y-3 border-t pt-3" : "space-y-3 rounded-lg border bg-background p-4"}>
          {!isHomepageMode && (
            <div>
              <p className="text-sm font-medium">短链已创建</p>
              <p className="mt-1 text-xs text-muted-foreground">现在可以复制短链、打开测试，或继续创建下一条。</p>
            </div>
          )}
          <div className={isHomepageMode ? "flex flex-col gap-3 sm:flex-row sm:items-center" : "flex flex-col gap-3 rounded-lg border bg-muted/40 px-3 py-3 sm:flex-row sm:items-center"}>
            <div className="min-w-0 flex-1 space-y-1">
              <a
                href={result.shortUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={isHomepageMode ? "block break-all text-base font-medium hover:underline" : "block break-all text-sm font-medium text-primary hover:underline"}
              >
                {result.shortUrl}
              </a>
              <p className="text-xs text-muted-foreground break-all">
                {result.domain}/{result.slug}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
                <Copy className="h-4 w-4" />
                复制
              </Button>
              <Button type="button" variant="outline" size="sm" asChild>
                <a href={result.shortUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  打开
                </a>
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={handleReset}>
                <X className="h-4 w-4" />
                继续新建
              </Button>
            </div>
          </div>
        </div>
      )}

      {isHomepageMode && (
        <p className="pt-6 text-center text-[11px] text-muted-foreground/70">
          {user ? "可继续展开选项设置域名、有效期和访问限制。" : "登录后可设置域名、有效期和访问限制。"}
        </p>
      )}
    </div>
  )

  return content
}
