"use client"

import { useState } from "react"
import { authClient } from "@/lib/auth-client"
import { createClientErrorReporter, getUserFacingErrorMessage } from "@/lib/client-feedback"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn, formatDate } from "@/lib/utils"
import { toast } from "sonner"
import { AlertTriangle, CheckCircle2, Copy, KeyRound, Loader2, MonitorSmartphone, Plus, ShieldCheck, Trash2 } from "lucide-react"
import {
  ConsoleKicker,
  ConsoleMetric,
  ConsoleStatusBadge,
  consoleInsetClassName,
  consoleSurfaceClassName,
} from "@/components/dashboard/console-ui"

const passkeyReporter = createClientErrorReporter("passkey")
const passkeyNameDateFormatter = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

function getPasskeyErrorMessage(error: unknown) {
  const message = getUserFacingErrorMessage(error, "")
  const normalizedMessage = message.toLowerCase()

  if (!message) {
    return "暂时无法完成通行密钥操作，请稍后重试。"
  }

  if (
    normalizedMessage.includes("notallowederror") ||
    normalizedMessage.includes("the operation either timed out or was not allowed") ||
    normalizedMessage.includes("timed out") ||
    normalizedMessage.includes("cancel")
  ) {
    return "你已取消本次通行密钥操作，未做任何更改。"
  }

  if (
    normalizedMessage.includes("notsupportederror") ||
    normalizedMessage.includes("not supported") ||
    normalizedMessage.includes("publickeycredential is not defined")
  ) {
    return "当前浏览器或设备暂不支持通行密钥。"
  }

  if (
    normalizedMessage.includes("securityerror") ||
    normalizedMessage.includes("security") ||
    normalizedMessage.includes("https") ||
    normalizedMessage.includes("rp id")
  ) {
    return "当前环境不满足通行密钥安全要求，请确认正在使用受信任的 HTTPS 域名。"
  }

  if (
    normalizedMessage.includes("invalidstateerror") ||
    normalizedMessage.includes("already registered") ||
    normalizedMessage.includes("duplicate")
  ) {
    return "这个设备上的通行密钥已经添加过了，无需重复创建。"
  }

  return "暂时无法完成通行密钥操作，请稍后重试。"
}

