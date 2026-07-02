"use client"

import { useState, useEffect, useCallback, type ComponentType, type ReactNode } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { UserMenu } from "@/components/user-menu"
import { ShortLinkCreator } from "@/components/short-link-creator"
import { TempEmailManager } from "@/components/temp-email-manager"
import {
  createClientErrorReporter,
  getResponseErrorMessage,
  getUserFacingErrorMessage,
  readOptionalJson,
} from "@/lib/client-feedback"
import { cn, formatDate } from "@/lib/utils"
import { getLogEventLabel } from "@/lib/log-events"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { toast } from "sonner"
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart2,
  CheckCircle2,
  Clock3,
  Copy,
  ExternalLink,
  Gauge,
  KeyRound,
  LayoutDashboard,
  Link2,
  Mail,
  MousePointerClick,
  PanelRight,
  RefreshCw,
  Shield,
  Trash2,
  Zap,
} from "lucide-react"
import Link from "next/link"
import { PasskeyManager } from "@/components/passkey-manager"
import { ApiManagementPanel } from "@/components/api-management"
import { useMediaQuery } from "@/lib/use-media-query"

interface ShortLink {
  id: string
  slug: string
  domain: string
  shortUrl: string
  originalUrl: string
  clicks: number
  maxClicks: number | null
  expiresAt: string | null
  hasClickLimit: boolean
  hasExpiration: boolean
  isExpired: boolean
  expiredByClicks: boolean
  expiredByDate: boolean
  createdAt: number
}

interface ClickLog {
  id: string
  eventType: string
  referrer: string | null
  userAgent: string | null
  ipAddress: string | null
  statusCode: number | null
  createdAt: number
}

interface DashboardClientProps {
  user: {
    name: string
    email: string
    image?: string | null
    role?: string
  }
  initialTab?: string
}

const dashboardTabs = new Set(["links", "temp-email", "api", "security"])
const dashboardReporter = createClientErrorReporter("dashboard_client")
const LINK_PAGE_SIZE = 10
const EXPIRING_SOON_MS = 1000 * 60 * 60 * 24 * 7

const tabMeta = {
  links: {
    label: "短链",
    title: "短链控制台",
    description: "创建、检查和回收你正在分发的短链。",
    icon: Link2,
  },
  "temp-email": {
    label: "临时邮箱",
    title: "临时邮箱",
    description: "管理一次性收件箱和消息处理状态。",
    icon: Mail,
  },
  api: {
    label: "API",
    title: "API 管理",
    description: "创建密钥，接入 OpenAPI、ShareX 和别名工具。",
    icon: KeyRound,
  },
  security: {
    label: "安全",
    title: "账户安全",
    description: "维护通行密钥和登录保护。",
    icon: Shield,
  },
} as const

type DashboardTab = keyof typeof tabMeta
type LucideIcon = ComponentType<{ className?: string }>

function getDashboardTab(value: string | null | undefined) {
  return value && dashboardTabs.has(value) ? (value as DashboardTab) : "links"
}

function getPositivePage(value: string | null | undefined) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function getDeleteSuccessState(remainingItems: number, currentPage: number) {
  if (remainingItems > 0) {
    return {
      nextPage: currentPage,
      shouldRefetch: false,
    }
  }

  if (currentPage > 1) {
    return {
      nextPage: currentPage - 1,
      shouldRefetch: true,
    }
  }

  return {
    nextPage: 1,
    shouldRefetch: true,
  }
}

