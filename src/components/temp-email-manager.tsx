"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import {
  createClientErrorReporter,
  getResponseErrorMessage,
  getUserFacingErrorMessage,
  readOptionalJson,
} from "@/lib/client-feedback"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn, formatDate } from "@/lib/utils"
import { useMediaQuery } from "@/lib/use-media-query"
import { generateRandomEmailPrefix } from "@/lib/random-email-prefix"
import { AlertTriangle, CheckCircle2, Copy, Inbox, MailPlus, RefreshCw, Search, Trash2, X } from "lucide-react"
import {
  ConsoleKicker,
  ConsoleMetric,
  ConsoleStatusBadge,
  consoleInsetClassName,
  consoleSurfaceClassName,
  type ConsoleTone,
} from "@/components/dashboard/console-ui"

interface MailboxRecord {
  id: string
  emailAddress: string
  domain: string
  createdAt: string | number
  unreadCount: number
  messageCount: number
}

interface MailboxOptionsResponse {
  data: MailboxRecord[]
}

interface MessageRecord {
  id: string
  mailboxId: string
  mailboxEmailAddress: string
  messageId: string | null
  from: string
  fromName: string | null
  subject: string
  text: string
  html: string
  receivedAt: string | number
  isRead: boolean
  hasAttachments: boolean
}

interface MessageResponse {
  data: MessageRecord[]
  total: number
  unread: number
  page: number
  limit: number
  totalPages: number
}

interface MessageHeaderRecord {
  name: string
  value: string
}

interface MessageContactRecord {
  name?: string | null
  address?: string | null
}

interface MessageAttachmentRecord {
  id: string
  filename: string
  mimeType: string
  size: number
}

interface MessageDetailRecord {
  id: string
  mailboxId: string
  mailboxEmailAddress: string
  messageId: string | null
  from: string
  fromName: string | null
  subject: string
  text: string
  html: string
  receivedAt: string | number
  isRead: boolean
  cc: MessageContactRecord[]
  replyTo: MessageContactRecord[]
  headers: MessageHeaderRecord[]
  attachments: MessageAttachmentRecord[]
  hasText: boolean
  hasHtml: boolean
  hasAttachments: boolean
}

interface MessageDetailResponse {
  data: MessageDetailRecord
}

interface DomainRecord {
  host: string
  isDefault: boolean
  minLocalPartLength: number
}

interface DomainsResponse {
  emailDomains: DomainRecord[]
  shortDomains: DomainRecord[]
}

function formatMessageContact(contact: MessageContactRecord) {
  if (contact.name && contact.address) {
    return `${contact.name} <${contact.address}>`
  }

  return contact.address || contact.name || ""
}

function buildMessageSource(detail: MessageDetailRecord) {
  const lines: string[] = []

  if (detail.messageId) {
    lines.push(`Message-ID: ${detail.messageId}`)
  }
  lines.push(`From: ${detail.fromName ? `${detail.fromName} <${detail.from}>` : detail.from}`)
  lines.push(`To: ${detail.mailboxEmailAddress}`)
  if (detail.replyTo.length > 0) {
    lines.push(`Reply-To: ${detail.replyTo.map(formatMessageContact).filter(Boolean).join(", ")}`)
  }
  if (detail.cc.length > 0) {
    lines.push(`Cc: ${detail.cc.map(formatMessageContact).filter(Boolean).join(", ")}`)
  }
  lines.push(`Subject: ${detail.subject || "(无主题)"}`)
  lines.push(`Date: ${formatDate(detail.receivedAt)}`)

  for (const header of detail.headers) {
    if (!header?.name || !header?.value) continue
    lines.push(`${header.name}: ${header.value}`)
  }

  if (detail.attachments.length > 0) {
    lines.push(`Attachments: ${detail.attachments.map((attachment) => attachment.filename).join(", ")}`)
  }

  lines.push("", "--- TEXT ---", detail.text || "(无纯文本内容)", "", "--- HTML ---", detail.html || "(无 HTML 内容)")

  return lines.join("\n")
}

const tempEmailReporter = createClientErrorReporter("temp_email_manager")
const TEMP_EMAIL_PAGE_SIZE = 10