export function PasskeyManager() {
  const { data: passkeys, isPending, refetch } = authClient.useListPasskeys()
  const [loadingAdd, setLoadingAdd] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [pendingDeletePasskey, setPendingDeletePasskey] = useState<{
    id: string
    name?: string
    credentialID: string
  } | null>(null)

  const supportsPasskey =
    typeof window !== "undefined" && typeof window.PublicKeyCredential !== "undefined"

  async function handleAddPasskey() {
    setLoadingAdd(true)
    try {
      const res = await authClient.passkey.addPasskey({
        name: `${navigator.platform} - ${passkeyNameDateFormatter.format(new Date())}`,
      })
      if (res?.error) {
        passkeyReporter.warn("add_failed_response", { error: res.error })
        toast.error(getPasskeyErrorMessage(res.error))
      } else {
        toast.success("通行密钥已添加")
        refetch()
      }
    } catch (error) {
      passkeyReporter.report("add_failed_exception", error)
      toast.error(getPasskeyErrorMessage(error))
    } finally {
      setLoadingAdd(false)
    }
  }

  async function handleDeletePasskey(id: string) {
    setDeleteId(id)
    try {
      const res = await authClient.passkey.deletePasskey({ id })
      if (res?.error) {
        passkeyReporter.warn("delete_failed_response", { passkeyId: id, error: res.error })
        toast.error("删除通行密钥失败，请稍后重试。")
      } else {
        toast.success("通行密钥已删除")
        setPendingDeletePasskey(null)
        refetch()
      }
    } catch (error) {
      passkeyReporter.report("delete_failed_exception", error, { passkeyId: id })
      toast.error("删除通行密钥失败，请稍后重试。")
    } finally {
      setDeleteId(null)
    }
  }

  async function handleCopyCredentialId(credentialId: string) {
    try {
      await navigator.clipboard.writeText(credentialId)
      toast.success("通行密钥 ID 已复制")
    } catch (error) {
      passkeyReporter.report("copy_credential_id_failed_exception", error)
      toast.error("复制失败，请手动复制")
    }
  }

  const passkeyCount = passkeys?.length ?? 0
  const backedUpCount = passkeys?.filter((pk: { backedUp: boolean }) => pk.backedUp).length ?? 0
  const securityState = !supportsPasskey
    ? "当前设备不支持"
    : isPending
      ? "正在同步"
      : passkeyCount > 0
        ? "已启用"
        : "建议启用"

  return (
    <div className="space-y-5">
      <section className={cn(consoleSurfaceClassName, "overflow-hidden")}>
        <div className="flex flex-col gap-4 p-5 shadow-[0_1px_0_0_rgba(0,0,0,0.08)] sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 space-y-1">
            <ConsoleKicker>Credential control</ConsoleKicker>
            <h2 className="text-xl font-semibold sm:text-2xl">安全凭证控制台</h2>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              查看当前设备是否支持通行密钥，管理已注册凭证，并确认哪些密钥已完成云端备份。
            </p>
          </div>
          {supportsPasskey && (
            <Button onClick={handleAddPasskey} disabled={loadingAdd || isPending} className="h-10 w-full px-5 sm:w-auto">
              {loadingAdd ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              添加通行密钥
            </Button>
          )}
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-3 sm:p-5">
          <ConsoleMetric
            label="安全状态"
            value={securityState}
            description={supportsPasskey ? "可使用设备验证登录" : "需要 HTTPS 与兼容浏览器"}
            icon={supportsPasskey ? ShieldCheck : AlertTriangle}
            tone={!supportsPasskey ? "warning" : passkeyCount > 0 ? "good" : "neutral"}
          />
          <ConsoleMetric
            label="已注册密钥"
            value={isPending ? "同步中" : passkeyCount}
            description="至少保留一枚常用设备密钥"
            icon={KeyRound}
            tone={passkeyCount > 0 ? "good" : "neutral"}
          />
          <ConsoleMetric
            label="备份覆盖"
            value={isPending ? "同步中" : backedUpCount}
            description="显示已由平台标记备份的凭证"
            icon={CheckCircle2}
            tone={backedUpCount > 0 ? "good" : "neutral"}
          />
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[22rem_minmax(0,1fr)] 2xl:grid-cols-[24rem_minmax(0,1fr)]">
        <aside className={cn(consoleSurfaceClassName, "p-5")}>
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-base font-semibold">登录保护</h3>
          </div>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            通行密钥使用指纹、面容或设备密码完成登录。添加后，完整凭证仍保存在你的设备或平台账户中。
          </p>
          <div className={cn(consoleInsetClassName, "mt-5 space-y-3 p-4 text-sm")}>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">浏览器支持</span>
              <ConsoleStatusBadge label={supportsPasskey ? "可用" : "不可用"} tone={supportsPasskey ? "good" : "warning"} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">列表同步</span>
              <ConsoleStatusBadge label={isPending ? "同步中" : "完成"} tone={isPending ? "neutral" : "good"} />
            </div>
          </div>
        </aside>

        <section className={cn(consoleSurfaceClassName, "space-y-4 p-4 sm:p-5")}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-base font-semibold">凭证账本</h3>
              <p className="mt-1 text-xs text-muted-foreground">复制 credential ID 或移除不再使用的设备。</p>
            </div>
            {!isPending && passkeyCount > 0 && (
              <ConsoleStatusBadge label={`${passkeyCount} keys`} tone="accent" className="shrink-0" />
            )}
          </div>

          {!supportsPasskey ? (
          <div className="flex min-h-40 items-center justify-center rounded-lg border border-dashed bg-muted/5 px-6 text-center text-sm text-muted-foreground">
            当前浏览器或设备环境暂不支持通行密钥。
          </div>
        ) : isPending ? (
          <div className="flex min-h-40 items-center justify-center rounded-lg border border-dashed bg-muted/5 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin text-[#0072F5]" />
            正在载入密钥列表…
          </div>
        ) : !passkeys?.length ? (
          <div className="flex min-h-40 items-center justify-center rounded-lg border border-dashed bg-muted/5 p-6 text-center text-sm text-muted-foreground">
            你还没有添加任何通行密钥。为了账户安全，建议优先使用此登录方式。
          </div>
        ) : (
          <div className="grid gap-3">
            {passkeys.map((pk: { id: string; name?: string; backedUp: boolean; credentialID: string; createdAt: Date }) => (
              <div key={pk.id} className={cn(consoleInsetClassName, "group relative bg-background p-4 transition-colors hover:bg-muted/[0.16] sm:p-5")}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/40 shadow-[0_0_0_1px_rgba(0,0,0,0.08)]">
                        <MonitorSmartphone className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium">{pk.name || "未命名设备"}</span>
                          {pk.backedUp && (
                            <ConsoleStatusBadge label="已备份" tone="good" />
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          添加于 {pk.createdAt ? formatDate(pk.createdAt) : "未知"}
                        </p>
                      </div>
                    </div>
                    
                    <div className={cn(consoleInsetClassName, "flex items-center gap-2 bg-muted/[0.14] p-2.5")}>
                      <code className="min-w-0 flex-1 break-all font-mono text-[10px] text-muted-foreground/80 leading-relaxed">
                        {pk.credentialID}
                      </code>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="h-7 w-7 opacity-50 hover:opacity-100"
                        onClick={() => void handleCopyCredentialId(pk.credentialID)}
                        aria-label="复制通行密钥 ID"
                        title="复制通行密钥 ID"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setPendingDeletePasskey(pk)}
                    disabled={deleteId === pk.id}
                    className="h-8 w-8 text-destructive opacity-100 transition-opacity hover:bg-destructive/10 sm:opacity-0 sm:group-hover:opacity-100"
                    aria-label={`删除通行密钥 ${pk.name || pk.credentialID}`}
                    title="删除通行密钥"
                  >
                    {deleteId === pk.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
        </section>
      </div>

      <Dialog open={!!pendingDeletePasskey} onOpenChange={(open) => !open && setPendingDeletePasskey(null)}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md">
          <DialogHeader>
            <DialogTitle>确认删除这枚通行密钥？</DialogTitle>
            <DialogDescription>
              删除后，这台设备将无法再使用该通行密钥登录。
              {pendingDeletePasskey && (
                <span className="mt-2 block break-all font-mono text-xs text-muted-foreground">
                  {pendingDeletePasskey.name || pendingDeletePasskey.credentialID}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDeletePasskey(null)} disabled={!!deleteId}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => pendingDeletePasskey && handleDeletePasskey(pendingDeletePasskey.id)}
              disabled={!!deleteId}
            >
              {deleteId ? "删除中…" : "删除通行密钥"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