function parseDateTime(value: string | number | Date | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function getPageRange(page: number, totalItems: number, visibleItems: number) {
  if (totalItems <= 0 || visibleItems <= 0) {
    return "0 / 0"
  }

  const start = (page - 1) * LINK_PAGE_SIZE + 1
  const end = Math.min(totalItems, start + visibleItems - 1)
  return `${start}-${end} / ${totalItems}`
}

function getLinkHealth(link: ShortLink, referenceTime: number | null) {
  if (link.isExpired) {
    return {
      label: link.expiredByClicks ? "点击封顶" : link.expiredByDate ? "已过期" : "已失效",
      className: "border-destructive/30 bg-destructive/5 text-destructive",
      dotClassName: "bg-destructive",
    }
  }

  const expiresAt = parseDateTime(link.expiresAt)
  if (expiresAt && referenceTime && expiresAt.getTime() - referenceTime <= EXPIRING_SOON_MS) {
    return {
      label: "即将到期",
      className: "border-amber-300/70 bg-amber-50 text-amber-700",
      dotClassName: "bg-amber-500",
    }
  }

  if (link.hasClickLimit || link.hasExpiration) {
    return {
      label: "有规则",
      className: "border-emerald-300/70 bg-emerald-50 text-emerald-700",
      dotClassName: "bg-emerald-500",
    }
  }

  return {
    label: "有效",
    className: "border-primary/15 bg-primary/[0.04] text-primary",
    dotClassName: "bg-primary",
  }
}

function DashboardMetric({
  label,
  value,
  description,
  icon: Icon,
  tone = "neutral",
}: {
  label: string
  value: ReactNode
  description: string
  icon: LucideIcon
  tone?: "neutral" | "good" | "warning" | "danger"
}) {
  const toneClassName =
    tone === "good"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200/70"
      : tone === "warning"
        ? "bg-amber-50 text-amber-700 ring-amber-200/70"
        : tone === "danger"
          ? "bg-destructive/5 text-destructive ring-destructive/20"
          : "bg-muted/50 text-muted-foreground ring-border/70"

  return (
    <div className="min-w-0 rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <div className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{value}</div>
        </div>
        <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-md ring-1", toneClassName)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-3 truncate text-xs text-muted-foreground">{description}</p>
    </div>
  )
}

export function DashboardClient({ user, initialTab }: DashboardClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentSearch = searchParams.toString()
  const [links, setLinks] = useState<ShortLink[]>([])
  const [loading, setLoading] = useState(true)
  const [linksError, setLinksError] = useState<string | null>(null)
  const [logsDialogOpen, setLogsDialogOpen] = useState(false)
  const [selectedLink, setSelectedLink] = useState<ShortLink | null>(null)
  const [logs, setLogs] = useState<ClickLog[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [logsError, setLogsError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState(getDashboardTab(searchParams.get("tab") ?? initialTab))
  const [page, setPage] = useState(() => getPositivePage(searchParams.get("page")) ?? 1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [pendingDeleteLink, setPendingDeleteLink] = useState<ShortLink | null>(null)
  const [deletingLinkId, setDeletingLinkId] = useState<string | null>(null)
  const [linksReferenceTime, setLinksReferenceTime] = useState<number | null>(null)
  const isDesktop = useMediaQuery("(min-width: 768px)")

  const replaceUrlState = useCallback(
    (next: { tab?: string; page?: number }) => {
      const params = new URLSearchParams(currentSearch)
      const nextTab = next.tab ? getDashboardTab(next.tab) : activeTab
      const nextPage = next.page ?? page

      if (nextTab === "links") {
        params.delete("tab")
      } else {
        params.set("tab", nextTab)
      }

      if (nextTab === "links" && nextPage > 1) {
        params.set("page", String(nextPage))
      } else {
        params.delete("page")
      }

      const query = params.toString()
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    },
    [activeTab, currentSearch, page, pathname, router]
  )

  function handleTabChange(nextTab: string) {
    const normalizedTab = getDashboardTab(nextTab)
    setActiveTab(normalizedTab)
    replaceUrlState({ tab: normalizedTab })
  }

  function handlePageChange(nextPage: number) {
    const normalizedPage = Math.max(1, nextPage)
    setPage(normalizedPage)
    replaceUrlState({ page: normalizedPage })
  }

  const fetchLinks = useCallback(async (currentPage: number, options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setLoading(true)
    }
    setLinksError(null)
    try {
      const res = await fetch(`/api/links?page=${currentPage}&limit=${LINK_PAGE_SIZE}`)
      if (res.ok) {
        const body = await res.json() as {
          data?: ShortLink[]
          total?: number
          page?: number
          limit?: number
          totalPages?: number
        }
        setLinks(body.data || [])
        setTotalPages(body.totalPages || 1)
        setTotalItems(body.total || 0)
        setLinksReferenceTime(Date.now())
      } else {
        const body = await readOptionalJson<{ error?: string }>(res)
        const message = getResponseErrorMessage(body, "加载短链记录失败")
        dashboardReporter.warn("fetch_links_failed_response", { page: currentPage, status: res.status })
        setLinksError(message)
        if (!options?.silent) {
          toast.error(message)
        }
      }
    } catch (error) {
      const message = getUserFacingErrorMessage(error, "加载短链记录失败")
      dashboardReporter.report("fetch_links_failed_exception", error, { page: currentPage })
      setLinksError(message)
      if (!options?.silent) {
        toast.error(message)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    queueMicrotask(() => {
      if (!cancelled) {
        void fetchLinks(page)
      }
    })

    return () => {
      cancelled = true
    }
  }, [fetchLinks, page])

  async function handleDelete(id: string) {
    setDeletingLinkId(id)
    try {
      const res = await fetch(`/api/links/${id}`, { method: "DELETE" })
      if (res.ok) {
        const remainingItems = Math.max(0, totalItems - 1)
        const deleteState = getDeleteSuccessState(links.length - 1, page)

        toast.success("短链已删除")
        setLinks((prev) => prev.filter((l) => l.id !== id))
        setTotalItems(remainingItems)
        setPendingDeleteLink(null)
        if (selectedLink?.id === id) {
          setSelectedLink(null)
          setLogs([])
          setLogsError(null)
          setLogsDialogOpen(false)
        }

        if (deleteState.nextPage !== page) {
          handlePageChange(deleteState.nextPage)
          return
        }

        if (deleteState.shouldRefetch) {
          await fetchLinks(deleteState.nextPage, { silent: true })
        }
      } else {
        const body = await readOptionalJson<{ error?: string }>(res)
        dashboardReporter.warn("delete_link_failed_response", { linkId: id, status: res.status })
        toast.error(getResponseErrorMessage(body, "删除短链失败"))
      }
    } catch (error) {
      dashboardReporter.report("delete_link_failed_exception", error, { linkId: id })
      toast.error(getUserFacingErrorMessage(error, "删除短链失败"))
    } finally {
      setDeletingLinkId(null)
    }
  }

  async function handleViewLogs(link: ShortLink, options?: { openDialog?: boolean }) {
    setSelectedLink(link)
    setLogs([])
    setLogsError(null)
    if (options?.openDialog) {
      setLogsDialogOpen(true)
    }
    setLogsLoading(true)
    try {
      const res = await fetch(`/api/logs/${link.id}`)
      if (res.ok) {
        const body = await res.json()
        setLogs(Array.isArray(body) ? body : (body.data || []))
      } else {
        const body = await readOptionalJson<{ error?: string }>(res)
        const message = getResponseErrorMessage(body, "加载点击日志失败")
        dashboardReporter.warn("view_logs_failed_response", { linkId: link.id, status: res.status })
        setLogsError(message)
        toast.error(message)
      }
    } catch (error) {
      const message = getUserFacingErrorMessage(error, "加载点击日志失败")
      dashboardReporter.report("view_logs_failed_exception", error, { linkId: link.id })
      setLogsError(message)
      toast.error(message)
    } finally {
      setLogsLoading(false)
    }
  }

  async function handleRefreshLinks() {
    await fetchLinks(page)
  }

  async function handleRefreshLogs() {
    if (!selectedLink) {
      return
    }

    await handleViewLogs(selectedLink, { openDialog: logsDialogOpen })
  }

  async function handleCopy(shortUrl: string) {
    try {
      await navigator.clipboard.writeText(shortUrl)
      toast.success("短链已复制")
    } catch {
      toast.error("复制失败，请手动复制")
    }
  }

  async function handleCreated() {
    handlePageChange(1)
    await fetchLinks(1)
  }

  const currentTabMeta = tabMeta[activeTab]
  const CurrentTabIcon = currentTabMeta.icon
  const currentPageClicks = links.reduce((sum, link) => sum + link.clicks, 0)
  const activeLinks = links.filter((link) => !link.isExpired).length
  const expiredLinks = links.length - activeLinks
  const limitedLinks = links.filter((link) => link.hasClickLimit || link.hasExpiration).length
  const expiringSoonLinks = links.filter((link) => {
    if (link.isExpired) return false
    const expiresAt = parseDateTime(link.expiresAt)
    return Boolean(expiresAt && linksReferenceTime && expiresAt.getTime() - linksReferenceTime <= EXPIRING_SOON_MS)
  }).length
  const pageRange = getPageRange(page, totalItems, links.length)
  const selectedLinkLogs = selectedLink ? logs : []
  const selectedLinkBlockedEvents = selectedLinkLogs.filter((log) => log.eventType !== "click").length
  const selectedLinkLimitText =
    selectedLink?.maxClicks == null
      ? "不限"
      : `${selectedLink.clicks} / ${selectedLink.maxClicks}`
  const selectedLinkExpirationText = selectedLink?.expiresAt ? formatDate(selectedLink.expiresAt) : "长期有效"
  const selectedLinkHealth = selectedLink ? getLinkHealth(selectedLink, linksReferenceTime) : null

  const linksWorkspace = (
    <div className="mx-auto w-full max-w-[110rem] space-y-5">
      <section className="overflow-hidden rounded-lg border bg-card">
        <div className="grid gap-5 border-b p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="h-6 gap-1.5 px-2 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                <LayoutDashboard className="h-3 w-3" />
                Workspace
              </Badge>
              <span className="text-xs text-muted-foreground">当前页 {pageRange}</span>
            </div>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">链接运营面板</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                创建入口、链接队列和访问诊断放在同一个工作台里，方便快速判断哪条链接需要复制、检查或回收。
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshLinks}
              disabled={loading}
              className="h-9"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
              刷新队列
            </Button>
          </div>
        </div>

        <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-4">
          <DashboardMetric
            label="全部短链"
            value={totalItems}
            description={totalItems > 0 ? `当前显示 ${pageRange}` : "尚未创建短链"}
            icon={Link2}
          />
          <DashboardMetric
            label="当前页点击"
            value={currentPageClicks}
            description="来自当前分页的点击总和"
            icon={MousePointerClick}
            tone={currentPageClicks > 0 ? "good" : "neutral"}
          />
          <DashboardMetric
            label="有效链接"
            value={`${activeLinks}/${links.length || 0}`}
            description={expiredLinks > 0 ? `${expiredLinks} 条已失效` : "当前页状态正常"}
            icon={CheckCircle2}
            tone={expiredLinks > 0 ? "warning" : "good"}
          />
          <DashboardMetric
            label="规则保护"
            value={limitedLinks}
            description={expiringSoonLinks > 0 ? `${expiringSoonLinks} 条 7 天内到期` : "点击上限或有效期规则"}
            icon={Gauge}
            tone={expiringSoonLinks > 0 ? "warning" : "neutral"}
          />
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(30rem,1.18fr)_minmax(24rem,0.82fr)]">
        <section className="min-w-0 overflow-hidden rounded-lg border bg-card">
          <div className="border-b bg-muted/[0.16] p-4 sm:p-5">
            <ShortLinkCreator
              user={user}
              mode="dashboard"
              surface="embedded"
              onCreated={handleCreated}
            />
          </div>

          <div className="flex min-h-[36rem] flex-col">
            <div className="flex flex-col gap-3 border-b px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div className="min-w-0">
                <h3 className="text-base font-semibold tracking-tight">短链队列</h3>
                <p className="mt-1 text-sm text-muted-foreground">按创建时间排列。选择一条链接后，右侧检查器会同步显示访问日志。</p>
              </div>
              <Badge variant="outline" className="w-fit px-2.5 py-1 text-xs font-medium text-muted-foreground">
                {pageRange}
              </Badge>
            </div>

            <div className="min-h-0 flex-1 overflow-auto">
              {loading ? (
                <div className="grid min-h-80 place-items-center px-6 text-center">
                  <div className="space-y-3">
                    <RefreshCw className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">正在加载短链队列…</p>
                  </div>
                </div>
              ) : linksError ? (
                <div className="grid min-h-80 place-items-center px-6 text-center">
                  <div className="max-w-sm space-y-4">
                    <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-md bg-destructive/10 text-destructive">
                      <AlertTriangle className="h-5 w-5" />
                    </div>
                    <p className="text-sm text-destructive">{linksError}</p>
                    <Button type="button" variant="outline" size="sm" onClick={handleRefreshLinks}>
                      重试
                    </Button>
                  </div>
                </div>
              ) : links.length === 0 ? (
                <div className="grid min-h-80 place-items-center px-6 text-center">
                  <div className="max-w-sm space-y-3">
                    <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-md border bg-muted/30">
                      <Link2 className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-sm font-semibold">{page > 1 ? "这一页没有短链" : "创建台已准备好"}</h3>
                      <p className="text-sm leading-6 text-muted-foreground">
                        {page > 1 ? "返回上一页查看已有记录。" : "粘贴目标地址，生成第一条可管理的短链。"}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  {links.map((link) => {
                    const health = getLinkHealth(link, linksReferenceTime)

                    return (
                      <div
                        key={link.id}
                        className={cn(
                          "group relative border-b px-4 py-4 transition-colors last:border-b-0 hover:bg-muted/25 sm:px-5",
                          selectedLink?.id === link.id && "bg-muted/45"
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <button
                            type="button"
                            onClick={() => void handleViewLogs(link)}
                            className="min-w-0 flex-1 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                          >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0 space-y-1.5">
                                <p className="truncate font-mono text-sm font-semibold text-foreground">
                                  {link.domain}/{link.slug}
                                </p>
                                <p className="line-clamp-1 text-xs text-muted-foreground">{link.originalUrl}</p>
                              </div>
                              <Badge
                                variant="outline"
                                className={cn("h-6 w-fit shrink-0 gap-1.5 px-2 text-[10px] font-medium", health.className)}
                              >
                                <span className={cn("h-1.5 w-1.5 rounded-full", health.dotClassName)} />
                                {health.label}
                              </Badge>
                            </div>
                            <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                              <span className="flex items-center gap-1.5">
                                <MousePointerClick className="h-3.5 w-3.5" />
                                <strong className="font-medium text-foreground">{link.clicks}</strong> 次点击
                              </span>
                              <span className="flex items-center gap-1.5">
                                <Gauge className="h-3.5 w-3.5" />
                                {link.maxClicks == null ? "不限点击" : `上限 ${link.maxClicks}`}
                              </span>
                              <span className="flex min-w-0 items-center gap-1.5">
                                <Clock3 className="h-3.5 w-3.5 shrink-0" />
                                <span className="truncate">{link.expiresAt ? formatDate(link.expiresAt) : "长期有效"}</span>
                              </span>
                            </div>
                          </button>

                          <div className="flex shrink-0 items-center gap-1 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => handleCopy(link.shortUrl)}
                              className="h-8 w-8"
                              aria-label="复制短链"
                              title="复制短链"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => void handleViewLogs(link)}
                              className="h-8 w-8"
                              aria-label="查看详情"
                              title="查看详情"
                            >
                              <PanelRight className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => setPendingDeleteLink(link)}
                              className="h-8 w-8 text-destructive hover:bg-destructive/10"
                              aria-label="删除短链"
                              title="删除短链"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {totalPages > 1 && !linksError && (
              <div className="flex flex-col gap-3 border-t px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <p className="text-xs font-medium text-muted-foreground">页码 {page} / {totalPages}</p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => handlePageChange(page - 1)}
                    className="h-8"
                  >
                    上一页
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => handlePageChange(page + 1)}
                    className="h-8"
                  >
                    下一页
                  </Button>
                </div>
              </div>
            )}
          </div>
        </section>

        <aside className="min-w-0 overflow-hidden rounded-lg border bg-card xl:sticky xl:top-[5.25rem] xl:max-h-[calc(100vh-6.5rem)]">
          {!selectedLink ? (
            <div className="grid min-h-[34rem] place-items-center px-8 text-center">
              <div className="max-w-sm space-y-4">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg border bg-muted/30">
                  <PanelRight className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold">检查器空闲</h3>
                  <p className="text-sm leading-6 text-muted-foreground">
                    从左侧选择短链后，这里会显示目标地址、失效规则、点击概况和最近访问记录。
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex max-h-[inherit] min-h-[34rem] flex-col">
              <div className="space-y-4 border-b p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Inspector</p>
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <h3 className="break-all font-mono text-xl font-semibold leading-tight">{selectedLink.domain}/{selectedLink.slug}</h3>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleCopy(selectedLink.shortUrl)}
                        className="h-7 w-7"
                        aria-label="复制短链"
                        title="复制短链"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">创建于 {formatDate(selectedLink.createdAt)}</p>
                  </div>
                  {selectedLinkHealth && (
                    <Badge variant="outline" className={cn("h-6 shrink-0 gap-1.5 px-2 text-[10px] font-medium", selectedLinkHealth.className)}>
                      <span className={cn("h-1.5 w-1.5 rounded-full", selectedLinkHealth.dotClassName)} />
                      {selectedLinkHealth.label}
                    </Badge>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleCopy(selectedLink.shortUrl)} className="h-8">
                    <Copy className="h-3.5 w-3.5" />
                    复制
                  </Button>
                  <Button variant="outline" size="sm" asChild className="h-8">
                    <a href={selectedLink.shortUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3.5 w-3.5" />
                      打开
                    </a>
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => void handleViewLogs(selectedLink, { openDialog: true })} className="h-8">
                    <BarChart2 className="h-3.5 w-3.5" />
                    展开日志
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPendingDeleteLink(selectedLink)}
                    className="h-8 text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    删除
                  </Button>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-auto p-5">
                <div className="space-y-6">
                  <section className="space-y-3">
                    <h4 className="text-sm font-semibold">生命周期</h4>
                    <dl className="grid gap-3 rounded-lg border bg-muted/[0.12] p-4 text-sm sm:grid-cols-2">
                      <div className="min-w-0 sm:col-span-2">
                        <dt className="text-xs text-muted-foreground">目标链接</dt>
                        <dd className="mt-1 break-all text-foreground">{selectedLink.originalUrl}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">短链域名</dt>
                        <dd className="mt-1 font-mono">{selectedLink.domain}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">后缀</dt>
                        <dd className="mt-1 font-mono">{selectedLink.slug}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">有效期</dt>
                        <dd className="mt-1">{selectedLinkExpirationText}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">点击限制</dt>
                        <dd className="mt-1">{selectedLinkLimitText}</dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt className="text-xs text-muted-foreground">失效原因</dt>
                        <dd className="mt-1">
                          {selectedLink.isExpired
                            ? selectedLink.expiredByClicks
                              ? "达到点击上限"
                              : selectedLink.expiredByDate
                                ? "超过有效期"
                                : "已失效"
                            : "无"}
                        </dd>
                      </div>
                    </dl>
                  </section>

                  <section className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <h4 className="text-sm font-semibold">访问概况</h4>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRefreshLogs}
                        disabled={logsLoading}
                        className="h-8"
                      >
                        <RefreshCw className={cn("h-3.5 w-3.5", logsLoading && "animate-spin")} />
                        刷新
                      </Button>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-lg border bg-background px-3 py-3">
                        <p className="text-xs text-muted-foreground">总点击</p>
                        <p className="mt-1 text-xl font-semibold tabular-nums">{selectedLink.clicks}</p>
                      </div>
                      <div className="rounded-lg border bg-background px-3 py-3">
                        <p className="text-xs text-muted-foreground">日志</p>
                        <p className="mt-1 text-xl font-semibold tabular-nums">{selectedLinkLogs.length}</p>
                      </div>
                      <div className="rounded-lg border bg-background px-3 py-3">
                        <p className="text-xs text-muted-foreground">拦截</p>
                        <p className="mt-1 text-xl font-semibold tabular-nums">{selectedLinkBlockedEvents}</p>
                      </div>
                    </div>
                  </section>

                  <section className="space-y-3">
                    <h4 className="text-sm font-semibold">最近访问日志</h4>
                    {logsLoading ? (
                      <div className="grid h-40 place-items-center rounded-lg border border-dashed bg-muted/5 text-sm text-muted-foreground">
                        正在拉取日志…
                      </div>
                    ) : logsError ? (
                      <div className="flex h-40 flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-destructive/5 px-4 text-center text-sm text-destructive">
                        <p>{logsError}</p>
                        <Button type="button" variant="outline" size="sm" onClick={handleRefreshLogs}>
                          重试
                        </Button>
                      </div>
                    ) : selectedLinkLogs.length === 0 ? (
                      <div className="grid h-40 place-items-center rounded-lg border border-dashed bg-muted/5 px-4 text-center text-sm text-muted-foreground">
                        暂无访问日志。
                      </div>
                    ) : (
                      <div className="overflow-hidden rounded-lg border">
                        <div className="grid grid-cols-[1fr_auto_auto] gap-3 border-b bg-muted/30 px-3 py-2 text-xs font-medium text-muted-foreground">
                          <span>时间 / 来源</span>
                          <span>事件</span>
                          <span>HTTP</span>
                        </div>
                        <div className="divide-y">
                          {selectedLinkLogs.slice(0, 8).map((log) => (
                            <div key={log.id} className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-3 px-3 py-3 text-sm">
                              <div className="min-w-0">
                                <p className="truncate text-xs font-medium">{formatDate(log.createdAt)}</p>
                                <p className="mt-1 truncate text-xs text-muted-foreground">{log.referrer || "直接访问"} · {log.ipAddress || "未知 IP"}</p>
                              </div>
                              <Badge variant="outline" className="h-6 self-center text-[10px]">
                                {getLogEventLabel(log.eventType)}
                              </Badge>
                              <span className="self-center font-mono text-xs text-muted-foreground">{log.statusCode ?? "—"}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </section>
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  )

  return (
    <>
      <SidebarProvider defaultOpen>
        <Sidebar collapsible="icon" variant="inset">
          <SidebarHeader className="gap-1 p-3">
            <Button
              variant="ghost"
              asChild
              className="h-10 justify-start gap-2 px-2 text-sidebar-foreground hover:text-sidebar-foreground"
            >
              <Link href="/" aria-label="返回首页">
                <ArrowLeft className="h-4 w-4" />
                <span className="font-medium">返回首页</span>
              </Link>
            </Button>
          </SidebarHeader>
          <SidebarSeparator />
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>导航</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      type="button"
                      isActive={activeTab === "links"}
                      onClick={() => handleTabChange("links")}
                      tooltip="短链"
                    >
                      <Link2 className="h-4 w-4" />
                      <span>短链</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      type="button"
                      isActive={activeTab === "temp-email"}
                      onClick={() => handleTabChange("temp-email")}
                      tooltip="临时邮箱"
                    >
                      <Mail className="h-4 w-4" />
                      <span>临时邮箱</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      type="button"
                      isActive={activeTab === "api"}
                      onClick={() => handleTabChange("api")}
                      tooltip="API 管理"
                    >
                      <KeyRound className="h-4 w-4" />
                      <span>API</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      type="button"
                      isActive={activeTab === "security"}
                      onClick={() => handleTabChange("security")}
                      tooltip="安全"
                    >
                      <Shield className="h-4 w-4" />
                      <span>安全</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarSeparator />
          <SidebarFooter className="p-3">
            <div className="rounded-xl border bg-sidebar-accent/30 p-2">
              <UserMenu
                user={user}
                layout="panel"
                align="start"
                className="text-sidebar-foreground transition-colors hover:bg-sidebar-accent/50"
              />
            </div>
          </SidebarFooter>
          <SidebarRail />
        </Sidebar>
        <SidebarInset>
          <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur-xl">
            <div className="flex min-h-16 flex-col gap-3 px-[var(--page-gutter)] py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <SidebarTrigger className="-ml-2 h-9 w-9" />
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-card">
                  <CurrentTabIcon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <h1 className="truncate text-sm font-semibold tracking-tight text-foreground">{currentTabMeta.title}</h1>
                  <p className="hidden truncate text-xs text-muted-foreground sm:block">{currentTabMeta.description}</p>
                </div>
              </div>
              <Badge variant="outline" className="hidden h-7 gap-1.5 px-2.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground sm:flex">
                <Activity className="h-3 w-3" />
                Dashboard
              </Badge>
            </div>
          </header>

          <main className="flex-1 px-[var(--page-gutter)] py-5 sm:py-6 lg:py-8">
            {activeTab === "links" && (
              <div className="mx-auto w-full max-w-none">
                {linksWorkspace}
              </div>
            )}

            {activeTab === "temp-email" && (
              <div className="mx-auto w-full max-w-[110rem]">
                <TempEmailManager />
              </div>
            )}
            {activeTab === "security" && (
              <div className="mx-auto w-full max-w-[92rem]">
                <PasskeyManager />
              </div>
            )}
            {activeTab === "api" && (
              <div className="mx-auto w-full max-w-[92rem]">
                <ApiManagementPanel />
              </div>
            )}
          </main>
        </SidebarInset>
      </SidebarProvider>

      <Dialog open={logsDialogOpen} onOpenChange={setLogsDialogOpen}>
        <DialogContent className="flex max-h-[min(92vh,44rem)] w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-xl border p-0 shadow-none sm:max-w-4xl">
          <DialogHeader className="p-5 pb-4 sm:p-6 sm:pb-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <DialogTitle className="text-xl font-bold tracking-tight">点击日志诊断</DialogTitle>
                <DialogDescription className="mt-1.5 text-xs font-medium uppercase tracking-widest text-muted-foreground/60">
                  REAL-TIME TRAFFIC ANALYSIS
                </DialogDescription>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleRefreshLogs} 
                disabled={logsLoading || !selectedLink}
                className="h-9 rounded-xl bg-muted/50 font-bold text-[11px] uppercase tracking-wider"
              >
                <RefreshCw className={`mr-2 h-3.5 w-3.5 ${logsLoading ? "animate-spin" : ""}`} />
                刷新数据
              </Button>
            </div>
            {selectedLink && (
              <div className="mt-4 flex items-center gap-3 rounded-lg border bg-muted/20 p-3">
                <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                <code className="font-mono text-xs font-bold text-primary">
                  {selectedLink.domain}/{selectedLink.slug}
                </code>
              </div>
            )}
          </DialogHeader>

          <div className="flex-1 overflow-auto px-5 pb-5 sm:px-6 sm:pb-6">
            {logsLoading ? (
              <div className="flex h-64 flex-col items-center justify-center space-y-4 text-center">
                <div className="h-8 w-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">正在拉取日志…</p>
              </div>
            ) : logsError ? (
              <div className="flex h-64 flex-col items-center justify-center space-y-4 text-center">
                <p className="text-sm font-bold text-destructive uppercase tracking-widest">{logsError}</p>
                <Button type="button" variant="outline" size="sm" onClick={handleRefreshLogs} className="rounded-xl font-bold">
                  重试请求
                </Button>
              </div>
            ) : logs.length === 0 ? (
              <div className="flex h-64 flex-col items-center justify-center space-y-2 rounded-xl border border-dashed bg-muted/5 text-center text-muted-foreground">
                <Zap className="h-8 w-8 text-muted-foreground/30 mb-2" />
                <p className="text-sm font-bold uppercase tracking-widest">暂无记录</p>
                <p className="text-xs">该链接尚未产生任何点击事件</p>
              </div>
            ) : isDesktop ? (
              <div className="overflow-hidden rounded-xl border bg-card">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow className="hover:bg-transparent border-none">
                      <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider">时间戳</TableHead>
                      <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider">事件类型</TableHead>
                      <TableHead className="h-10 text-center text-[10px] font-bold uppercase tracking-wider">HTTP</TableHead>
                      <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider">来源渠道 (Referrer)</TableHead>
                      <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider text-right pr-6">访问信息</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id} className="group/row transition-colors hover:bg-muted/20">
                        <TableCell className="whitespace-nowrap py-4 text-[11px] font-medium text-muted-foreground tabular-nums">
                          {formatDate(log.createdAt)}
                        </TableCell>
                        <TableCell className="py-4">
                          <Badge 
                            variant="outline" 
                            className={`rounded-lg border-none px-2 py-0.5 text-[10px] font-bold uppercase ${
                              log.eventType === "click" ? "bg-emerald-500/10 text-emerald-600" :
                              log.eventType === "blocked" ? "bg-rose-500/10 text-rose-600" : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {getLogEventLabel(log.eventType)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center py-4 font-mono text-[11px] font-bold text-muted-foreground/60">
                          {log.statusCode ?? "—"}
                        </TableCell>
                        <TableCell className="max-w-[200px] py-4">
                          <p className="truncate text-[11px] font-medium">
                            {log.referrer || <span className="text-muted-foreground/40 italic">DIRECT</span>}
                          </p>
                        </TableCell>
                        <TableCell className="text-right pr-6 py-4">
                          <div className="space-y-0.5">
                            <p className="text-[11px] font-bold tabular-nums text-foreground/80">{log.ipAddress || "0.0.0.0"}</p>
                            <p className="truncate text-[9px] font-bold uppercase tracking-tighter text-muted-foreground/40">
                              {log.userAgent?.split(" ").slice(-1)[0] || "UNKNOWN"}
                            </p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="space-y-3">
                {logs.map((log) => (
                  <div key={log.id} className="space-y-4 rounded-xl border bg-card p-4">
                    <div className="flex items-center justify-between border-b pb-3">
                      <Badge variant="outline" className="text-[10px] font-bold uppercase bg-muted/50">
                        {getLogEventLabel(log.eventType)}
                      </Badge>
                      <span className="text-[10px] font-bold tabular-nums text-muted-foreground">{formatDate(log.createdAt)}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-[11px]">
                      <div>
                        <p className="font-bold text-muted-foreground uppercase tracking-widest text-[9px] mb-1">Status</p>
                        <p className="font-mono font-bold">{log.statusCode ?? "—"}</p>
                      </div>
                      <div>
                        <p className="font-bold text-muted-foreground uppercase tracking-widest text-[9px] mb-1">Origin</p>
                        <p className="truncate">{log.referrer || "DIRECT"}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="font-bold text-muted-foreground uppercase tracking-widest text-[9px] mb-1">Network Info</p>
                        <p className="font-mono">{log.ipAddress || "—"}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!pendingDeleteLink} onOpenChange={(open) => !open && setPendingDeleteLink(null)}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-sm rounded-xl border p-6 text-center shadow-none sm:p-8">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
            <Trash2 className="h-7 w-7" />
          </div>
          <DialogHeader className="items-center">
            <DialogTitle className="text-xl font-bold tracking-tight text-foreground">确认彻底移除？</DialogTitle>
            <DialogDescription className="mt-2 text-sm leading-relaxed text-muted-foreground">
              此操作将销毁该短链及其所有统计数据。
              {pendingDeleteLink && (
                <span className="mt-4 block rounded-xl bg-muted/50 p-3 font-mono text-xs font-bold text-foreground">
                  {pendingDeleteLink.domain}/{pendingDeleteLink.slug}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-8 grid grid-cols-2 gap-3">
            <Button variant="ghost" onClick={() => setPendingDeleteLink(null)} disabled={!!deletingLinkId} className="h-11 rounded-lg bg-muted/30 text-[11px] font-bold uppercase tracking-widest">
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => pendingDeleteLink && handleDelete(pendingDeleteLink.id)}
              disabled={!!deletingLinkId}
              className="h-11 rounded-lg text-[11px] font-bold uppercase tracking-widest"
            >
              {deletingLinkId ? "同步中…" : "确定销毁"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