function getPositivePageParam(value: string | null | undefined) {
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

function getPaginationRange(page: number, totalItems: number) {
  if (totalItems <= 0) {
    return "0 / 0"
  }

  const start = (page - 1) * TEMP_EMAIL_PAGE_SIZE + 1
  const end = Math.min(totalItems, page * TEMP_EMAIL_PAGE_SIZE)
  return `${start}-${end} / ${totalItems}`
}

function PaginationFooter({
  label,
  page,
  totalPages,
  totalItems,
  loading,
  onPageChange,
}: {
  label: string
  page: number
  totalPages: number
  totalItems: number
  loading: boolean
  onPageChange: (page: number) => void
}) {
  if (totalItems <= 0) {
    return null
  }

  return (
    <div className="flex items-center justify-between gap-3 border-t px-4 py-3">
      <p className="min-w-0 text-xs font-medium text-muted-foreground">
        {label} {getPaginationRange(page, totalItems)}
      </p>
      <div className="flex shrink-0 gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loading || page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="h-8"
        >
          上一页
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loading || page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="h-8"
        >
          下一页
        </Button>
      </div>
    </div>
  )
}

type TempEmailMetricTone = ConsoleTone

const messageDetailTabLabels = {
  text: "TXT",
  html: "富文本",
  source: "源码",
} as const

type MessageDetailTab = keyof typeof messageDetailTabLabels

const iframeSandbox = ""

function sanitizeEmailHtml(html: string) {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, "")
    .replace(/<embed\b[^>]*>/gi, "")
    .replace(/\son\w+=("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s(href|src)=("|')\s*javascript:[\s\S]*?\2/gi, "")
}

const iframeSrcDocPrefix = "<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"><base target=\"_blank\"><style>body{font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111827;line-height:1.6;padding:16px;margin:0;word-break:break-word}img{max-width:100%;height:auto}pre{white-space:pre-wrap}table{max-width:100%;border-collapse:collapse}a{color:#2563eb}</style></head><body>"
const iframeSrcDocSuffix = "</body></html>"

function buildIframeSrcDoc(html: string) {
  return `${iframeSrcDocPrefix}${sanitizeEmailHtml(html)}${iframeSrcDocSuffix}`
}

function formatAttachmentSize(size: number) {
  if (size < 1024) {
    return `${size} B`
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`
  }
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function getMessagePreview(message: MessageRecord) {
  return (message.text || message.html || "").replace(/\s+/g, " ") || "无正文"
}

function getMessageTitle(message: Pick<MessageRecord, "subject"> | Pick<MessageDetailRecord, "subject">) {
  return message.subject || "(无主题)"
}

function getMessageSender(message: Pick<MessageRecord, "from" | "fromName"> | Pick<MessageDetailRecord, "from" | "fromName">) {
  return message.fromName || message.from
}

function getInitialMessageDetailTab(detail: MessageDetailRecord): MessageDetailTab {
  if (detail.hasHtml) return "html"
  if (detail.hasText) return "text"
  return "source"
}

function getMessageDetailEmptyCopy(tab: MessageDetailTab) {
  switch (tab) {
    case "text":
      return "该邮件没有纯文本内容。"
    case "html":
      return "该邮件没有富文本内容。"
    case "source":
      return "该邮件没有可显示的源码内容。"
  }
}

function getHeaderKey(header: MessageHeaderRecord, index: number) {
  return `${header.name}-${header.value}-${index}`
}

function getAttachmentKey(attachment: MessageAttachmentRecord) {
  return attachment.id
}

function getMessageContactKey(contact: MessageContactRecord, index: number) {
  return `${contact.address || contact.name || "contact"}-${index}`
}

function isMessageDetailTab(value: string): value is MessageDetailTab {
  return value === "text" || value === "html" || value === "source"
}

function getDialogDescription(detail: MessageDetailRecord | null) {
  if (!detail) {
    return "查看这封邮件的纯文本、富文本和源码内容。"
  }

  return `${detail.from} · ${formatDate(detail.receivedAt)}`
}

function getMessageTabValue(detail: MessageDetailRecord | null, current: MessageDetailTab): MessageDetailTab {
  if (!detail) {
    return current
  }

  if (current === "text" && !detail.hasText) {
    return getInitialMessageDetailTab(detail)
  }
  if (current === "html" && !detail.hasHtml) {
    return getInitialMessageDetailTab(detail)
  }

  return current
}

function shouldShowMessageMetadata(detail: MessageDetailRecord) {
  return detail.replyTo.length > 0 || detail.cc.length > 0 || detail.headers.length > 0 || detail.attachments.length > 0
}

function renderableHtmlExists(detail: MessageDetailRecord) {
  return Boolean(detail.html.trim())
}

function getMessageDetailCopy(detail: MessageDetailRecord) {
  return buildMessageSource(detail)
}

function getMessageMetadataTitle() {
  return "邮件信息"
}

function getAttachmentSectionTitle() {
  return "附件"
}

function getRetryDetailButtonLabel() {
  return "重试"
}

function getCopySourceButtonLabel() {
  return "复制源码"
}

function getLoadingDetailCopy() {
  return "正在加载邮件内容…"
}

function getNotFoundDetailCopy() {
  return "加载邮件内容失败"
}

function getMailboxMetadataLabel() {
  return "收件邮箱"
}

function getReplyToLabel() {
  return "Reply-To"
}

function getCcLabel() {
  return "Cc"
}

function getAttachmentSummary(detail: MessageDetailRecord) {
  if (detail.attachments.length < 1) {
    return null
  }

  return `${detail.attachments.length} 个附件`
}

function getViewDialogTitle(detail: MessageDetailRecord | null, selectedMessage: MessageRecord | null) {
  if (detail) {
    return getMessageTitle(detail)
  }

  if (selectedMessage) {
    return getMessageTitle(selectedMessage)
  }

  return "邮件详情"
}

function clearMessageDetailState() {
  return {
    detail: null as MessageDetailRecord | null,
    error: null as string | null,
    selected: null as MessageRecord | null,
    loading: false,
    tab: getDefaultDetailTab(),
  }
}

function getReadableTabLabel(tab: MessageDetailTab) {
  return messageDetailTabLabels[tab]
}

function shouldAutoMarkRead(message: MessageRecord) {
  return !message.isRead
}

function getMessageMetadataItems(detail: MessageDetailRecord) {
  return [
    { label: getMailboxMetadataLabel(), value: detail.mailboxEmailAddress },
    detail.replyTo.length > 0
      ? { label: getReplyToLabel(), value: detail.replyTo.map(formatMessageContact).filter(Boolean).join(", ") }
      : null,
    detail.cc.length > 0 ? { label: getCcLabel(), value: detail.cc.map(formatMessageContact).filter(Boolean).join(", ") } : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>
}

function getMessageHeaders(detail: MessageDetailRecord) {
  return detail.headers.filter((header) => header.name && header.value)
}

function buildRetryableMessageDetailError(message: string | null) {
  return message || getNotFoundDetailCopy()
}

function getMessageDialogCopyButtonMessage() {
  return "源码已复制"
}

function getHtmlFrameTitle() {
  return "邮件 HTML 预览"
}

function getMessageActionsClassName() {
  return "flex flex-wrap gap-2"
}

function getMetadataGridClassName() {
  return "grid gap-3 rounded-md bg-muted/[0.18] p-3 text-sm shadow-[0_0_0_1px_rgba(0,0,0,0.08)] sm:grid-cols-2"
}

function getMetadataBlockClassName() {
  return "space-y-1"
}

function getPreBlockClassName() {
  return "max-h-[55vh] overflow-auto rounded-md bg-muted/[0.18] p-4 font-mono text-xs leading-6 whitespace-pre-wrap break-words shadow-[0_0_0_1px_rgba(0,0,0,0.08)]"
}

function getHtmlFrameClassName() {
  return "h-[min(60vh,32rem)] min-h-[18rem] w-full rounded-md bg-white"
}

function getEmptyStateClassName() {
  return "rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground"
}

function getAttachmentListClassName() {
  return "space-y-2 rounded-md bg-muted/[0.18] p-3 break-all shadow-[0_0_0_1px_rgba(0,0,0,0.08)]"
}

function getAttachmentItemClassName() {
  return "flex flex-col gap-1 rounded-md bg-background px-3 py-2 shadow-[0_0_0_1px_rgba(0,0,0,0.08)] sm:flex-row sm:items-center sm:justify-between"
}

function getAttachmentMetaClassName() {
  return "text-xs text-muted-foreground"
}

function getDetailContainerClassName() {
  return "flex min-h-0 flex-1 flex-col gap-4"
}

function getMetadataLabelClassName() {
  return "text-xs font-medium text-muted-foreground"
}

function getMetadataValueClassName() {
  return "break-all text-sm"
}

function getSectionTitleClassName() {
  return "text-sm font-medium"
}

function getDialogDescriptionClassName() {
  return "break-all"
}

function getMessageDialogFooterClassName() {
  return "border-t pt-4 justify-between gap-2 sm:justify-between"
}

function getDialogBodyClassName() {
  return "flex min-h-0 flex-1 flex-col gap-4"
}

function getTabsClassName() {
  return "space-y-4"
}

function getTabsListClassName() {
  return "grid w-full grid-cols-3"
}

function getDetailLoadingClassName() {
  return "py-12 text-center text-sm text-muted-foreground"
}

function getDetailErrorClassName() {
  return "space-y-4 py-8 text-center text-sm text-destructive"
}

function getInlineMutedClassName() {
  return "text-xs text-muted-foreground"
}

function getHeaderListClassName() {
  return "space-y-2 rounded-md bg-muted/[0.18] p-3 shadow-[0_0_0_1px_rgba(0,0,0,0.08)]"
}

function getHeaderItemClassName() {
  return "rounded-md bg-background px-3 py-2 shadow-[0_0_0_1px_rgba(0,0,0,0.08)]"
}

function getHeaderNameClassName() {
  return "text-xs font-medium text-muted-foreground"
}

function getHeaderValueClassName() {
  return "mt-1 break-all font-mono text-xs"
}

function getResponsiveContentClassName() {
  return "flex min-h-0 flex-1 flex-col overflow-hidden"
}

function getAttachmentMeta(attachment: MessageAttachmentRecord) {
  return `${attachment.mimeType} · ${formatAttachmentSize(attachment.size)}`
}

function getMessageStatusCopy(isRead: boolean) {
  return isRead ? "已读" : "未读"
}

function getHasAttachmentCopy() {
  return "附件"
}

function getNoMessageSelectedCopy() {
  return "邮件详情"
}

function getSourceContent(detail: MessageDetailRecord | null) {
  return detail ? buildMessageSource(detail) : ""
}

function getIframeSrc(detail: MessageDetailRecord | null) {
  return detail ? buildIframeSrcDoc(detail.html) : buildIframeSrcDoc("")
}

function getOpenDetailErrorMessage() {
  return "加载邮件内容失败"
}

function getDetailRetryButtonVariant(): "outline" {
  return "outline"
}

function getDetailCopyButtonVariant(): "outline" {
  return "outline"
}

function getDetailCloseButtonLabel() {
  return "关闭"
}

function getTabContentClassName() {
  return "space-y-4"
}

function getHtmlFrameWrapperClassName() {
  return "overflow-hidden rounded-md shadow-[0_0_0_1px_rgba(0,0,0,0.08)]"
}

function getMessageDialogAriaLabel() {
  return "邮件详情"
}

function getMessageContactList(detail: MessageDetailRecord, type: "replyTo" | "cc") {
  return type === "replyTo" ? detail.replyTo : detail.cc
}

function getDetailTabContent(detail: MessageDetailRecord | null, tab: MessageDetailTab) {
  if (!detail) {
    return ""
  }

  if (tab === "text") {
    return detail.text
  }
  if (tab === "html") {
    return detail.html
  }
  return buildMessageSource(detail)
}

function hasDetailTabContent(detail: MessageDetailRecord | null, tab: MessageDetailTab) {
  if (!detail) {
    return false
  }

  if (tab === "text") return detail.hasText
  if (tab === "html") return detail.hasHtml
  return Boolean(buildMessageSource(detail).trim())
}

function getMessageDetailTabTitle(tab: MessageDetailTab) {
  return getReadableTabLabel(tab)
}

function getDialogOpenState(selectedMessage: MessageRecord | null) {
  return Boolean(selectedMessage)
}

function getSelectedMessageId(selectedMessage: MessageRecord | null) {
  return selectedMessage?.id ?? null
}

function getMessageDetailDialogDescription(detail: MessageDetailRecord | null) {
  return getDialogDescription(detail)
}

function getDetailFromLine(detail: MessageDetailRecord) {
  return detail.fromName ? `${detail.fromName} <${detail.from}>` : detail.from
}

function getDetailMailboxLine(detail: MessageDetailRecord) {
  return detail.mailboxEmailAddress
}

function hasDetailAttachments(detail: MessageDetailRecord) {
  return detail.attachments.length > 0
}

function getHeaderCount(detail: MessageDetailRecord) {
  return getMessageHeaders(detail).length
}

function getCopySourceValue(detail: MessageDetailRecord | null) {
  return detail ? getMessageDetailCopy(detail) : ""
}

function getDefaultDetailTab() {
  return "html" as MessageDetailTab
}

function normalizeDetailTab(value: string, detail: MessageDetailRecord | null) {
  return isMessageDetailTab(value) ? getMessageTabValue(detail, value) : getDefaultDetailTab()
}

function getMessageLoadingDescription() {
  return "查看这封邮件的纯文本、富文本和源码内容。"
}

function isSelectedMessage(message: MessageRecord, selectedMessage: MessageRecord | null) {
  return message.id === selectedMessage?.id
}

function getMessageDialogDescriptionValue(detail: MessageDetailRecord | null) {
  return detail ? getMessageDetailDialogDescription(detail) : getMessageLoadingDescription()
}

function getDetailHeaderSummary(detail: MessageDetailRecord) {
  const attachmentSummary = getAttachmentSummary(detail)
  return [getDetailFromLine(detail), formatDate(detail.receivedAt), attachmentSummary].filter(Boolean).join(" · ")
}

function getDetailMetadataRows(detail: MessageDetailRecord) {
  return getMessageMetadataItems(detail)
}

function getMessageTitleForDialog(detail: MessageDetailRecord | null, selectedMessage: MessageRecord | null) {
  return getViewDialogTitle(detail, selectedMessage)
}

function getMessagePreviewForList(message: MessageRecord) {
  return getMessagePreview(message)
}

function getMessageSenderPrimary(message: MessageRecord) {
  return getMessageSender(message)
}

function getMessageDetailStatusText(detail: MessageDetailRecord) {
  return getMessageStatusCopy(detail.isRead)
}

function getMessageAttachmentBadgeText() {
  return getHasAttachmentCopy()
}

function shouldShowHtmlPreview(detail: MessageDetailRecord | null) {
  return Boolean(detail && renderableHtmlExists(detail))
}

function getMessageDetailErrorCopy(error: string | null) {
  return buildRetryableMessageDetailError(error)
}

function getMessageDetailSelectedTab(detail: MessageDetailRecord | null, current: MessageDetailTab) {
  return getMessageTabValue(detail, current)
}

function getMessageHeaderRows(detail: MessageDetailRecord) {
  return getMessageHeaders(detail)
}

function getMessageDetailMetadataVisible(detail: MessageDetailRecord) {
  return shouldShowMessageMetadata(detail)
}

function getMessageDialogOpen(selectedMessage: MessageRecord | null) {
  return getDialogOpenState(selectedMessage)
}

function getSelectedMessageIdValue(selectedMessage: MessageRecord | null) {
  return getSelectedMessageId(selectedMessage)
}

function getSelectedMessageTitle(selectedMessage: MessageRecord | null) {
  return selectedMessage ? getMessageTitle(selectedMessage) : getNoMessageSelectedCopy()
}

function getMessageDetailAriaTitle() {
  return getMessageDialogAriaLabel()
}

function getMessageIframeDoc(detail: MessageDetailRecord | null) {
  return getIframeSrc(detail)
}

function getMessageSourceValue(detail: MessageDetailRecord | null) {
  return getSourceContent(detail)
}

function getMessageTabEmptyState(tab: MessageDetailTab) {
  return getMessageDetailEmptyCopy(tab)
}

function getMessageAttachmentMeta(attachment: MessageAttachmentRecord) {
  return getAttachmentMeta(attachment)
}

function getMessageDetailRetryLabel() {
  return getRetryDetailButtonLabel()
}

function getMessageDetailCloseLabel() {
  return getDetailCloseButtonLabel()
}

function getMessageDetailCopyLabel() {
  return getCopySourceButtonLabel()
}

function getMessageDetailCopyToast() {
  return getMessageDialogCopyButtonMessage()
}

function getMessageDetailTabLabel(tab: MessageDetailTab) {
  return getMessageDetailTabTitle(tab)
}

function getMessageDetailHtmlTitle() {
  return getHtmlFrameTitle()
}

function getMessageDetailDialogClassName() {
  return "flex max-h-[min(92vh,56rem)] w-[calc(100vw-2rem)] max-w-5xl flex-col gap-0"
}

function getMessageDetailHasHtml(detail: MessageDetailRecord | null) {
  return shouldShowHtmlPreview(detail)
}

function getMessageDetailTabClassName() {
  return getTabContentClassName()
}

function getMessageDetailTabsClassName() {
  return getTabsClassName()
}

function getMessageDetailTabsListClassName() {
  return getTabsListClassName()
}

function getMessageDetailBodyClassName() {
  return getDialogBodyClassName()
}

function getMessageDetailFooterClassName() {
  return getMessageDialogFooterClassName()
}

function getMessageDetailLoadingClassName() {
  return getDetailLoadingClassName()
}

function getMessageDetailErrorClassName() {
  return getDetailErrorClassName()
}

function getMessageDetailPreClassName() {
  return getPreBlockClassName()
}

function getMessageDetailEmptyClassName() {
  return getEmptyStateClassName()
}

function getMessageDetailIframeClassName() {
  return getHtmlFrameClassName()
}

function getMessageDetailIframeWrapperClassName() {
  return getHtmlFrameWrapperClassName()
}

function getMessageDetailMetadataGridClassName() {
  return getMetadataGridClassName()
}

function getMessageDetailMetadataBlockClassName() {
  return getMetadataBlockClassName()
}

function getMessageDetailMetadataLabelClassName() {
  return getMetadataLabelClassName()
}

function getMessageDetailMetadataValueClassName() {
  return getMetadataValueClassName()
}

function getMessageDetailSectionTitleClassName() {
  return getSectionTitleClassName()
}

function getMessageDetailHeaderListClassName() {
  return getHeaderListClassName()
}

function getMessageDetailHeaderItemClassName() {
  return getHeaderItemClassName()
}

function getMessageDetailHeaderNameClassName() {
  return getHeaderNameClassName()
}

function getMessageDetailHeaderValueClassName() {
  return getHeaderValueClassName()
}

function getMessageDetailAttachmentListClassName() {
  return getAttachmentListClassName()
}

function getMessageDetailAttachmentItemClassName() {
  return getAttachmentItemClassName()
}

function getMessageDetailAttachmentMetaClassName() {
  return getAttachmentMetaClassName()
}

function getMessageDetailContainerClassName() {
  return getDetailContainerClassName()
}

function getMessageDetailResponsiveContentClassName() {
  return getResponsiveContentClassName()
}

function getMessageDetailActionsClassName() {
  return getMessageActionsClassName()
}

function getMessageDetailInlineMutedClassName() {
  return getInlineMutedClassName()
}

function getMessageDetailDialogDescriptionClassName() {
  return getDialogDescriptionClassName()
}

function getMessageDetailLoadingCopy() {
  return getLoadingDetailCopy()
}

function getMessageDetailOpenErrorCopy() {
  return getOpenDetailErrorMessage()
}

function getMessageDetailMetadataTitle() {
  return getMessageMetadataTitle()
}

function getMessageDetailAttachmentTitle() {
  return getAttachmentSectionTitle()
}

export function TempEmailManager() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentSearch = searchParams.toString()
  const [mailboxes, setMailboxes] = useState<MailboxRecord[]>([])
  const [messages, setMessages] = useState<MessageRecord[]>([])
  const [mailboxFilter, setMailboxFilter] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [mailboxInput, setMailboxInput] = useState("")
  const [emailDomains, setEmailDomains] = useState<DomainRecord[]>([])
  const [selectedDomain, setSelectedDomain] = useState("")
  const [loadingDomains, setLoadingDomains] = useState(true)
  const [domainsError, setDomainsError] = useState<string | null>(null)
  const [loadingMailboxes, setLoadingMailboxes] = useState(true)
  const [mailboxesError, setMailboxesError] = useState<string | null>(null)
  const [mailboxTotalItems, setMailboxTotalItems] = useState(0)
  const [loadingMessages, setLoadingMessages] = useState(true)
  const [messagesError, setMessagesError] = useState<string | null>(null)
  const [messagePage, setMessagePage] = useState(() => getPositivePageParam(searchParams.get("messagePage")) ?? 1)
  const [messageTotalPages, setMessageTotalPages] = useState(1)
  const [messageTotalItems, setMessageTotalItems] = useState(0)
  const [messageUnreadItems, setMessageUnreadItems] = useState(0)
  const [creatingMailbox, setCreatingMailbox] = useState(false)
  const [mutatingMessageId, setMutatingMessageId] = useState<string | null>(null)
  const [deletingMailboxId, setDeletingMailboxId] = useState<string | null>(null)
  const [pendingDeleteMailbox, setPendingDeleteMailbox] = useState<MailboxRecord | null>(null)
  const [pendingDeleteMessage, setPendingDeleteMessage] = useState<MessageRecord | null>(null)
  const [selectedMessage, setSelectedMessage] = useState<MessageRecord | null>(null)
  const [messageDetail, setMessageDetail] = useState<MessageDetailRecord | null>(null)
  const [messageDetailError, setMessageDetailError] = useState<string | null>(null)
  const [loadingMessageDetail, setLoadingMessageDetail] = useState(false)
  const [messageDetailTab, setMessageDetailTab] = useState<MessageDetailTab>(() =>
    normalizeDetailTab(searchParams.get("messageTab") ?? getDefaultDetailTab(), null)
  )
  const [messageDetailReloadNonce, setMessageDetailReloadNonce] = useState(0)
  const latestMessageRequestIdRef = useRef(0)
  const latestDetailRequestIdRef = useRef(0)
  const isDesktop = useMediaQuery("(min-width: 1280px)")

  const replaceUrlState = useCallback(
    (next: { messagePage?: number; messageTab?: MessageDetailTab }) => {
      const params = new URLSearchParams(currentSearch)
      const nextMessagePage = next.messagePage ?? messagePage
      const nextMessageTab = next.messageTab ?? messageDetailTab

      if (nextMessagePage > 1) {
        params.set("messagePage", String(nextMessagePage))
      } else {
        params.delete("messagePage")
      }

      if (nextMessageTab === getDefaultDetailTab()) {
        params.delete("messageTab")
      } else {
        params.set("messageTab", nextMessageTab)
      }

      const query = params.toString()
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    },
    [currentSearch, messageDetailTab, messagePage, pathname, router]
  )

  function handleMessagePageChange(nextPage: number) {
    const normalizedPage = Math.max(1, nextPage)
    setMessagePage(normalizedPage)
    replaceUrlState({ messagePage: normalizedPage })
  }

  function handleSearchQueryChange(value: string) {
    setSearchQuery(value)
    if (messagePage !== 1) {
      handleMessagePageChange(1)
    }
  }

  function handleMailboxFilterChange(value: string) {
    setMailboxFilter(value)
    if (messagePage !== 1) {
      handleMessagePageChange(1)
    }
  }

  const selectedMailbox = useMemo(
    () => mailboxes.find((item) => item.id === mailboxFilter) ?? null,
    [mailboxFilter, mailboxes]
  )

  const normalizedMailboxLocalPart = mailboxInput.trim().toLowerCase().replace(/^@+|@+$/g, "")
  const selectedDomainConfig = useMemo(
    () => emailDomains.find((item) => item.host === selectedDomain) ?? null,
    [emailDomains, selectedDomain]
  )
  const selectedMinLocalPartLength = selectedDomainConfig?.minLocalPartLength ?? 1
  const mailboxLocalPartTooShort =
    normalizedMailboxLocalPart.length > 0 && normalizedMailboxLocalPart.length < selectedMinLocalPartLength

  const mailboxPreview = useMemo(() => {
    if (!normalizedMailboxLocalPart || !selectedDomain) return ""
    return `${normalizedMailboxLocalPart}@${selectedDomain}`
  }, [normalizedMailboxLocalPart, selectedDomain])

  const canCreateMailbox =
    Boolean(selectedDomain) && !loadingDomains && !creatingMailbox && !mailboxLocalPartTooShort

  const resetMessageDetail = useCallback(() => {
    const nextState = clearMessageDetailState()
    setSelectedMessage(nextState.selected)
    setMessageDetail(nextState.detail)
    setMessageDetailError(nextState.error)
    setLoadingMessageDetail(nextState.loading)
    setMessageDetailTab(nextState.tab)
  }, [])

  const fetchDomains = useCallback(async (options?: { silent?: boolean }) => {
    setLoadingDomains(true)
    setDomainsError(null)

    try {
      const res = await fetch("/api/domains")
      const body = await readOptionalJson<DomainsResponse & { error?: string }>(res)
      if (!res.ok) {
        const message = getResponseErrorMessage(body, "加载邮箱域名失败")
        tempEmailReporter.warn("fetch_domains_failed_response", { status: res.status })
        setEmailDomains([])
        setSelectedDomain("")
        setDomainsError(message)
        if (!options?.silent) {
          toast.error(message)
        }
        return
      }

      const domains = body?.emailDomains || []
      setEmailDomains(domains)
      setSelectedDomain((current) => current || domains.find((item) => item.isDefault)?.host || domains[0]?.host || "")
    } catch (error) {
      const message = getUserFacingErrorMessage(error, "加载邮箱域名失败")
      tempEmailReporter.report("fetch_domains_failed_exception", error)
      setEmailDomains([])
      setSelectedDomain("")
      setDomainsError(message)
      if (!options?.silent) {
        toast.error(message)
      }
    } finally {
      setLoadingDomains(false)
    }
  }, [])

  const fetchMailboxes = useCallback(async (options?: { silent?: boolean }) => {
    const isSilent = options?.silent === true
    if (!isSilent) {
      setLoadingMailboxes(true)
      setMailboxesError(null)
    }

    try {
      const res = await fetch("/api/emails/options")
      const body = await readOptionalJson<MailboxOptionsResponse & { error?: string }>(res)
      if (!res.ok) {
        const message = getResponseErrorMessage(body, "加载邮箱失败")
        tempEmailReporter.warn("fetch_mailboxes_failed_response", { status: res.status })
        if (!isSilent) {
          setMailboxesError(message)
          toast.error(message)
        }
        return
      }

      const rows = body?.data || []
      setMailboxesError(null)
      setMailboxes(rows)
      setMailboxTotalItems(rows.length)
      setMailboxFilter((current) => current === "all" || rows.some((item) => item.id === current) ? current : "all")
    } catch (error) {
      const message = getUserFacingErrorMessage(error, "加载邮箱失败")
      tempEmailReporter.report("fetch_mailboxes_failed_exception", error)
      if (!isSilent) {
        setMailboxesError(message)
        toast.error(message)
      }
    } finally {
      if (!isSilent) {
        setLoadingMailboxes(false)
      }
    }
  }, [])

  const fetchMessages = useCallback(async (
    currentPage: number,
    options?: { silent?: boolean; mailboxId?: string | null }
  ) => {
    const isSilent = options?.silent === true
    const requestId = latestMessageRequestIdRef.current + 1
    latestMessageRequestIdRef.current = requestId
    if (!isSilent) {
      setLoadingMessages(true)
      setMessagesError(null)
    }

    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: String(TEMP_EMAIL_PAGE_SIZE),
      })
      const effectiveMailboxId = options && "mailboxId" in options
        ? options.mailboxId
        : mailboxFilter === "all" ? null : mailboxFilter
      if (debouncedSearch) params.set("search", debouncedSearch)
      if (effectiveMailboxId) params.set("mailboxId", effectiveMailboxId)

      const res = await fetch(`/api/emails/messages?${params.toString()}`)
      const body = await readOptionalJson<MessageResponse & { error?: string }>(res)

      if (!res.ok) {
        const message = getResponseErrorMessage(body, "加载邮件失败")
        tempEmailReporter.warn("fetch_messages_failed_response", { page: currentPage, status: res.status })
        if (!isSilent) {
          toast.error(message)
        }
        if (!isSilent && latestMessageRequestIdRef.current === requestId) {
          setMessages([])
          setMessagesError(message)
        }
        return
      }

      if (!body || latestMessageRequestIdRef.current !== requestId) {
        return
      }

      const nextMessages = body.data || []
      const nextMessageCount = typeof body.total === "number" ? body.total : nextMessages.length
      setMessageTotalItems(nextMessageCount)
      setMessageUnreadItems(body.unread || 0)
      setMessageTotalPages(body.totalPages || 1)
      if (body.page && body.page !== currentPage) {
        setMessagePage(body.page)
      }
      setMessages(nextMessages)
      setMessagesError(null)
      setSelectedMessage((current) => {
        if (!current) return current
        return nextMessages.find((item) => item.id === current.id) ?? null
      })
    } catch (error) {
      const message = getUserFacingErrorMessage(error, "加载邮件失败")
      tempEmailReporter.report("fetch_messages_failed_exception", error, { page: currentPage })
      if (!isSilent) {
        toast.error(message)
      }
      if (!isSilent && latestMessageRequestIdRef.current === requestId) {
        setMessages([])
        setMessagesError(message)
      }
    } finally {
      if (latestMessageRequestIdRef.current === requestId) {
        setLoadingMessages(false)
      }
    }
  }, [debouncedSearch, mailboxFilter])

  useEffect(() => {
    let cancelled = false

    queueMicrotask(() => {
      if (!cancelled) {
        void fetchDomains()
      }
    })

    return () => {
      cancelled = true
    }
  }, [fetchDomains])

  useEffect(() => {
    let cancelled = false

    queueMicrotask(() => {
      if (!cancelled) {
        void fetchMailboxes()
      }
    })

    return () => {
      cancelled = true
    }
  }, [fetchMailboxes])

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(searchQuery.trim()), 250)
    return () => window.clearTimeout(timeout)
  }, [searchQuery])

  useEffect(() => {
    let cancelled = false

    queueMicrotask(() => {
      if (cancelled) {
        return
      }

      latestDetailRequestIdRef.current += 1
      resetMessageDetail()
      void fetchMessages(messagePage)
    })

    return () => {
      cancelled = true
    }
  }, [fetchMessages, messagePage, resetMessageDetail])

  const handleRetryMessageDetail = useCallback(() => {
    if (!selectedMessage) {
      return
    }

    setMessageDetail(null)
    setMessageDetailError(null)
    setLoadingMessageDetail(true)
    setMessageDetailTab(getDefaultDetailTab())
    setMessageDetailReloadNonce((current) => current + 1)
  }, [selectedMessage])

  async function handleCopy(text: string, successMessage = "已复制") {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(successMessage)
    } catch {
      toast.error("复制失败，请手动选择复制")
    }
  }

  async function handleCopyMessageSource() {
    const value = getCopySourceValue(messageDetail)
    if (!value) {
      return
    }

    await handleCopy(value, getMessageDetailCopyToast())
  }

  function handleOpenMessage(message: MessageRecord) {
    setSelectedMessage(message)
    setMessageDetail(null)
    setMessageDetailError(null)
    setLoadingMessageDetail(true)
    setMessageDetailTab(getDefaultDetailTab())
    replaceUrlState({ messageTab: getDefaultDetailTab() })
    if (shouldAutoMarkRead(message)) {
      void handleMarkRead(message.id)
    }
  }

  function handleMessageDialogOpenChange(open: boolean) {
    if (!open) {
      latestDetailRequestIdRef.current += 1
      resetMessageDetail()
    }
  }

  function handleMessageDetailTabChange(value: string) {
    const nextTab = normalizeDetailTab(value, messageDetail)
    setMessageDetailTab(nextTab)
    replaceUrlState({ messageTab: nextTab })
  }

  useEffect(() => {
    if (!selectedMessage) {
      return
    }

    let cancelled = false

    queueMicrotask(() => {
      if (cancelled) {
        return
      }

      const nextSelectedMessage = messages.find((item) => item.id === selectedMessage.id) ?? null
      if (!nextSelectedMessage) {
        resetMessageDetail()
        return
      }

      if (nextSelectedMessage !== selectedMessage) {
        setSelectedMessage(nextSelectedMessage)
      }
    })

    return () => {
      cancelled = true
    }
  }, [messages, resetMessageDetail, selectedMessage])

  useEffect(() => {
    if (!selectedMessage?.isRead) {
      return
    }

    let cancelled = false

    queueMicrotask(() => {
      if (!cancelled) {
        setMessageDetail((current) => (current ? { ...current, isRead: true } : current))
      }
    })

    return () => {
      cancelled = true
    }
  }, [selectedMessage?.isRead])

  const selectedMessageId = getSelectedMessageIdValue(selectedMessage)
  const selectedDetailTab = getMessageDetailSelectedTab(messageDetail, messageDetailTab)
  const hasSelectedMessage = getMessageDialogOpen(selectedMessage)
  const messageDialogOpen = hasSelectedMessage && !isDesktop
  const hasActiveFilters = Boolean(searchQuery.trim()) || mailboxFilter !== "all"
  const inboxScopeLabel = selectedMailbox?.emailAddress || "全部邮箱"
  const domainMetricLabel = loadingDomains ? "同步中" : domainsError ? "异常" : emailDomains.length
  const domainMetricTone: TempEmailMetricTone = domainsError ? "danger" : emailDomains.length > 0 ? "good" : "neutral"
  const messageMetricTone: TempEmailMetricTone = messageUnreadItems > 0 ? "warning" : messageTotalItems > 0 ? "good" : "neutral"

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState !== "visible") {
        return
      }
      if (messageDialogOpen) {
        return
      }
      if (loadingMailboxes || loadingMessages) {
        return
      }

      void fetchMailboxes({ silent: true }).then(() =>
        fetchMessages(messagePage, { silent: true })
      )
    }, 15000)

    return () => window.clearInterval(interval)
  }, [
    fetchMailboxes,
    fetchMessages,
    loadingMailboxes,
    loadingMessages,
    messageDialogOpen,
    messagePage,
  ])

  function handleGenerateRandomPrefix() {
    setMailboxInput(generateRandomEmailPrefix())
  }

  async function handleCreateMailbox() {
    const localPart = normalizedMailboxLocalPart
    if (!localPart) {
      toast.error("请输入邮箱前缀")
      return
    }
    if (!selectedDomain) {
      toast.error("暂无可用邮箱域名")
      return
    }
    if (localPart.length < selectedMinLocalPartLength) {
      toast.error(`邮箱前缀至少需要 ${selectedMinLocalPartLength} 个字符`)
      return
    }

    setCreatingMailbox(true)
    try {
      const res = await fetch("/api/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailAddress: `${localPart}@${selectedDomain}` }),
      })
      const body = await readOptionalJson<{ error?: string }>(res)
      if (!res.ok) {
        tempEmailReporter.warn("create_mailbox_failed_response", {
          status: res.status,
          domain: selectedDomain,
        })
        toast.error(getResponseErrorMessage(body, "创建邮箱失败"))
        return
      }

      toast.success("临时邮箱已创建")
      setMailboxInput("")
      setMessagePage(1)
      replaceUrlState({ messagePage: 1 })
      await Promise.all([fetchMailboxes(), fetchMessages(1, { silent: true })])
    } catch (error) {
      tempEmailReporter.report("create_mailbox_failed_exception", error, {
        domain: selectedDomain,
      })
      toast.error(getUserFacingErrorMessage(error, "创建邮箱失败"))
    } finally {
      setCreatingMailbox(false)
    }
  }

  const handleMarkRead = useCallback(async (messageId: string) => {
    setMutatingMessageId(messageId)
    try {
      const res = await fetch(`/api/emails/messages/${messageId}/read`, { method: "POST" })
      const body = await readOptionalJson<{ error?: string }>(res)
      if (!res.ok) {
        tempEmailReporter.warn("mark_message_read_failed_response", { messageId, status: res.status })
        toast.error(getResponseErrorMessage(body, "标记已读失败"))
        return
      }

      setMessages((prev) => prev.map((item) => (item.id === messageId ? { ...item, isRead: true } : item)))
      setMessageUnreadItems((current) => Math.max(0, current - 1))
      await fetchMailboxes({ silent: true })
      toast.success("邮件已标记为已读")
    } catch (error) {
      tempEmailReporter.report("mark_message_read_failed_exception", error, { messageId })
      toast.error(getUserFacingErrorMessage(error, "标记已读失败"))
    } finally {
      setMutatingMessageId(null)
    }
  }, [fetchMailboxes])

  useEffect(() => {
    let cancelled = false

    queueMicrotask(() => {
      if (cancelled) {
        return
      }

      const currentSelectedMessageId = selectedMessage?.id
      if (!currentSelectedMessageId) {
        latestDetailRequestIdRef.current += 1
        setMessageDetail(null)
        setMessageDetailError(null)
        setLoadingMessageDetail(false)
        setMessageDetailTab(getDefaultDetailTab())
        return
      }

      const requestId = latestDetailRequestIdRef.current + 1
      latestDetailRequestIdRef.current = requestId
      setMessageDetail(null)
      setMessageDetailError(null)
      setLoadingMessageDetail(true)

      void (async () => {
        try {
          const res = await fetch(`/api/emails/messages/${currentSelectedMessageId}`)
          const body = await readOptionalJson<MessageDetailResponse & { error?: string }>(res)
          if (!res.ok) {
            const message = getResponseErrorMessage(body, getMessageDetailOpenErrorCopy())
            tempEmailReporter.warn("fetch_message_detail_failed_response", {
              messageId: currentSelectedMessageId,
              status: res.status,
            })
            if (latestDetailRequestIdRef.current === requestId) {
              setMessageDetailError(message)
            }
            return
          }

          if (!body?.data || latestDetailRequestIdRef.current !== requestId) {
            return
          }

          setMessageDetail(body.data)
          setMessageDetailTab(getInitialMessageDetailTab(body.data))
        } catch (error) {
          const message = getUserFacingErrorMessage(error, getMessageDetailOpenErrorCopy())
          tempEmailReporter.report("fetch_message_detail_failed_exception", error, {
            messageId: currentSelectedMessageId,
          })
          if (latestDetailRequestIdRef.current === requestId) {
            setMessageDetailError(message)
          }
        } finally {
          if (latestDetailRequestIdRef.current === requestId) {
            setLoadingMessageDetail(false)
          }
        }
      })()
    })

    return () => {
      cancelled = true
      latestDetailRequestIdRef.current += 1
    }
  }, [messageDetailReloadNonce, selectedMessage?.id])

  async function handleDeleteMessage(messageId: string) {
    setMutatingMessageId(messageId)
    try {
      const res = await fetch(`/api/emails/messages/${messageId}`, { method: "DELETE" })
      const body = await readOptionalJson<{ error?: string }>(res)
      if (!res.ok) {
        tempEmailReporter.warn("delete_message_failed_response", { messageId, status: res.status })
        toast.error(getResponseErrorMessage(body, "删除邮件失败"))
        return
      }

      if (selectedMessageId === messageId) {
        latestDetailRequestIdRef.current += 1
        resetMessageDetail()
      }
      const deleteState = getDeleteSuccessState(messages.length - 1, messagePage)
      const nextMessageTotal = Math.max(0, messageTotalItems - 1)
      setMessages((prev) => prev.filter((item) => item.id !== messageId))
      setMessageTotalItems(nextMessageTotal)
      setMessageTotalPages(Math.max(1, Math.ceil(nextMessageTotal / TEMP_EMAIL_PAGE_SIZE)))
      if (!messages.find((item) => item.id === messageId)?.isRead) {
        setMessageUnreadItems((current) => Math.max(0, current - 1))
      }
      await fetchMailboxes({ silent: true })
      if (deleteState.nextPage !== messagePage) {
        handleMessagePageChange(deleteState.nextPage)
      } else if (deleteState.shouldRefetch) {
        await fetchMessages(deleteState.nextPage, { silent: true })
      }
      setPendingDeleteMessage(null)
      toast.success("邮件已删除")
    } catch (error) {
      tempEmailReporter.report("delete_message_failed_exception", error, { messageId })
      toast.error(getUserFacingErrorMessage(error, "删除邮件失败"))
    } finally {
      setMutatingMessageId(null)
    }
  }

  async function handleDeleteMailbox(mailbox: MailboxRecord) {
    setDeletingMailboxId(mailbox.id)
    try {
      const res = await fetch(`/api/emails/${mailbox.id}`, { method: "DELETE" })
      const body = await readOptionalJson<{ error?: string }>(res)
      if (!res.ok) {
        tempEmailReporter.warn("delete_mailbox_failed_response", { mailboxId: mailbox.id, status: res.status })
        toast.error(getResponseErrorMessage(body, "删除邮箱失败"))
        return
      }

      setPendingDeleteMailbox(null)
      if (mailboxFilter === mailbox.id) {
        setMailboxFilter("all")
      }
      setMessagePage(1)
      replaceUrlState({ messagePage: 1 })
      resetMessageDetail()
      await Promise.all([
        fetchMailboxes({ silent: true }),
        fetchMessages(1, { silent: true, mailboxId: mailboxFilter === mailbox.id ? null : undefined }),
      ])
      toast.success("邮箱已删除")
    } catch (error) {
      tempEmailReporter.report("delete_mailbox_failed_exception", error, { mailboxId: mailbox.id })
      toast.error(getUserFacingErrorMessage(error, "删除邮箱失败"))
    } finally {
      setDeletingMailboxId(null)
    }
  }

  function renderDesktopMessageDetailPanel() {
    if (!selectedMessage) {
      return (
        <div className="flex min-h-0 flex-1 items-center justify-center px-8 text-center">
          <div className="max-w-sm space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-muted/30 shadow-[0_0_0_1px_rgba(0,0,0,0.08)]">
              <Inbox className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold">选择一封邮件</h3>
              <p className="text-sm leading-6 text-muted-foreground">
                从邮件列表中打开一封邮件后，正文、附件和源码会显示在这里。
              </p>
            </div>
          </div>
        </div>
      )
    }

    if (loadingMessageDetail) {
      return <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-muted-foreground">{getMessageDetailLoadingCopy()}</div>
    }

    if (messageDetailError) {
      return (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-8 text-center text-sm text-destructive">
          <p>{getMessageDetailErrorCopy(messageDetailError)}</p>
          <Button type="button" variant={getDetailRetryButtonVariant()} size="sm" onClick={handleRetryMessageDetail}>
            {getMessageDetailRetryLabel()}
          </Button>
        </div>
      )
    }

    if (!messageDetail) {
      return <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-muted-foreground">{getSelectedMessageTitle(selectedMessage)}</div>
    }

    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="space-y-4 px-6 py-5 shadow-[0_1px_0_0_rgba(0,0,0,0.08)]">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 space-y-2">
              <h3 className="break-words text-lg font-semibold leading-snug">{getMessageTitleForDialog(messageDetail, selectedMessage)}</h3>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="break-all">{getDetailFromLine(messageDetail)}</span>
                <span>{formatDate(messageDetail.receivedAt)}</span>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={handleCopyMessageSource}
                disabled={!messageDetail}
                aria-label="复制邮件源码"
                title="复制邮件源码"
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="text-destructive hover:bg-destructive/10"
                onClick={() => selectedMessage && setPendingDeleteMessage(selectedMessage)}
                disabled={!selectedMessage}
                aria-label="删除邮件"
                title="删除邮件"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <ConsoleStatusBadge label={getMessageDetailStatusText(messageDetail)} tone={messageDetail.isRead ? "neutral" : "accent"} />
            {messageDetail.hasAttachments && <ConsoleStatusBadge label={getMessageAttachmentBadgeText()} tone="neutral" />}
            <span className="break-all text-xs text-muted-foreground">收件人：{getDetailMailboxLine(messageDetail)}</span>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-6 py-5">
          <div className="space-y-5">
            <div className={cn(consoleInsetClassName, "grid gap-3 p-3 text-sm md:grid-cols-2")}>
              <div className="min-w-0">
                <p className={getMessageDetailMetadataLabelClassName()}>发件人</p>
                <p className={getMessageDetailMetadataValueClassName()}>{getDetailFromLine(messageDetail)}</p>
              </div>
              <div className="min-w-0">
                <p className={getMessageDetailMetadataLabelClassName()}>接收时间</p>
                <p className={getMessageDetailMetadataValueClassName()}>{formatDate(messageDetail.receivedAt)}</p>
              </div>
              {getDetailMetadataRows(messageDetail).map((item) => (
                <div key={item.label} className="min-w-0">
                  <p className={getMessageDetailMetadataLabelClassName()}>{item.label}</p>
                  <p className={getMessageDetailMetadataValueClassName()}>{item.value}</p>
                </div>
              ))}
            </div>

            {hasDetailAttachments(messageDetail) && (
              <div className="space-y-2">
                <h4 className={getMessageDetailSectionTitleClassName()}>{getMessageDetailAttachmentTitle()}</h4>
                <div className={getMessageDetailAttachmentListClassName()}>
                  {messageDetail.attachments.map((attachment) => (
                    <div key={getAttachmentKey(attachment)} className={getMessageDetailAttachmentItemClassName()}>
                      <div className="min-w-0">
                        <p className="break-all text-sm font-medium">{attachment.filename}</p>
                        <p className={getMessageDetailAttachmentMetaClassName()}>{getMessageAttachmentMeta(attachment)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Tabs value={selectedDetailTab} onValueChange={handleMessageDetailTabChange} className={getMessageDetailTabsClassName()}>
              <TabsList className={getMessageDetailTabsListClassName()}>
                {(["text", "html", "source"] as MessageDetailTab[]).map((tab) => (
                  <TabsTrigger key={tab} value={tab}>
                    {getMessageDetailTabLabel(tab)}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="text" className={getMessageDetailTabClassName()}>
                {hasDetailTabContent(messageDetail, "text") ? (
                  <pre className={getMessageDetailPreClassName()}>{getDetailTabContent(messageDetail, "text")}</pre>
                ) : (
                  <div className={getMessageDetailEmptyClassName()}>{getMessageTabEmptyState("text")}</div>
                )}
              </TabsContent>

              <TabsContent value="html" className={getMessageDetailTabClassName()}>
                {getMessageDetailHasHtml(messageDetail) ? (
                  <div className={getMessageDetailIframeWrapperClassName()}>
                    <iframe
                      title={getMessageDetailHtmlTitle()}
                      srcDoc={getMessageIframeDoc(messageDetail)}
                      sandbox={iframeSandbox}
                      className={getMessageDetailIframeClassName()}
                    />
                  </div>
                ) : (
                  <div className={getMessageDetailEmptyClassName()}>{getMessageTabEmptyState("html")}</div>
                )}
              </TabsContent>

              <TabsContent value="source" className={getMessageDetailTabClassName()}>
                <pre className={getMessageDetailPreClassName()}>{getMessageSourceValue(messageDetail)}</pre>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    )
  }

  const tempEmailWorkspace = (
    <div className="space-y-5">
      <section className={cn(consoleSurfaceClassName, "overflow-hidden")}>
        <div className="flex flex-col gap-4 p-5 shadow-[0_1px_0_0_rgba(0,0,0,0.08)] sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 space-y-1">
            <ConsoleKicker>Inbox operations</ConsoleKicker>
            <h2 className="text-xl font-semibold sm:text-2xl">临时邮箱收件箱</h2>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              所有临时邮箱的来信按接收时间汇总，可直接搜索或按收件邮箱筛选。
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void Promise.all([fetchMailboxes(), fetchMessages(messagePage)])}
            disabled={loadingMailboxes || loadingMessages}
            className="w-full sm:w-auto"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", (loadingMailboxes || loadingMessages) && "animate-spin")} />
            刷新收件箱
          </Button>
        </div>
        <div className="hidden gap-3 p-5 sm:grid sm:grid-cols-2 xl:grid-cols-4">
          <ConsoleMetric label="邮箱总数" value={mailboxTotalItems} description="可用于接收临时邮件" icon={Inbox} />
          <ConsoleMetric
            label="当前范围"
            value={inboxScopeLabel}
            description={debouncedSearch ? `搜索：${debouncedSearch}` : "按最新接收时间排列"}
            icon={Search}
            tone={selectedMailbox ? "good" : "neutral"}
          />
          <ConsoleMetric
            label="邮件"
            value={messageTotalItems}
            description={`${messageUnreadItems} 封未读`}
            icon={Inbox}
            tone={messageMetricTone}
          />
          <ConsoleMetric
            label="可用域名"
            value={domainMetricLabel}
            description={domainsError || (loadingDomains ? "正在加载域名" : selectedDomain || "暂无域名")}
            icon={domainsError ? AlertTriangle : CheckCircle2}
            tone={domainMetricTone}
          />
        </div>
      </section>

      <div className={cn(consoleSurfaceClassName, "grid min-h-[calc(100vh-18rem)] overflow-hidden xl:grid-cols-[18rem_minmax(20rem,0.9fr)_minmax(0,1.25fr)]")}>
        <section className="order-2 flex min-h-0 flex-col shadow-[0_1px_0_0_rgba(0,0,0,0.08)] xl:order-1 xl:shadow-[1px_0_0_0_rgba(0,0,0,0.08)]">
          <div className="p-5">
            <div className="space-y-1">
              <h2 className="text-base font-semibold">创建临时邮箱</h2>
              <p className="text-sm text-muted-foreground">创建后即可在右侧接收来信</p>
            </div>

            <div className="mt-5 space-y-4">
              <div className="space-y-2">
                <label htmlFor="temp-email-prefix" className="text-sm font-medium">邮箱前缀</label>
                <Input
                  id="temp-email-prefix"
                  name="mailboxPrefix"
                  aria-label="邮箱前缀"
                  placeholder="例如：project-test"
                  autoComplete="off"
                  spellCheck={false}
                  value={mailboxInput}
                  onChange={(event) => setMailboxInput(event.target.value)}
                  className="h-10"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="temp-email-domain" className="text-sm font-medium">邮箱域名</label>
                <Select value={selectedDomain} onValueChange={setSelectedDomain} disabled={emailDomains.length < 1}>
                  <SelectTrigger id="temp-email-domain" aria-label="邮箱域名" className="h-10 w-full">
                    <SelectValue placeholder="选择域名" />
                  </SelectTrigger>
                  <SelectContent>
                    {emailDomains.map((domain) => (
                      <SelectItem key={domain.host} value={domain.host}>{domain.host}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {mailboxPreview && <p className={cn(consoleInsetClassName, "break-all px-3 py-2 font-mono text-xs")}>{mailboxPreview}</p>}
              {mailboxLocalPartTooShort && (
                <p className="text-xs text-destructive">当前域名要求邮箱前缀至少 {selectedMinLocalPartLength} 个字符。</p>
              )}

              <Button onClick={handleCreateMailbox} disabled={!canCreateMailbox} className="h-10 w-full">
                <MailPlus className="h-4 w-4" />
                {creatingMailbox ? "创建中…" : "创建邮箱"}
              </Button>

              <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <button
                  type="button"
                  onClick={handleGenerateRandomPrefix}
                  className="dashboard-focus-ring inline-flex items-center gap-1 rounded-sm hover:text-foreground"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  随机前缀
                </button>
                <span className="truncate">至少 {selectedMinLocalPartLength} 个字符</span>
              </div>

              {loadingDomains ? (
                <p className="text-xs text-muted-foreground">正在载入可用邮箱域名…</p>
              ) : domainsError ? (
                <div className="flex flex-wrap items-center gap-2 text-xs text-destructive">
                  <span>{domainsError}</span>
                  <Button type="button" variant="link" size="sm" onClick={() => fetchDomains()} className="h-auto p-0 text-destructive">重试</Button>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <section className="order-1 flex min-h-0 flex-col shadow-[0_1px_0_0_rgba(0,0,0,0.08)] xl:order-2 xl:shadow-[1px_0_0_0_rgba(0,0,0,0.08)]">
          <div className="space-y-3 p-4 shadow-[0_1px_0_0_rgba(0,0,0,0.08)]">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-base font-semibold">收件箱</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">{messageTotalItems} 封邮件，{messageUnreadItems} 封未读</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {selectedMailbox && (
                  <>
                    <Button variant="ghost" size="icon-sm" onClick={() => handleCopy(selectedMailbox.emailAddress, "邮箱地址已复制")} aria-label="复制筛选邮箱" title="复制筛选邮箱">
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" className="text-destructive hover:bg-destructive/10" onClick={() => setPendingDeleteMailbox(selectedMailbox)} disabled={deletingMailboxId === selectedMailbox.id} aria-label="删除筛选邮箱" title="删除筛选邮箱">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
                <Button variant="outline" size="icon-sm" onClick={() => void fetchMessages(messagePage)} disabled={loadingMessages} aria-label="刷新邮件" title="刷新邮件">
                  <RefreshCw className={cn("h-3.5 w-3.5", loadingMessages && "animate-spin")} />
                </Button>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_12rem] lg:grid-cols-1 xl:grid-cols-[minmax(0,1fr)_12rem]">
              <div className="relative min-w-0">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => handleSearchQueryChange(event.target.value)}
                  placeholder="搜索发件人、主题或正文"
                  aria-label="搜索收件箱"
                  className="h-9 pl-9"
                />
              </div>
              <Select value={mailboxFilter} onValueChange={handleMailboxFilterChange} disabled={loadingMailboxes || mailboxes.length === 0}>
                <SelectTrigger aria-label="按临时邮箱筛选" className="h-9 w-full">
                  <SelectValue placeholder="全部邮箱" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部邮箱</SelectItem>
                  {mailboxes.map((mailbox) => (
                    <SelectItem key={mailbox.id} value={mailbox.id}>{mailbox.emailAddress}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {mailboxesError && (
              <div className="flex items-center justify-between gap-3 text-xs text-destructive">
                <span>{mailboxesError}</span>
                <Button type="button" variant="link" size="sm" onClick={() => fetchMailboxes()} className="h-auto p-0 text-destructive">重试</Button>
              </div>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-auto">
            {loadingMessages ? (
              <div className="flex h-full min-h-80 items-center justify-center text-sm text-muted-foreground">正在同步邮件…</div>
            ) : messagesError ? (
              <div className="flex h-full min-h-80 flex-col items-center justify-center gap-3 px-6 text-center text-sm text-destructive">
                <p>{messagesError}</p>
                <Button type="button" variant="outline" size="sm" onClick={() => fetchMessages(messagePage)} disabled={loadingMessages}>重试</Button>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex h-full min-h-80 items-center justify-center px-6 text-center">
                <div className="max-w-xs space-y-3">
                  <Inbox className="mx-auto h-5 w-5 text-muted-foreground" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{hasActiveFilters ? "没有匹配的邮件" : mailboxes.length === 0 ? "先创建一个临时邮箱" : "暂时没有新邮件"}</p>
                    <p className="text-xs leading-5 text-muted-foreground">
                      {hasActiveFilters ? "调整搜索词或邮箱筛选后再试。" : mailboxes.length === 0 ? "创建后，收到的邮件会直接显示在这里。" : "新邮件到达后会按接收时间显示。"}
                    </p>
                  </div>
                  {hasActiveFilters && (
                    <Button type="button" variant="outline" size="sm" onClick={() => { handleSearchQueryChange(""); handleMailboxFilterChange("all") }}>
                      <X className="h-3.5 w-3.5" />
                      清除筛选
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="divide-y">
                {messages.map((message) => (
                  <button
                    key={message.id}
                    type="button"
                    onClick={() => handleOpenMessage(message)}
                    className={cn(
                      "dashboard-focus-ring group w-full rounded-none px-4 py-3.5 text-left transition-colors hover:bg-muted/40 focus-visible:bg-muted/40",
                      isSelectedMessage(message, selectedMessage) && "bg-muted/[0.36] shadow-[inset_2px_0_0_#0072F5]"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", message.isRead ? "bg-transparent" : "bg-[#0072F5]")} />
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-start justify-between gap-3">
                          <p className={cn("truncate text-sm", !message.isRead && "font-semibold")}>{getMessageSenderPrimary(message)}</p>
                          <span className="shrink-0 text-xs text-muted-foreground">{formatDate(message.receivedAt)}</span>
                        </div>
                        <p className={cn("line-clamp-1 text-sm text-foreground", !message.isRead && "font-medium")}>{getMessageTitle(message)}</p>
                        <p className="line-clamp-1 text-xs text-muted-foreground">{getMessagePreviewForList(message)}</p>
                        <div className="flex items-center justify-between gap-3 pt-1">
                          <span className="truncate font-mono text-[11px] text-muted-foreground">收件：{message.mailboxEmailAddress}</span>
                          <div className="flex shrink-0 items-center gap-1 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                            {!message.isRead && (
                              <Button type="button" variant="ghost" size="sm" onClick={(event) => { event.stopPropagation(); handleMarkRead(message.id) }} disabled={mutatingMessageId === message.id} className="h-7 px-2 text-xs">已读</Button>
                            )}
                            <Button type="button" variant="ghost" size="icon-sm" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={(event) => { event.stopPropagation(); setPendingDeleteMessage(message) }} aria-label="删除邮件" title="删除邮件">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          {!loadingMessages && !messagesError && (
            <PaginationFooter label="邮件" page={messagePage} totalPages={messageTotalPages} totalItems={messageTotalItems} loading={loadingMessages} onPageChange={handleMessagePageChange} />
          )}
        </section>

        <section className="order-3 hidden min-h-0 flex-col xl:flex">{renderDesktopMessageDetailPanel()}</section>
      </div>
    </div>
  )

  return (
    <>
      {tempEmailWorkspace}
      <Dialog open={messageDialogOpen} onOpenChange={handleMessageDialogOpenChange}>
        <DialogContent className={getMessageDetailDialogClassName()} aria-label={getMessageDetailAriaTitle()}>
          <DialogHeader>
            <DialogTitle className="break-words">{getMessageTitleForDialog(messageDetail, selectedMessage)}</DialogTitle>
            <DialogDescription className={getMessageDetailDialogDescriptionClassName()}>
              {getMessageDialogDescriptionValue(messageDetail)}
            </DialogDescription>
          </DialogHeader>

          <div className={getMessageDetailResponsiveContentClassName()}>
            {loadingMessageDetail ? (
              <div className={getMessageDetailLoadingClassName()}>{getMessageDetailLoadingCopy()}</div>
            ) : messageDetailError ? (
              <div className={getMessageDetailErrorClassName()}>
                <p>{getMessageDetailErrorCopy(messageDetailError)}</p>
                <Button type="button" variant={getDetailRetryButtonVariant()} size="sm" onClick={handleRetryMessageDetail}>
                  {getMessageDetailRetryLabel()}
                </Button>
              </div>
            ) : messageDetail ? (
              <div className={getMessageDetailBodyClassName()}>
                <div className={getMessageDetailContainerClassName()}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-1">
                      <p className="break-all text-sm font-medium">{getDetailHeaderSummary(messageDetail)}</p>
                      <p className={`${getMessageDetailInlineMutedClassName()} break-all`}>{getDetailMailboxLine(messageDetail)}</p>
                    </div>
                    <div className={getMessageDetailActionsClassName()}>
                      <ConsoleStatusBadge label={getMessageDetailStatusText(messageDetail)} tone={messageDetail.isRead ? "neutral" : "accent"} />
                      {messageDetail.hasAttachments && <ConsoleStatusBadge label={getMessageAttachmentBadgeText()} tone="neutral" />}
                    </div>
                  </div>

                  <div className={getMessageDetailMetadataGridClassName()}>
                    <div className={getMessageDetailMetadataBlockClassName()}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className={getMessageDetailMetadataLabelClassName()}>发件人</p>
                          <p className={getMessageDetailMetadataValueClassName()}>{getDetailFromLine(messageDetail)}</p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="shrink-0"
                          onClick={() => handleCopy(getDetailFromLine(messageDetail), "发件人已复制")}
                          aria-label="复制发件人"
                          title="复制发件人"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <div className={getMessageDetailMetadataBlockClassName()}>
                      <p className={getMessageDetailMetadataLabelClassName()}>接收时间</p>
                      <p className={getMessageDetailMetadataValueClassName()}>{formatDate(messageDetail.receivedAt)}</p>
                    </div>
                    {getDetailMetadataRows(messageDetail).map((item) => (
                      <div key={item.label} className={getMessageDetailMetadataBlockClassName()}>
                        <p className={getMessageDetailMetadataLabelClassName()}>{item.label}</p>
                        <p className={getMessageDetailMetadataValueClassName()}>{item.value}</p>
                      </div>
                    ))}
                  </div>

                  {hasDetailAttachments(messageDetail) && (
                    <div className="space-y-2">
                      <h4 className={getMessageDetailSectionTitleClassName()}>{getMessageDetailAttachmentTitle()}</h4>
                      <div className={getMessageDetailAttachmentListClassName()}>
                        {messageDetail.attachments.map((attachment) => (
                          <div key={getAttachmentKey(attachment)} className={getMessageDetailAttachmentItemClassName()}>
                            <div className="min-w-0">
                              <p className="break-all text-sm font-medium">{attachment.filename}</p>
                              <p className={getMessageDetailAttachmentMetaClassName()}>{getMessageAttachmentMeta(attachment)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <Tabs
                    value={selectedDetailTab}
                    onValueChange={handleMessageDetailTabChange}
                    className={getMessageDetailTabsClassName()}
                  >
                    <TabsList className={getMessageDetailTabsListClassName()}>
                      {(["text", "html", "source"] as MessageDetailTab[]).map((tab) => (
                        <TabsTrigger key={tab} value={tab}>
                          {getMessageDetailTabLabel(tab)}
                        </TabsTrigger>
                      ))}
                    </TabsList>

                    <TabsContent value="text" className={getMessageDetailTabClassName()}>
                      {hasDetailTabContent(messageDetail, "text") ? (
                        <pre className={getMessageDetailPreClassName()}>{getDetailTabContent(messageDetail, "text")}</pre>
                      ) : (
                        <div className={getMessageDetailEmptyClassName()}>{getMessageTabEmptyState("text")}</div>
                      )}
                    </TabsContent>

                    <TabsContent value="html" className={getMessageDetailTabClassName()}>
                      {getMessageDetailHasHtml(messageDetail) ? (
                        <div className={getMessageDetailIframeWrapperClassName()}>
                          <iframe
                            title={getMessageDetailHtmlTitle()}
                            srcDoc={getMessageIframeDoc(messageDetail)}
                            sandbox={iframeSandbox}
                            className={getMessageDetailIframeClassName()}
                          />
                        </div>
                      ) : (
                        <div className={getMessageDetailEmptyClassName()}>{getMessageTabEmptyState("html")}</div>
                      )}
                    </TabsContent>

                    <TabsContent value="source" className={getMessageDetailTabClassName()}>
                      <div className="space-y-4">
                        {getMessageDetailMetadataVisible(messageDetail) && (
                          <div className="space-y-2">
                            <h4 className={getMessageDetailSectionTitleClassName()}>{getMessageDetailMetadataTitle()}</h4>
                            {messageDetail.replyTo.length > 0 && (
                              <div className={getMessageDetailAttachmentListClassName()}>
                                {getMessageContactList(messageDetail, "replyTo").map((contact, index) => {
                                  const contactValue = formatMessageContact(contact)
                                  return (
                                    <div key={getMessageContactKey(contact, index)} className={getMessageDetailAttachmentItemClassName()}>
                                      <div className="flex items-start justify-between gap-2">
                                        <p className="min-w-0 break-all text-sm">{contactValue}</p>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon-sm"
                                          className="shrink-0"
                                          onClick={() => handleCopy(contactValue, "Reply-To 已复制")}
                                          aria-label={`复制 Reply-To ${contactValue}`}
                                          title="复制 Reply-To"
                                        >
                                          <Copy className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                            {messageDetail.cc.length > 0 && (
                              <div className={getMessageDetailAttachmentListClassName()}>
                                {getMessageContactList(messageDetail, "cc").map((contact, index) => {
                                  const contactValue = formatMessageContact(contact)
                                  return (
                                    <div key={getMessageContactKey(contact, index)} className={getMessageDetailAttachmentItemClassName()}>
                                      <div className="flex items-start justify-between gap-2">
                                        <p className="min-w-0 break-all text-sm">{contactValue}</p>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon-sm"
                                          className="shrink-0"
                                          onClick={() => handleCopy(contactValue, "Cc 已复制")}
                                          aria-label={`复制 Cc ${contactValue}`}
                                          title="复制 Cc"
                                        >
                                          <Copy className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                            {getHeaderCount(messageDetail) > 0 && (
                              <div className={getMessageDetailHeaderListClassName()}>
                                {getMessageHeaderRows(messageDetail).map((header, index) => (
                                  <div key={getHeaderKey(header, index)} className={getMessageDetailHeaderItemClassName()}>
                                    <p className={getMessageDetailHeaderNameClassName()}>{header.name}</p>
                                    <p className={getMessageDetailHeaderValueClassName()}>{header.value}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        <pre className={getMessageDetailPreClassName()}>{getMessageSourceValue(messageDetail)}</pre>
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>
              </div>
            ) : (
              <div className={getMessageDetailLoadingClassName()}>{getSelectedMessageTitle(selectedMessage)}</div>
            )}
          </div>

          <DialogFooter className={getMessageDetailFooterClassName()}>
            <Button type="button" variant={getDetailCopyButtonVariant()} onClick={handleCopyMessageSource} disabled={!messageDetail}>
              <Copy className="h-4 w-4" />
              {getMessageDetailCopyLabel()}
            </Button>
            <Button type="button" variant="outline" onClick={() => handleMessageDialogOpenChange(false)}>
              {getMessageDetailCloseLabel()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!pendingDeleteMailbox} onOpenChange={(open) => !open && setPendingDeleteMailbox(null)}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md">
          <DialogHeader>
            <DialogTitle>确认删除这个邮箱？</DialogTitle>
            <DialogDescription>
              删除后该邮箱及其邮件将无法恢复。
              {pendingDeleteMailbox && (
                <span className="mt-2 block break-all font-mono text-xs text-muted-foreground">
                  {pendingDeleteMailbox.emailAddress}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDeleteMailbox(null)} disabled={!!deletingMailboxId}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => pendingDeleteMailbox && handleDeleteMailbox(pendingDeleteMailbox)}
              disabled={!!deletingMailboxId}
            >
              {deletingMailboxId === pendingDeleteMailbox?.id ? "删除中…" : "删除邮箱"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!pendingDeleteMessage} onOpenChange={(open) => !open && setPendingDeleteMessage(null)}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md">
          <DialogHeader>
            <DialogTitle>确认删除这封邮件？</DialogTitle>
            <DialogDescription>
              删除后将无法恢复。
              {pendingDeleteMessage && (
                <span className="mt-2 block break-words text-xs text-muted-foreground">
                  {pendingDeleteMessage.subject || "(无主题)"}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDeleteMessage(null)} disabled={!!mutatingMessageId}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => pendingDeleteMessage && handleDeleteMessage(pendingDeleteMessage.id)}
              disabled={!!mutatingMessageId}
            >
              {mutatingMessageId === pendingDeleteMessage?.id ? "删除中…" : "删除邮件"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
