"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  createClientErrorReporter,
  getResponseErrorMessage,
  getUserFacingErrorMessage,
  readOptionalJson,
} from "@/lib/client-feedback"
import { formatDate } from "@/lib/utils"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { Copy, Download, KeyRound, MailPlus, ShieldCheck, Trash2 } from "lucide-react"

interface ApiKeyRecord {
  id: string
  name: string
  keyPrefix: string
  lastUsedAt: string | number | null
  createdAt: string | number
}

interface ApiKeysResponse {
  data: ApiKeyRecord[]
}

interface DomainsResponse {
  emailDomains: Array<{
    host: string
    isDefault: boolean
  }>
  shortDomains: Array<{
    host: string
    isDefault: boolean
  }>
  telegramBotUsername?: string
}

function maskPrefix(prefix: string): string {
  return `${prefix}****************`
}

const apiManagementReporter = createClientErrorReporter("api_management")
const apiTabs = new Set(["keys", "docs", "bitwarden", "sharex"])

function normalizeApiTab(value: string | null) {
  return value && apiTabs.has(value) ? value : "keys"
}

export function ApiManagementPanel() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const activeTab = normalizeApiTab(searchParams.get("apiTab"))
  const [loading, setLoading] = useState(true)
  const [keys, setKeys] = useState<ApiKeyRecord[]>([])
  const [keyName, setKeyName] = useState("")
  const [creating, setCreating] = useState(false)
  const [deletingKeyId, setDeletingKeyId] = useState<string | null>(null)
  const [pendingDeleteKey, setPendingDeleteKey] = useState<ApiKeyRecord | null>(null)
  const [latestPlainKey, setLatestPlainKey] = useState<string | null>(null)
  const [sharexApiKey, setSharexApiKey] = useState("")
  const [emailDomains, setEmailDomains] = useState<string[]>([])
  const [shortDomains, setShortDomains] = useState<string[]>([])
  const [telegramBotUsername, setTelegramBotUsername] = useState("")

  const fetchKeys = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/v1/keys")
      if (!res.ok) {
        const body = await readOptionalJson<{ error?: string }>(res)
        apiManagementReporter.warn("fetch_keys_failed_response", { status: res.status })
        toast.error(getResponseErrorMessage(body, "加载 API Key 失败"))
        return
      }
      const body = await res.json() as ApiKeysResponse
      setKeys(body.data || [])
    } catch (error) {
      apiManagementReporter.report("fetch_keys_failed_exception", error)
      toast.error(getUserFacingErrorMessage(error, "加载 API Key 失败"))
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchDomains = useCallback(async () => {
    try {
      const res = await fetch("/api/domains")
      if (!res.ok) {
        return
      }
      const body = await res.json() as DomainsResponse
      setEmailDomains((body.emailDomains || []).map((item) => item.host))
      setShortDomains((body.shortDomains || []).map((item) => item.host))
      setTelegramBotUsername((body.telegramBotUsername || "").trim())
    } catch {
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    queueMicrotask(() => {
      if (cancelled) {
        return
      }

      void fetchKeys()
      void fetchDomains()
    })

    return () => {
      cancelled = true
    }
  }, [fetchDomains, fetchKeys])

  function handleTabChange(value: string) {
    const nextTab = normalizeApiTab(value)
    const params = new URLSearchParams(searchParams.toString())
    if (nextTab === "keys") {
      params.delete("apiTab")
    } else {
      params.set("apiTab", nextTab)
    }

    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  const apiBaseUrl = useMemo(() => {
    const envBase = process.env.NEXT_PUBLIC_APP_URL?.trim()
    if (envBase) {
      return envBase.replace(/\/+$/, "")
    }
    if (typeof window === "undefined") return ""
    return window.location.origin
  }, [])

  const sharexConfig = useMemo(() => {
    const endpoint = `${apiBaseUrl}/v1/shorten`
    return JSON.stringify({
      Version: "17.0.0",
      Name: "Shortly URL Shortener",
      DestinationType: "URLShortener",
      RequestMethod: "POST",
      RequestURL: endpoint,
      Headers: {
        Authorization: `Bearer ${sharexApiKey || "YOUR_API_KEY"}`,
      },
      Body: "JSON",
      Data: "{\"url\":\"$input$\"}",
      URL: "$json:shortUrl$",
      DeletionURL: "",
      ErrorMessage: "$json:error$",
    }, null, 2)
  }, [apiBaseUrl, sharexApiKey])

  const shortenEndpoint = `${apiBaseUrl || "https://your-domain.com"}/v1/shorten`
  const emailsEndpoint = `${apiBaseUrl || "https://your-domain.com"}/v1/emails`
  const normalizedTelegramBotUsername = telegramBotUsername.replace(/^@+/, "")
  const telegramBotHandle = normalizedTelegramBotUsername ? `@${normalizedTelegramBotUsername}` : ""
  const telegramBindCommand = `/setkey ${latestPlainKey || "YOUR_API_KEY"}`
  const sampleEmailDomain = emailDomains[0] || "mail.example.com"
  const sampleEmailAddress = `demo@${sampleEmailDomain}`
  const bitwardenServerUrl = apiBaseUrl || "https://your-domain.com"
  const bitwardenAliasEndpoint = `${bitwardenServerUrl}/api/v1/aliases`
  const bitwardenApiToken = latestPlainKey || "YOUR_API_KEY"
  const gettingStartedCommand = `curl -X POST '${shortenEndpoint}' \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: Bearer YOUR_API_KEY' \\
  -d '{
    "url": "https://example.com/long-page"
  }'`
  const advancedShortenCommand = `curl -X POST '${shortenEndpoint}' \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: Bearer YOUR_API_KEY' \\
  -d '{
    "url": "https://example.com/long-page",
    "customSlug": "my-custom-slug",
    "maxClicks": 100,
    "expiresIn": "1m"
  }'`
  const createMailboxCommand = `curl -X POST '${emailsEndpoint}' \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: Bearer YOUR_API_KEY' \\
  -d '{
    "emailAddress": "${sampleEmailAddress}"
  }'`
  const listMailboxMessagesCommand = `curl '${emailsEndpoint}/MAILBOX_ID/messages?page=1&limit=20' \\
  -H 'Authorization: Bearer YOUR_API_KEY'`
  const bitwardenAliasCommand = `curl -X POST '${bitwardenAliasEndpoint}' \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: Bearer ${bitwardenApiToken}' \\
  -H 'X-Requested-With: XMLHttpRequest' \\
  -d '{
    "domain": "${sampleEmailDomain}",
    "description": "Website: example.com. Generated by Bitwarden."
  }'`
  async function handleCreateKey() {
    setCreating(true)
    try {
      const res = await fetch("/v1/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: keyName.trim() || undefined,
        }),
      })
      const body = await readOptionalJson<{ error?: string; plainKey?: string }>(res)
      if (!res.ok) {
        apiManagementReporter.warn("create_key_failed_response", { status: res.status })
        toast.error(getResponseErrorMessage(body, "创建 API Key 失败"))
        return
      }

      const plainKey = body?.plainKey
      if (plainKey) {
        setLatestPlainKey(plainKey)
        setSharexApiKey(plainKey)
      }

      setKeyName("")
      toast.success("API Key 已创建")
      await fetchKeys()
    } catch (error) {
      apiManagementReporter.report("create_key_failed_exception", error)
      toast.error(getUserFacingErrorMessage(error, "创建 API Key 失败"))
    } finally {
      setCreating(false)
    }
  }

  async function handleDeleteKey(id: string) {
    setDeletingKeyId(id)
    try {
      const res = await fetch(`/v1/keys/${id}`, { method: "DELETE" })
      if (!res.ok) {
        const body = await readOptionalJson<{ error?: string }>(res)
        apiManagementReporter.warn("delete_key_failed_response", { keyId: id, status: res.status })
        toast.error(getResponseErrorMessage(body, "删除 API Key 失败"))
        return
      }

      setKeys((prev) => prev.filter((item) => item.id !== id))
      setPendingDeleteKey(null)
      toast.success("API Key 已删除")
    } catch (error) {
      apiManagementReporter.report("delete_key_failed_exception", error, { keyId: id })
      toast.error(getUserFacingErrorMessage(error, "删除 API Key 失败"))
    } finally {
      setDeletingKeyId(null)
    }
  }

  async function handleCopy(text: string, message = "已复制") {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(message)
    } catch (error) {
      apiManagementReporter.report("copy_failed_exception", error)
      toast.error(getUserFacingErrorMessage(error, "复制失败，请手动复制"))
    }
  }

  function handleDownloadShareXConfig() {
    const blob = new Blob([sharexConfig], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "shortly-sharex.sxcu"
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
    <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6 sm:space-y-8">
      <TabsList>
        <TabsTrigger value="keys">API Key</TabsTrigger>
        <TabsTrigger value="docs">接口示例</TabsTrigger>
        <TabsTrigger value="bitwarden">Bitwarden</TabsTrigger>
        <TabsTrigger value="sharex">ShareX</TabsTrigger>
      </TabsList>

      <TabsContent value="keys" className="mt-4 space-y-8 sm:mt-6 sm:space-y-10">
        {/* Create Key Section */}
        <div className="grid gap-6 xl:grid-cols-[22rem_minmax(0,1fr)] 2xl:grid-cols-[24rem_minmax(0,1fr)]">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-primary" />
              <h2 className="text-lg font-semibold tracking-tight">管理密钥</h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              API 密钥允许你在其他应用程序中使用 Shortly 的功能。为了安全起见，完整的 Key 只会在创建时显示一次。
            </p>
          </div>

          <div className="space-y-8">
            <section className="space-y-4 rounded-xl border bg-card p-4 sm:p-5">
              <h3 className="text-sm font-semibold text-foreground/80 lowercase tracking-wider">NEW KEY</h3>
              <div className="flex flex-col gap-2 sm:flex-row">
                <label htmlFor="api-key-name" className="sr-only">
                  密钥名称
                </label>
                <Input
                  id="api-key-name"
                  name="apiKeyName"
                  placeholder="密钥名称（可选）…"
                  autoComplete="off"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  maxLength={60}
                  className="h-10"
                />
                <Button onClick={handleCreateKey} disabled={creating} className="h-10 whitespace-nowrap px-6">
                  {creating ? "正在生成…" : "生成新密钥"}
                </Button>
              </div>
              
              {latestPlainKey && (
                <div className="mt-4 space-y-3 rounded-lg border border-primary/20 bg-primary/[0.02] p-4">
                   <div className="flex items-center justify-between gap-4">
                     <p className="text-xs font-bold text-primary uppercase tracking-widest">请立即复制</p>
                     <Badge variant="outline" className="bg-primary/5 text-[10px] font-mono border-primary/10">Secret</Badge>
                   </div>
                   <div className="flex items-center gap-2 rounded-lg bg-background p-3 border">
                     <code className="min-w-0 flex-1 break-all font-mono text-sm font-medium">{latestPlainKey}</code>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleCopy(latestPlainKey, "API Key 已复制")}
                        className="h-8 w-8 text-primary hover:bg-primary/5"
                        aria-label="复制新 API Key"
                        title="复制新 API Key"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                   </div>
                </div>
              )}
            </section>

            {telegramBotHandle && (
              <section className="space-y-4 rounded-xl border border-dashed bg-muted/5 p-4 sm:p-5">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  <h3 className="text-sm font-semibold">Telegram 联动</h3>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  在 Telegram 中搜索 {telegramBotHandle} 并发送以下绑定命令，即可通过 TG 机器人直接创建短链和管理邮箱。
                </p>
                <div className="flex items-center gap-2 rounded-xl border bg-background p-3">
                  <code className="min-w-0 flex-1 break-all font-mono text-xs text-foreground/70">{telegramBindCommand}</code>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 rounded-lg text-xs font-bold"
                    onClick={() => handleCopy(telegramBindCommand, "绑定命令已复制")}
                  >
                    复制
                  </Button>
                </div>
              </section>
            )}
            
            {/* Keys Table/List */}
            <section className="space-y-4">
               <div className="flex items-center justify-between px-1">
                 <h3 className="text-sm font-bold text-muted-foreground/80 uppercase tracking-widest">ACTIVE KEYS</h3>
                 {!loading && keys.length > 0 && (
                   <span className="text-[10px] font-bold tabular-nums text-muted-foreground">{keys.length} UNITS</span>
                 )}
               </div>

               {loading ? (
                  <div className="flex h-32 items-center justify-center rounded-xl border border-dashed bg-muted/5 text-sm text-muted-foreground">正在同步密钥…</div>
                ) : keys.length === 0 ? (
                  <div className="flex h-32 items-center justify-center rounded-xl border border-dashed bg-muted/5 text-sm text-muted-foreground">目前没有活跃的密钥。</div>
                ) : (
                  <div className="grid gap-3">
                    {keys.map((item) => (
                      <div key={item.id} className="group relative rounded-xl border bg-card p-4 transition-colors hover:border-primary/20 sm:p-5">
                        <div className="flex items-start justify-between gap-4">
                           <div className="min-w-0 space-y-3">
                             <div>
                               <p className="truncate text-sm font-bold">{item.name || "未命名密钥"}</p>
                               <p className="mt-1 font-mono text-[11px] text-muted-foreground tracking-tighter">
                                 {maskPrefix(item.keyPrefix)}
                               </p>
                             </div>
                             <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
                               <span>LAST USED: {item.lastUsedAt ? formatDate(item.lastUsedAt) : "NEVER"}</span>
                               <span>CREATED: {formatDate(item.createdAt)}</span>
                             </div>
                           </div>
                           <Button
                              variant="ghost"
                              size="icon-sm"
                              className="h-8 w-8 text-destructive opacity-100 transition-opacity hover:bg-destructive/10 sm:opacity-0 sm:group-hover:opacity-100"
                              onClick={() => setPendingDeleteKey(item)}
                              disabled={deletingKeyId === item.id}
                              aria-label={`删除 API Key ${item.name || item.keyPrefix}`}
                              title="删除 API Key"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
            </section>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="docs" className="mt-4 space-y-8 sm:mt-6 sm:space-y-10">
        <div className="grid gap-6 xl:grid-cols-[22rem_minmax(0,1fr)] 2xl:grid-cols-[24rem_minmax(0,1fr)]">
          <div className="space-y-4 px-1">
            <h2 className="text-xl font-bold tracking-tight">API 端点示例</h2>
            <div className="space-y-1.5">
               <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Base Domains</p>
               <div className="space-y-3 rounded-lg border bg-muted/10 p-4">
                 <div>
                   <p className="text-[10px] font-bold text-muted-foreground mb-1 uppercase">Emails</p>
                   <p className="font-mono text-xs break-all text-primary">{emailDomains.join(", ") || "-"}</p>
                 </div>
                 <div>
                   <p className="text-[10px] font-bold text-muted-foreground mb-1 uppercase">Short Links</p>
                   <p className="font-mono text-xs break-all text-primary">{shortDomains.join(", ") || "-"}</p>
                 </div>
               </div>
            </div>
          </div>

          <div className="space-y-8">
            {[
              { title: "URL 短链演示", cmd: gettingStartedCommand, desc: "快速创建短链的 POST 请求。" },
              { title: "短链进阶配置", cmd: advancedShortenCommand, desc: "包含自定义别名、点击上限和过期时间的请求。" },
              { title: "创建临时邮箱", cmd: createMailboxCommand, desc: "初始化一个新的收件箱地址。" },
              { title: "获取邮件列表", cmd: listMailboxMessagesCommand, desc: "列出指定邮箱收到的所有消息。" }
            ].map((example, i) => (
              <section key={i} className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-widest">{example.title}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">{example.desc}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleCopy(example.cmd)} className="h-8 rounded-lg text-xs font-bold">
                    <Copy className="mr-2 h-3.5 w-3.5" /> 复制
                  </Button>
                </div>
                <div className="relative group">
                  <div className="absolute top-0 right-0 h-full w-4 bg-gradient-to-l from-background pointer-events-none" />
                  <pre className="overflow-x-auto rounded-xl border bg-black/[0.02] p-4 font-mono text-[11px] leading-relaxed text-foreground/80 break-all whitespace-pre-wrap sm:p-5">
                    {example.cmd}
                  </pre>
                </div>
              </section>
            ))}
          </div>
        </div>
      </TabsContent>

      <TabsContent value="bitwarden" className="mt-4 space-y-8 sm:mt-6 sm:space-y-10">
        <div className="grid gap-6 xl:grid-cols-[22rem_minmax(0,1fr)] 2xl:grid-cols-[24rem_minmax(0,1fr)]">
          <div className="space-y-4 px-1">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <h2 className="text-xl font-bold tracking-tight">Bitwarden 别名生成</h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Shortly 提供 Addy.io 兼容接口，Bitwarden 生成用户名时可以直接创建一个新的临时邮箱别名。
            </p>
            <div className="space-y-3 rounded-xl border bg-muted/10 p-4">
              <div>
                <p className="mb-1 text-[10px] font-bold uppercase text-muted-foreground">Server URL</p>
                <div className="flex items-center gap-2">
                  <code className="min-w-0 flex-1 break-all font-mono text-xs text-primary">{bitwardenServerUrl}</code>
                  <Button variant="ghost" size="icon-sm" className="h-8 w-8" onClick={() => handleCopy(bitwardenServerUrl, "Server URL 已复制")} aria-label="复制 Server URL" title="复制 Server URL">
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div>
                <p className="mb-1 text-[10px] font-bold uppercase text-muted-foreground">Domain Name</p>
                <div className="flex items-center gap-2">
                  <code className="min-w-0 flex-1 break-all font-mono text-xs text-primary">{sampleEmailDomain}</code>
                  <Button variant="ghost" size="icon-sm" className="h-8 w-8" onClick={() => handleCopy(sampleEmailDomain, "邮箱域名已复制")} aria-label="复制邮箱域名" title="复制邮箱域名">
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div>
                <p className="mb-1 text-[10px] font-bold uppercase text-muted-foreground">API Access Token</p>
                <div className="flex items-center gap-2">
                  <code className="min-w-0 flex-1 break-all font-mono text-xs text-primary">{bitwardenApiToken}</code>
                  <Button variant="ghost" size="icon-sm" className="h-8 w-8" onClick={() => handleCopy(bitwardenApiToken, "API Access Token 已复制")} aria-label="复制 API Access Token" title="复制 API Access Token">
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-8">
            <section className="space-y-4">
              <div className="flex items-center gap-2 px-1">
                <MailPlus className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-bold uppercase tracking-widest">Bitwarden 设置步骤</h3>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  {
                    step: "01",
                    title: "打开生成器",
                    desc: "在 Bitwarden 中进入生成器，将类型切换为「用户名」，再选择「转发的电子邮件别名」。",
                  },
                  {
                    step: "02",
                    title: "选择 Addy.io",
                    desc: "服务选择 Addy.io，邮箱域名填写左侧的 Domain Name。",
                  },
                  {
                    step: "03",
                    title: "填入密钥",
                    desc: "API 密钥填写 Shortly API Key；如果刚创建过密钥，左侧会显示完整 token。",
                  },
                  {
                    step: "04",
                    title: "指定服务器",
                    desc: "Server URL 填写左侧地址，随后点击重新生成用户名即可创建别名。",
                  },
                ].map((item) => (
                  <div key={item.step} className="rounded-xl border bg-card p-4">
                    <p className="mb-3 font-mono text-[10px] font-bold text-primary">{item.step}</p>
                    <h4 className="text-sm font-bold">{item.title}</h4>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{item.desc}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-widest">兼容接口测试</h3>
                  <p className="mt-1 text-xs text-muted-foreground">Bitwarden 会调用同一个 Addy.io 兼容端点。</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => handleCopy(bitwardenAliasCommand)} className="h-8 rounded-lg text-xs font-bold">
                  <Copy className="mr-2 h-3.5 w-3.5" /> 复制
                </Button>
              </div>
              <pre className="overflow-x-auto rounded-xl border bg-black/[0.02] p-4 font-mono text-[11px] leading-relaxed text-foreground/80 break-all whitespace-pre-wrap sm:p-5">
                {bitwardenAliasCommand}
              </pre>
            </section>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="sharex" className="mt-4 sm:mt-6">
        <div className="grid gap-6 xl:grid-cols-[22rem_minmax(0,1fr)] 2xl:grid-cols-[24rem_minmax(0,1fr)]">
          <div className="space-y-4 px-1">
            <h2 className="text-xl font-bold tracking-tight">ShareX 集成</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              针对 Windows 用户的 ShareX 图片/链接同步神器。下载以下 sxcu 配置文件并导入 ShareX 即可使用。
            </p>
            <div className="pt-4">
              <label htmlFor="sharex-api-key" className="sr-only">
                ShareX API Key
              </label>
              <Input
                id="sharex-api-key"
                name="sharexApiKey"
                placeholder="在此粘贴你的 API Key 以填充配置…"
                autoComplete="off"
                spellCheck={false}
                value={sharexApiKey}
                onChange={(e) => setSharexApiKey(e.target.value.trim())}
                className="h-10 border-primary/20 bg-primary/5 placeholder:text-primary/40"
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button onClick={handleDownloadShareXConfig} className="h-10 font-bold">
                <Download className="mr-2 h-4 w-4" /> 下载配置
              </Button>
              <Button variant="outline" onClick={() => handleCopy(sharexConfig)} className="h-10 font-bold border-dashed">
                <Copy className="mr-2 h-4 w-4" /> 复制 JSON
              </Button>
            </div>
          </div>

          <div className="space-y-4">
             <div className="flex items-center justify-between px-1">
               <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Configuration Preview</h3>
             </div>
             <pre className="max-h-[30rem] overflow-auto rounded-xl border bg-black/[0.02] p-4 font-mono text-[10px] leading-normal text-muted-foreground/80 sm:p-6">
                {sharexConfig}
             </pre>
          </div>
        </div>
      </TabsContent>
    </Tabs>

      <Dialog open={!!pendingDeleteKey} onOpenChange={(open) => !open && setPendingDeleteKey(null)}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md">
          <DialogHeader>
            <DialogTitle>确认删除这个 API Key？</DialogTitle>
            <DialogDescription>
              删除后使用该密钥的外部集成会立即失效。
              {pendingDeleteKey && (
                <span className="mt-2 block break-all font-mono text-xs text-muted-foreground">
                  {pendingDeleteKey.name || maskPrefix(pendingDeleteKey.keyPrefix)}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDeleteKey(null)} disabled={!!deletingKeyId}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => pendingDeleteKey && handleDeleteKey(pendingDeleteKey.id)}
              disabled={!!deletingKeyId}
            >
              {deletingKeyId ? "删除中…" : "删除 API Key"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
