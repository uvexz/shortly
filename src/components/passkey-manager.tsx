"use client"

import { useState } from "react"
import { authClient } from "@/lib/auth-client"
import { createClientErrorReporter, getUserFacingErrorMessage } from "@/lib/client-feedback"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatDate } from "@/lib/utils"
import { toast } from "sonner"
import { KeyRound, Plus, Trash2, Loader2, MonitorSmartphone, Copy } from "lucide-react"

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

  return (
    <div className="grid gap-6 xl:grid-cols-[22rem_minmax(0,1fr)] 2xl:grid-cols-[24rem_minmax(0,1fr)]">
      <div className="space-y-4 px-1">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-primary" />
          <h2 className="text-lg font-semibold tracking-tight">通行密钥</h2>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          通行密钥（Passkeys）是一种更安全、更便捷的登录方式。你可以使用指纹、面容或设备密码来替代传统的账号密码。
        </p>
        {supportsPasskey && (
          <div className="pt-2">
            <Button onClick={handleAddPasskey} disabled={loadingAdd || isPending} className="h-10 w-full sm:w-auto px-6 font-bold">
              {loadingAdd ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              添加新密钥
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-6">
        {!supportsPasskey ? (
          <div className="flex h-32 items-center justify-center rounded-xl border border-dashed bg-muted/5 text-sm text-muted-foreground">
            当前浏览器或设备环境暂不支持通行密钥。
          </div>
        ) : isPending ? (
          <div className="flex h-32 items-center justify-center rounded-xl border border-dashed bg-muted/5 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin text-primary" />
            正在载入密钥列表…
          </div>
        ) : !passkeys?.length ? (
          <div className="flex h-32 items-center justify-center rounded-xl border border-dashed bg-muted/5 p-6 text-center text-sm text-muted-foreground">
            你还没有添加任何通行密钥。为了账户安全，建议优先使用此登录方式。
          </div>
        ) : (
          <div className="grid gap-3">
            {passkeys.map((pk: { id: string; name?: string; backedUp: boolean; credentialID: string; createdAt: Date }) => (
              <div key={pk.id} className="group relative rounded-xl border bg-card p-4 transition-colors hover:border-primary/20 sm:p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/5">
                        <MonitorSmartphone className="h-4 w-4 text-primary/70" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-bold">{pk.name || "未命名设备"}</span>
                          {pk.backedUp && (
                            <Badge variant="outline" className="h-4 border-primary/20 bg-primary/5 text-[10px] font-bold text-primary px-1.5 uppercase">
                              BACKED UP
                            </Badge>
                          )}
                        </div>
                        <p className="mt-0.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                          ADDED ON {pk.createdAt ? formatDate(pk.createdAt) : "UNKNOWN"}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 rounded-lg bg-black/[0.02] border p-2.5">
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
