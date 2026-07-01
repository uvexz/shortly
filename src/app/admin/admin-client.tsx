"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { UserMenu } from "@/components/user-menu";
import {
  createClientErrorReporter,
  getResponseErrorMessage,
  getUserFacingErrorMessage,
  readOptionalJson,
} from "@/lib/client-feedback";
import { formatDate } from "@/lib/utils";
import { getLogEventLabel } from "@/lib/log-events";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
} from "@/components/ui/sidebar";
import { toast } from "sonner";
import {
  Archive,
  ArrowLeft,
  BarChart2,
  Copy,
  ExternalLink,
  Inbox,
  Link2,
  Mail,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Settings2,
  Shield,
  Trash2,
  UserCheck,
  UserX,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useMediaQuery } from "@/lib/use-media-query";

interface AdminLink {
  id: string;
  slug: string;
  domain: string;
  shortUrl: string;
  originalUrl: string;
  clicks: number;
  maxClicks: number | null;
  expiresAt: string | null;
  hasClickLimit: boolean;
  hasExpiration: boolean;
  isExpired: boolean;
  expiredByClicks: boolean;
  expiredByDate: boolean;
  createdAt: number;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
}

interface LinkLog {
  id: string;
  eventType: string;
  referrer: string | null;
  userAgent: string | null;
  ipAddress: string | null;
  statusCode: number | null;
  createdAt: number;
}

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  emailVerified: boolean;
  banned: boolean;
  banReason: string | null;
  banExpires: string | null;
  createdAt: number;
  linkCount: number;
}

interface SiteSettings {
  siteName: string;
  siteUrl: string;
  telegramBotUsername: string;
  userMaxLinksPerHour: number;
}

interface SiteDomain {
  id: string;
  host: string;
  supportsShortLinks: boolean;
  shortLinkMinSlugLength: number;
  supportsTempEmail: boolean;
  tempEmailMinLocalPartLength: number;
  isActive: boolean;
  isDefaultShortDomain: boolean;
  isDefaultEmailDomain: boolean;
  createdAt: number;
}

interface DomainFormState {
  host: string;
  supportsShortLinks: boolean;
  shortLinkMinSlugLength: number;
  supportsTempEmail: boolean;
  tempEmailMinLocalPartLength: number;
  isActive: boolean;
  isDefaultShortDomain: boolean;
  isDefaultEmailDomain: boolean;
}

interface AdminMailbox {
  id: string;
  emailAddress: string;
  domain: string;
  isActive: boolean;
  createdAt: string | number;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  unreadCount: number;
  messageCount: number;
}

interface AdminMailboxMessage {
  id: string;
  mailboxId: string;
  mailboxEmailAddress: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  messageId: string | null;
  from: string;
  fromName: string | null;
  subject: string;
  text: string;
  html: string;
  receivedAt: string | number;
  isRead: boolean;
  hasAttachments: boolean;
}

interface ArchivedInboundEmail {
  id: string;
  toEmail: string;
  messageId: string | null;
  from: string;
  fromName: string | null;
  subject: string;
  text: string;
  html: string;
  receivedAt: string | number;
  failureReason: string;
  hasAttachments: boolean;
}

interface MessageHeaderRecord {
  name: string;
  value: string;
}

interface MessageContactRecord {
  name?: string | null;
  address?: string | null;
}

interface MessageAttachmentRecord {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
}

interface AdminMailboxMessageDetail {
  id: string;
  mailboxId: string;
  mailboxEmailAddress: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  messageId: string | null;
  from: string;
  fromName: string | null;
  subject: string;
  text: string;
  html: string;
  receivedAt: string | number;
  isRead: boolean;
  cc: MessageContactRecord[];
  replyTo: MessageContactRecord[];
  headers: MessageHeaderRecord[];
  attachments: MessageAttachmentRecord[];
  hasText: boolean;
  hasHtml: boolean;
  hasAttachments: boolean;
}

interface ArchivedInboundEmailDetail {
  id: string;
  toEmail: string;
  messageId: string | null;
  from: string;
  fromName: string | null;
  subject: string;
  text: string;
  html: string;
  receivedAt: string | number;
  cc: MessageContactRecord[];
  replyTo: MessageContactRecord[];
  headers: MessageHeaderRecord[];
  attachments: MessageAttachmentRecord[];
  failureReason: string;
  hasText: boolean;
  hasHtml: boolean;
  hasAttachments: boolean;
}

type MessageDetailTab = "text" | "html" | "source";
type AdminEmailSelection =
  | { kind: "message"; summary: AdminMailboxMessage }
  | { kind: "archive"; summary: ArchivedInboundEmail };
type AdminEmailDetailRecord =
  | AdminMailboxMessageDetail
  | ArchivedInboundEmailDetail;

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface AdminClientProps {
  user: {
    name: string;
    email: string;
    image?: string | null;
    role: string;
  };
}

const initialDomainForm: DomainFormState = {
  host: "",
  supportsShortLinks: false,
  shortLinkMinSlugLength: 1,
  supportsTempEmail: false,
  tempEmailMinLocalPartLength: 1,
  isActive: true,
  isDefaultShortDomain: false,
  isDefaultEmailDomain: false,
};

const adminReporter = createClientErrorReporter("admin_client");
const ADMIN_PAGE_SIZE = 10;
const adminTabs = new Set(["links", "users", "emails", "settings"]);

function getAdminTab(value: string | null | undefined) {
  return value && adminTabs.has(value) ? value : "links";
}

function getPositiveAdminPage(value: string | null | undefined) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function getDeleteLinkSuccessState(
  remainingItems: number,
  currentPage: number,
) {
  if (remainingItems > 0) {
    return { nextPage: currentPage, shouldRefetch: false };
  }

  if (currentPage > 1) {
    return { nextPage: currentPage - 1, shouldRefetch: true };
  }

  return { nextPage: 1, shouldRefetch: true };
}

function getDomainDeleteHelpText(domain: SiteDomain) {
  if (domain.isDefaultShortDomain || domain.isDefaultEmailDomain) {
    return "默认域名不能直接删除，请先切换默认域名。";
  }

  return "删除后将无法恢复。";
}

function getDefaultDetailTab(): MessageDetailTab {
  return "text";
}

function formatMessageContact(contact: MessageContactRecord) {
  if (contact.name && contact.address) {
    return `${contact.name} <${contact.address}>`;
  }

  return contact.address || contact.name || "";
}

const iframeSandbox = "";

function sanitizeEmailHtml(html: string) {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, "")
    .replace(/<embed\b[^>]*>/gi, "")
    .replace(/\son\w+=("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s(href|src)=("|')\s*javascript:[\s\S]*?\2/gi, "");
}

const iframeSrcDocPrefix =
  '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><base target="_blank"><style>body{font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif;color:#111827;line-height:1.6;padding:16px;margin:0;word-break:break-word}img{max-width:100%;height:auto}pre{white-space:pre-wrap}table{max-width:100%;border-collapse:collapse}a{color:#2563eb}</style></head><body>';
const iframeSrcDocSuffix = "</body></html>";

function buildIframeSrcDoc(html: string) {
  return `${iframeSrcDocPrefix}${sanitizeEmailHtml(html)}${iframeSrcDocSuffix}`;
}

function getOpenMessageSubjectButtonClassName() {
  return "w-full truncate text-left text-sm text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
}

function getOpenMessageSubjectMobileButtonClassName() {
  return "w-full truncate text-left text-sm text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
}

function getMessageDetailDialogClassName() {
  return "flex max-h-[min(92vh,56rem)] w-[calc(100vw-2rem)] max-w-5xl flex-col gap-0";
}

function buildAdminEmailSource(
  detail: AdminEmailDetailRecord,
  selection: AdminEmailSelection,
) {
  const lines: string[] = [];

  if (detail.messageId) {
    lines.push(`Message-ID: ${detail.messageId}`);
  }
  lines.push(
    `From: ${detail.fromName ? `${detail.fromName} <${detail.from}>` : detail.from}`,
  );
  if (selection.kind === "message" && "mailboxEmailAddress" in detail) {
    lines.push(`To: ${detail.mailboxEmailAddress}`);
  } else if (selection.kind === "archive" && "toEmail" in detail) {
    lines.push(`To: ${detail.toEmail}`);
  }
  if (detail.replyTo.length > 0) {
    lines.push(
      `Reply-To: ${detail.replyTo.map(formatMessageContact).filter(Boolean).join(", ")}`,
    );
  }
  if (detail.cc.length > 0) {
    lines.push(
      `Cc: ${detail.cc.map(formatMessageContact).filter(Boolean).join(", ")}`,
    );
  }
  lines.push(`Subject: ${detail.subject || "(无主题)"}`);
  lines.push(`Date: ${formatDate(detail.receivedAt)}`);

  if (selection.kind === "message" && "mailboxEmailAddress" in detail) {
    lines.push(`Mailbox: ${detail.mailboxEmailAddress}`);
    lines.push(`User: ${detail.userName || detail.userEmail || detail.userId}`);
    lines.push(`Read: ${detail.isRead ? "yes" : "no"}`);
  } else if (selection.kind === "archive" && "failureReason" in detail) {
    lines.push(`Failure-Reason: ${detail.failureReason}`);
  }

  for (const header of detail.headers) {
    if (!header?.name || !header?.value) continue;
    lines.push(`${header.name}: ${header.value}`);
  }

  if (detail.attachments.length > 0) {
    lines.push(
      `Attachments: ${detail.attachments.map((attachment) => attachment.filename).join(", ")}`,
    );
  }

  lines.push(
    "",
    "--- TEXT ---",
    detail.text || "(无纯文本内容)",
    "",
    "--- HTML ---",
    detail.html || "(无 HTML 内容)",
  );

  return lines.join("\n");
}

export function AdminClient({ user }: AdminClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentSearch = searchParams.toString();
  const [activeTab, setActiveTab] = useState(getAdminTab(searchParams.get("tab")));
  const [links, setLinks] = useState<AdminLink[]>([]);
  const [linksPage, setLinksPage] = useState(
    () => getPositiveAdminPage(searchParams.get("linksPage") ?? searchParams.get("page")) ?? 1,
  );
  const [linksLimit, setLinksLimit] = useState(ADMIN_PAGE_SIZE);
  const [linksTotal, setLinksTotal] = useState(0);
  const [linksTotalPages, setLinksTotalPages] = useState(1);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [domains, setDomains] = useState<SiteDomain[]>([]);
  const [mailboxes, setMailboxes] = useState<AdminMailbox[]>([]);
  const [messages, setMessages] = useState<AdminMailboxMessage[]>([]);
  const [archives, setArchives] = useState<ArchivedInboundEmail[]>([]);
  const [emailSearch, setEmailSearch] = useState(searchParams.get("emailSearch") ?? "");
  const [mailboxesPage, setMailboxesPage] = useState(
    () => getPositiveAdminPage(searchParams.get("mailboxesPage")) ?? 1,
  );
  const [mailboxesTotal, setMailboxesTotal] = useState(0);
  const [mailboxesTotalPages, setMailboxesTotalPages] = useState(1);
  const [messagesPage, setMessagesPage] = useState(
    () => getPositiveAdminPage(searchParams.get("messagesPage")) ?? 1,
  );
  const [messagesTotal, setMessagesTotal] = useState(0);
  const [messagesTotalPages, setMessagesTotalPages] = useState(1);
  const [archivesPage, setArchivesPage] = useState(
    () => getPositiveAdminPage(searchParams.get("archivesPage")) ?? 1,
  );
  const [archivesTotal, setArchivesTotal] = useState(0);
  const [archivesTotalPages, setArchivesTotalPages] = useState(1);
  const [selectedMailboxId, setSelectedMailboxId] = useState<string | null>(
    null,
  );
  const [emailListMode, setEmailListMode] = useState<"messages" | "archives">(
    searchParams.get("emailListMode") === "archives" ? "archives" : "messages",
  );
  const [loadingEmailData, setLoadingEmailData] = useState(false);
  const [emailDataLoaded, setEmailDataLoaded] = useState(false);
  const [selectedEmailItem, setSelectedEmailItem] =
    useState<AdminEmailSelection | null>(null);
  const [emailDetailDialogOpen, setEmailDetailDialogOpen] = useState(false);
  const [emailDetail, setEmailDetail] = useState<AdminEmailDetailRecord | null>(
    null,
  );
  const [emailDetailError, setEmailDetailError] = useState<string | null>(null);
  const [loadingEmailDetail, setLoadingEmailDetail] = useState(false);
  const [emailDetailTab, setEmailDetailTab] =
    useState<MessageDetailTab>("text");
  const latestEmailDetailRequestIdRef = useRef(0);
  const [settings, setSettings] = useState<SiteSettings>({
    siteName: "Shortly",
    siteUrl: "http://localhost:3000",
    telegramBotUsername: "",
    userMaxLinksPerHour: 50,
  });
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingDomain, setSavingDomain] = useState(false);
  const [logsDialogOpen, setLogsDialogOpen] = useState(false);
  const [domainDialogOpen, setDomainDialogOpen] = useState(false);
  const [pendingDeleteLink, setPendingDeleteLink] = useState<AdminLink | null>(
    null,
  );
  const [pendingDeleteDomain, setPendingDeleteDomain] =
    useState<SiteDomain | null>(null);
  const [pendingUserStatusChange, setPendingUserStatusChange] =
    useState<AdminUser | null>(null);
  const [selectedLink, setSelectedLink] = useState<AdminLink | null>(null);
  const [editingDomain, setEditingDomain] = useState<SiteDomain | null>(null);
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [domainForm, setDomainForm] =
    useState<DomainFormState>(initialDomainForm);
  const [logs, setLogs] = useState<LinkLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [emailDataError, setEmailDataError] = useState<string | null>(null);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [deletingLinkId, setDeletingLinkId] = useState<string | null>(null);
  const [deletingDomainId, setDeletingDomainId] = useState<string | null>(null);
  const [mutatingUserId, setMutatingUserId] = useState<string | null>(null);

  function getLogBadgeVariant(
    eventType: string,
  ): "secondary" | "destructive" | "outline" {
    if (eventType.includes("blocked") || eventType.includes("deleted")) {
      return "destructive";
    }
    if (eventType === "redirect_success") {
      return "secondary";
    }
    return "outline";
  }

  const replaceUrlState = useCallback(
    (next: {
      tab?: string;
      linksPage?: number;
      emailSearch?: string;
      mailboxesPage?: number;
      messagesPage?: number;
      archivesPage?: number;
      emailListMode?: "messages" | "archives";
    }) => {
      const params = new URLSearchParams(currentSearch);
      const nextTab = next.tab ? getAdminTab(next.tab) : activeTab;
      const nextLinksPage = next.linksPage ?? linksPage;
      const nextEmailSearch = next.emailSearch ?? emailSearch;
      const nextMailboxesPage = next.mailboxesPage ?? mailboxesPage;
      const nextMessagesPage = next.messagesPage ?? messagesPage;
      const nextArchivesPage = next.archivesPage ?? archivesPage;
      const nextEmailListMode = next.emailListMode ?? emailListMode;

      if (nextTab === "links") {
        params.delete("tab");
      } else {
        params.set("tab", nextTab);
      }

      if (nextLinksPage > 1) {
        params.set("linksPage", String(nextLinksPage));
      } else {
        params.delete("linksPage");
      }

      if (nextEmailSearch.trim()) {
        params.set("emailSearch", nextEmailSearch.trim());
      } else {
        params.delete("emailSearch");
      }

      if (nextMailboxesPage > 1) {
        params.set("mailboxesPage", String(nextMailboxesPage));
      } else {
        params.delete("mailboxesPage");
      }

      if (nextMessagesPage > 1) {
        params.set("messagesPage", String(nextMessagesPage));
      } else {
        params.delete("messagesPage");
      }

      if (nextArchivesPage > 1) {
        params.set("archivesPage", String(nextArchivesPage));
      } else {
        params.delete("archivesPage");
      }

      if (nextEmailListMode === "archives") {
        params.set("emailListMode", nextEmailListMode);
      } else {
        params.delete("emailListMode");
      }

      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [
      activeTab,
      archivesPage,
      currentSearch,
      emailListMode,
      emailSearch,
      linksPage,
      mailboxesPage,
      messagesPage,
      pathname,
      router,
    ],
  );

  const fetchData = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!options?.silent) {
        setLoading(true);
      }
      setDataError(null);
      try {
        const [linksRes, usersRes, settingsRes, domainsRes] = await Promise.all(
          [
            fetch(`/api/admin/links?page=${linksPage}&limit=${linksLimit}`),
            fetch("/api/admin/users"),
            fetch("/api/admin/settings"),
            fetch("/api/admin/domains"),
          ],
        );

        if (!linksRes.ok || !usersRes.ok || !settingsRes.ok || !domainsRes.ok) {
          const message = "加载管理后台数据失败";
          adminReporter.warn("fetch_data_failed_response", {
            linksOk: linksRes.ok,
            usersOk: usersRes.ok,
            settingsOk: settingsRes.ok,
            domainsOk: domainsRes.ok,
          });
          setDataError(message);
          if (!options?.silent) {
            toast.error(message);
          }
          return;
        }

        const body = (await linksRes.json()) as PaginatedResponse<AdminLink>;
        setLinks(body.data || []);
        setLinksPage(body.page || 1);
        setLinksLimit(body.limit || ADMIN_PAGE_SIZE);
        setLinksTotal(body.total || 0);
        setLinksTotalPages(body.totalPages || 1);

        setUsers(await usersRes.json());

        const s = await settingsRes.json();
        setSettings({
          siteName: s.siteName,
          siteUrl: s.siteUrl,
          telegramBotUsername: s.telegramBotUsername || "",
          userMaxLinksPerHour: s.userMaxLinksPerHour,
        });

        const data = await domainsRes.json();
        setDomains(Array.isArray(data) ? data : data.data || []);
      } catch (error) {
        const message = "加载管理后台数据失败";
        adminReporter.report("fetch_data_failed_exception", error);
        setDataError(message);
        if (!options?.silent) {
          toast.error(message);
        }
      } finally {
        setLoading(false);
      }
    },
    [linksLimit, linksPage],
  );

  const fetchEmailData = useCallback(
    async (
      search?: string,
      options?: {
        silent?: boolean;
        mailboxesPage?: number;
        messagesPage?: number;
        archivesPage?: number;
      },
    ) => {
      if (!options?.silent) {
        setLoadingEmailData(true);
      }
      setEmailDataError(null);
      try {
        const searchQuery = search?.trim()
          ? `&search=${encodeURIComponent(search.trim())}`
          : "";
        const nextMailboxesPage = options?.mailboxesPage ?? mailboxesPage;
        const nextMessagesPage = options?.messagesPage ?? messagesPage;
        const nextArchivesPage = options?.archivesPage ?? archivesPage;
        const [mailboxesRes, messagesRes, archivesRes] = await Promise.all([
          fetch(
            `/api/admin/emails/mailboxes?page=${nextMailboxesPage}&limit=${ADMIN_PAGE_SIZE}${searchQuery}`,
          ),
          fetch(
            `/api/admin/emails/messages?page=${nextMessagesPage}&limit=${ADMIN_PAGE_SIZE}${searchQuery}`,
          ),
          fetch(
            `/api/admin/emails/archives?page=${nextArchivesPage}&limit=${ADMIN_PAGE_SIZE}${searchQuery}`,
          ),
        ]);

        if (!mailboxesRes.ok || !messagesRes.ok || !archivesRes.ok) {
          const message = "加载临时邮箱数据失败";
          adminReporter.warn("fetch_email_data_failed_response", {
            mailboxesOk: mailboxesRes.ok,
            messagesOk: messagesRes.ok,
            archivesOk: archivesRes.ok,
          });
          setEmailDataError(message);
          if (!options?.silent) {
            toast.error(message);
          }
          return;
        }

        const mailboxesBody =
          (await mailboxesRes.json()) as PaginatedResponse<AdminMailbox>;
        const messagesBody =
          (await messagesRes.json()) as PaginatedResponse<AdminMailboxMessage>;
        const archivesBody =
          (await archivesRes.json()) as PaginatedResponse<ArchivedInboundEmail>;
        const nextMailboxes = mailboxesBody.data || [];
        setMailboxes(nextMailboxes);
        setMessages(messagesBody.data || []);
        setArchives(archivesBody.data || []);
        setMailboxesPage(mailboxesBody.page || nextMailboxesPage);
        setMailboxesTotal(mailboxesBody.total || 0);
        setMailboxesTotalPages(mailboxesBody.totalPages || 1);
        setMessagesPage(messagesBody.page || nextMessagesPage);
        setMessagesTotal(messagesBody.total || 0);
        setMessagesTotalPages(messagesBody.totalPages || 1);
        setArchivesPage(archivesBody.page || nextArchivesPage);
        setArchivesTotal(archivesBody.total || 0);
        setArchivesTotalPages(archivesBody.totalPages || 1);
        setSelectedMailboxId((current) => {
          if (nextMailboxes.length === 0) {
            return null;
          }

          if (
            current &&
            nextMailboxes.some((mailbox) => mailbox.id === current)
          ) {
            return current;
          }

          return nextMailboxes[0].id;
        });
        setEmailDataLoaded(true);
      } catch (error) {
        const message = "加载临时邮箱数据失败";
        adminReporter.report("fetch_email_data_failed_exception", error);
        setEmailDataError(message);
        if (!options?.silent) {
          toast.error(message);
        }
      } finally {
        setLoadingEmailData(false);
      }
    },
    [archivesPage, mailboxesPage, messagesPage],
  );

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      if (!cancelled) {
        void fetchData();
      }
    });

    return () => {
      cancelled = true;
    };
  }, [fetchData]);

  useEffect(() => {
    if (activeTab === "emails" && !emailDataLoaded && !loadingEmailData) {
      let cancelled = false;

      queueMicrotask(() => {
        if (!cancelled) {
          void fetchEmailData();
        }
      });

      return () => {
        cancelled = true;
      };
    }
  }, [activeTab, emailDataLoaded, loadingEmailData, fetchEmailData]);

  async function handleRefreshLinks() {
    await fetchData({ silent: true });
  }

  async function handleRefreshUsers() {
    await fetchData({ silent: true });
  }

  async function handleRefreshSettings() {
    await fetchData({ silent: true });
  }

  async function handleRefreshDomains() {
    await fetchData({ silent: true });
  }

  async function handleRefreshEmailData() {
    await fetchEmailData(emailSearch);
  }

  function handleResetEmailSearch() {
    setEmailSearch("");
    replaceUrlState({
      emailSearch: "",
      mailboxesPage: 1,
      messagesPage: 1,
      archivesPage: 1,
    });
    void fetchEmailData("", {
      mailboxesPage: 1,
      messagesPage: 1,
      archivesPage: 1,
    });
  }

  function handleChangeTab(nextTab: string) {
    const normalizedTab = getAdminTab(nextTab);
    setActiveTab(normalizedTab);
    replaceUrlState({ tab: normalizedTab });
    setDataError(null);
    if (normalizedTab !== "emails") {
      setEmailDataError(null);
    }
  }

  async function handleSearchEmails() {
    replaceUrlState({
      tab: "emails",
      emailSearch,
      mailboxesPage: 1,
      messagesPage: 1,
      archivesPage: 1,
    });
    await fetchEmailData(emailSearch, {
      mailboxesPage: 1,
      messagesPage: 1,
      archivesPage: 1,
    });
  }

  async function handleChangeMailboxesPage(nextPage: number) {
    setMailboxesPage(nextPage);
    replaceUrlState({ tab: "emails", mailboxesPage: nextPage });
    await fetchEmailData(emailSearch, { mailboxesPage: nextPage });
  }

  async function handleChangeMessagesPage(nextPage: number) {
    setMessagesPage(nextPage);
    replaceUrlState({ tab: "emails", messagesPage: nextPage });
    await fetchEmailData(emailSearch, { messagesPage: nextPage });
  }

  async function handleChangeArchivesPage(nextPage: number) {
    setArchivesPage(nextPage);
    replaceUrlState({ tab: "emails", archivesPage: nextPage });
    await fetchEmailData(emailSearch, { archivesPage: nextPage });
  }

  async function handleCopy(text: string, message: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(message);
    } catch (error) {
      adminReporter.report("copy_failed_exception", error);
      toast.error(getUserFacingErrorMessage(error, "复制失败，请手动复制"));
    }
  }

  async function handleDeleteLinkConfirm(link: AdminLink) {
    setDeletingLinkId(link.id);
    try {
      const res = await fetch(`/api/admin/links/${link.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        const remainingItems = Math.max(0, linksTotal - 1);
        const deleteState = getDeleteLinkSuccessState(
          links.length - 1,
          linksPage,
        );

        toast.success("短链已删除");
        setLinks((prev) => prev.filter((item) => item.id !== link.id));
        setLinksTotal(remainingItems);
        setPendingDeleteLink(null);
        if (selectedLink?.id === link.id) {
          setSelectedLink(null);
          setLogs([]);
          setLogsError(null);
          setLogsDialogOpen(false);
        }

        if (deleteState.nextPage !== linksPage) {
          setLinksPage(deleteState.nextPage);
          replaceUrlState({ linksPage: deleteState.nextPage });
          return;
        }

        if (deleteState.shouldRefetch) {
          await fetchData({ silent: true });
        }
      } else {
        const body = await readOptionalJson<{ error?: string }>(res);
        adminReporter.warn("delete_link_failed_response", {
          linkId: link.id,
          status: res.status,
        });
        toast.error(getResponseErrorMessage(body, "删除短链失败"));
      }
    } catch (error) {
      adminReporter.report("delete_link_failed_exception", error, {
        linkId: link.id,
      });
      toast.error(getUserFacingErrorMessage(error, "删除短链失败"));
    } finally {
      setDeletingLinkId(null);
    }
  }

  async function handleDeleteDomainConfirm(domain: SiteDomain) {
    setDeletingDomainId(domain.id);
    try {
      const res = await fetch(`/api/admin/domains/${domain.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("域名已删除");
        setDomains((prev) => prev.filter((item) => item.id !== domain.id));
        setPendingDeleteDomain(null);
        return;
      }

      const body = await readOptionalJson<{ error?: string }>(res);
      adminReporter.warn("delete_domain_failed_response", {
        domainId: domain.id,
        status: res.status,
      });
      toast.error(getResponseErrorMessage(body, "删除域名失败"));
    } catch (error) {
      adminReporter.report("delete_domain_failed_exception", error, {
        domainId: domain.id,
      });
      toast.error("删除域名失败");
    } finally {
      setDeletingDomainId(null);
    }
  }

  async function handleUserStatusConfirm(targetUser: AdminUser) {
    const nextBanned = !targetUser.banned;
    setMutatingUserId(targetUser.id);
    try {
      const res = await fetch(`/api/admin/users/${targetUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ banned: nextBanned }),
      });

      if (!res.ok) {
        const body = await readOptionalJson<{ error?: string }>(res);
        adminReporter.warn("update_user_status_failed_response", {
          userId: targetUser.id,
          status: res.status,
          nextBanned,
        });
        toast.error(
          getResponseErrorMessage(
            body,
            nextBanned ? "封禁用户失败" : "解封用户失败",
          ),
        );
        return;
      }

      const body = (await res.json()) as { user: Omit<AdminUser, "linkCount"> };
      setUsers((prev) =>
        prev.map((item) => {
          if (item.id !== targetUser.id) return item;
          return {
            ...item,
            ...body.user,
            linkCount: item.linkCount,
          };
        }),
      );
      setPendingUserStatusChange(null);
      toast.success(nextBanned ? "用户已封禁" : "用户已解封");
    } catch (error) {
      adminReporter.report("update_user_status_failed_exception", error, {
        userId: targetUser.id,
        nextBanned,
      });
      toast.error(
        getUserFacingErrorMessage(
          error,
          nextBanned ? "封禁用户失败" : "解封用户失败",
        ),
      );
    } finally {
      setMutatingUserId(null);
    }
  }

  function resetDomainForm() {
    setEditingDomain(null);
    setDomainForm(initialDomainForm);
  }

  function openCreateDomainDialog() {
    resetDomainForm();
    setDomainDialogOpen(true);
  }

  function openEditDomainDialog(domain: SiteDomain) {
    setEditingDomain(domain);
    setDomainForm({
      host: domain.host,
      supportsShortLinks: domain.supportsShortLinks,
      shortLinkMinSlugLength: domain.shortLinkMinSlugLength,
      supportsTempEmail: domain.supportsTempEmail,
      tempEmailMinLocalPartLength: domain.tempEmailMinLocalPartLength,
      isActive: domain.isActive,
      isDefaultShortDomain: domain.isDefaultShortDomain,
      isDefaultEmailDomain: domain.isDefaultEmailDomain,
    });
    setDomainDialogOpen(true);
  }

  async function handleViewLogs(
    link: AdminLink,
    options?: { openDialog?: boolean },
  ) {
    setSelectedLink(link);
    if (options?.openDialog) {
      setLogsDialogOpen(true);
    }
    setLogsLoading(true);
    setLogsError(null);
    try {
      const res = await fetch(`/api/admin/links/${link.id}?page=1&pageSize=50`);
      if (res.ok) {
        const body = await res.json();
        setLogs(Array.isArray(body) ? body : body.data || []);
      } else {
        const body = await readOptionalJson<{ error?: string }>(res);
        const message = getResponseErrorMessage(body, "加载日志失败");
        adminReporter.warn("view_logs_failed_response", {
          linkId: link.id,
          status: res.status,
        });
        setLogs([]);
        setLogsError(message);
        toast.error(message);
      }
    } catch (error) {
      const message = getUserFacingErrorMessage(error, "加载日志失败");
      adminReporter.report("view_logs_failed_exception", error, {
        linkId: link.id,
      });
      setLogs([]);
      setLogsError(message);
      toast.error(message);
    } finally {
      setLogsLoading(false);
    }
  }

  async function handleRefreshLogs() {
    if (!selectedLink) return;
    await handleViewLogs(selectedLink, { openDialog: logsDialogOpen });
  }

  function closeLogsDialog(open: boolean) {
    setLogsDialogOpen(open);
    if (!open) {
      setLogsError(null);
    }
  }

  async function handleSaveSettings() {
    setSavingSettings(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        toast.success("设置已保存");
      } else {
        const body = await readOptionalJson<{ error?: string }>(res);
        adminReporter.warn("save_settings_failed_response", {
          status: res.status,
        });
        toast.error(getResponseErrorMessage(body, "保存设置失败"));
      }
    } catch (error) {
      adminReporter.report("save_settings_failed_exception", error);
      toast.error(getUserFacingErrorMessage(error, "保存设置失败"));
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleSaveDomain() {
    setSavingDomain(true);
    try {
      const url = editingDomain
        ? `/api/admin/domains/${editingDomain.id}`
        : "/api/admin/domains";
      const method = editingDomain ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(domainForm),
      });

      if (!res.ok) {
        const body = await readOptionalJson<{ error?: string }>(res);
        adminReporter.warn("save_domain_failed_response", {
          domainId: editingDomain?.id ?? null,
          status: res.status,
          method,
        });
        toast.error(getResponseErrorMessage(body, "保存域名失败"));
        return;
      }

      const body = await res.json();
      const saved = body.data as SiteDomain;
      setDomains((prev) => {
        if (editingDomain) {
          return prev
            .map((item) => (item.id === saved.id ? saved : item))
            .sort((a, b) => a.host.localeCompare(b.host));
        }
        return [...prev, saved].sort((a, b) => a.host.localeCompare(b.host));
      });
      toast.success(editingDomain ? "域名已更新" : "域名已创建");
      setDomainDialogOpen(false);
      resetDomainForm();
    } catch (error) {
      adminReporter.report("save_domain_failed_exception", error, {
        domainId: editingDomain?.id ?? null,
        method: editingDomain ? "PATCH" : "POST",
      });
      toast.error(getUserFacingErrorMessage(error, "保存域名失败"));
    } finally {
      setSavingDomain(false);
    }
  }

  function updateDomainForm<K extends keyof DomainFormState>(
    key: K,
    value: DomainFormState[K],
  ) {
    setDomainForm((prev) => {
      const next = { ...prev, [key]: value };

      if (key === "supportsShortLinks" && !value) {
        next.shortLinkMinSlugLength = 1;
        next.isDefaultShortDomain = false;
      }

      if (key === "supportsTempEmail" && !value) {
        next.tempEmailMinLocalPartLength = 1;
        next.isDefaultEmailDomain = false;
      }

      if (key === "isActive" && !value) {
        next.isDefaultShortDomain = false;
        next.isDefaultEmailDomain = false;
      }

      return next;
    });
  }

  function getEmailPreview(text: string, html: string) {
    return (text || html || "").replace(/\s+/g, " ").trim() || "无正文";
  }

  function getMailboxOwnerLabel(item: {
    userName: string | null;
    userEmail: string | null;
  }) {
    return item.userName || item.userEmail || "未知用户";
  }

  const emailDetailSource = useMemo(() => {
    if (!selectedEmailItem || !emailDetail) {
      return "";
    }

    return buildAdminEmailSource(emailDetail, selectedEmailItem);
  }, [emailDetail, selectedEmailItem]);

  async function openEmailDetail(
    selection: AdminEmailSelection,
    options?: { openDialog?: boolean },
  ) {
    const requestId = latestEmailDetailRequestIdRef.current + 1;
    latestEmailDetailRequestIdRef.current = requestId;
    setSelectedEmailItem(selection);
    if (options?.openDialog) {
      setEmailDetailDialogOpen(true);
    }
    setEmailDetail(null);
    setEmailDetailError(null);
    setLoadingEmailDetail(true);
    setEmailDetailTab(getDefaultDetailTab());

    const endpoint =
      selection.kind === "message"
        ? `/api/admin/emails/messages/${selection.summary.id}`
        : `/api/admin/emails/archives/${selection.summary.id}`;

    try {
      const res = await fetch(endpoint);
      if (!res.ok) {
        const body = await readOptionalJson<{ error?: string }>(res);
        const message = getResponseErrorMessage(body, "加载邮件详情失败");
        adminReporter.warn("fetch_admin_email_detail_failed_response", {
          kind: selection.kind,
          itemId: selection.summary.id,
          status: res.status,
        });
        if (latestEmailDetailRequestIdRef.current !== requestId) {
          return;
        }
        setEmailDetailError(message);
        return;
      }

      const body = (await res.json()) as { data?: AdminEmailDetailRecord };
      if (latestEmailDetailRequestIdRef.current !== requestId) {
        return;
      }
      setEmailDetail(body.data || null);
    } catch (error) {
      const message = getUserFacingErrorMessage(error, "加载邮件详情失败");
      adminReporter.report("fetch_admin_email_detail_failed_exception", error, {
        kind: selection.kind,
        itemId: selection.summary.id,
      });
      if (latestEmailDetailRequestIdRef.current !== requestId) {
        return;
      }
      setEmailDetailError(message);
    } finally {
      if (latestEmailDetailRequestIdRef.current === requestId) {
        setLoadingEmailDetail(false);
      }
    }
  }

  function handleEmailDetailDialogOpenChange(open: boolean) {
    setEmailDetailDialogOpen(open);
  }

  const selectedLinkLogs = selectedLink ? logs : [];
  const selectedLinkBlockedEvents = selectedLinkLogs.filter(
    (log) => log.eventType !== "click" && log.eventType !== "redirect_success",
  ).length;
  const selectedLinkLimitText =
    selectedLink?.maxClicks == null
      ? "不限"
      : `${selectedLink.clicks} / ${selectedLink.maxClicks}`;
  const selectedLinkExpirationText = selectedLink?.expiresAt
    ? formatDate(selectedLink.expiresAt)
    : "长期有效";
  const selectedEmailSubject = selectedEmailItem?.summary.subject || "(无主题)";
  const selectedEmailSender = selectedEmailItem
    ? selectedEmailItem.summary.fromName || selectedEmailItem.summary.from
    : "";
  const selectedEmailRecipient = selectedEmailItem
    ? selectedEmailItem.kind === "message"
      ? selectedEmailItem.summary.mailboxEmailAddress
      : selectedEmailItem.summary.toEmail
    : "";
  const selectedEmailReceivedAt = selectedEmailItem
    ? formatDate(selectedEmailItem.summary.receivedAt)
    : "";

  const inlineEmailDetail = (
    <div className="flex min-h-0 flex-1 flex-col">
      {!selectedEmailItem ? (
        <div className="flex min-h-[32rem] flex-1 items-center justify-center px-8 text-center">
          <div className="max-w-sm space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border bg-muted/30">
              <Inbox className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold">选择一封邮件</h3>
              <p className="text-sm leading-6 text-muted-foreground">
                右侧会显示邮件正文、来源、归属和排查所需的源码内容。
              </p>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="space-y-4 border-b px-6 py-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant={
                      selectedEmailItem.kind === "archive"
                        ? "destructive"
                        : "outline"
                    }
                  >
                    {selectedEmailItem.kind === "archive"
                      ? "归档邮件"
                      : "正常邮件"}
                  </Badge>
                  {selectedEmailItem.kind === "message" && (
                    <Badge
                      variant={
                        selectedEmailItem.summary.isRead
                          ? "outline"
                          : "secondary"
                      }
                    >
                      {selectedEmailItem.summary.isRead ? "已读" : "未读"}
                    </Badge>
                  )}
                  {selectedEmailItem.summary.hasAttachments && (
                    <Badge variant="outline">附件</Badge>
                  )}
                </div>
                <h3 className="break-words text-xl font-semibold tracking-tight">
                  {selectedEmailSubject}
                </h3>
                <p className="break-all text-sm text-muted-foreground">
                  {selectedEmailSender}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEmailDetailDialogOpen(true)}
                className="h-8 shrink-0"
              >
                展开
              </Button>
            </div>

            <div className="grid gap-3 rounded-lg border bg-muted/15 p-4 text-sm sm:grid-cols-2">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">
                  {selectedEmailItem.kind === "archive"
                    ? "目标邮箱"
                    : "收件邮箱"}
                </p>
                <p className="mt-1 break-all font-mono">
                  {selectedEmailRecipient}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">所属用户</p>
                <p className="mt-1 break-all">
                  {selectedEmailItem.kind === "message"
                    ? getMailboxOwnerLabel(selectedEmailItem.summary)
                    : "未入库 / 已归档"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">接收时间</p>
                <p className="mt-1">{selectedEmailReceivedAt}</p>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">
                  {selectedEmailItem.kind === "archive"
                    ? "失败原因"
                    : "Message-ID"}
                </p>
                <p className="mt-1 break-all">
                  {selectedEmailItem.kind === "archive"
                    ? selectedEmailItem.summary.failureReason
                    : selectedEmailItem.summary.messageId || "无 Message-ID"}
                </p>
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden px-6 py-5">
            {loadingEmailDetail ? (
              <div className="flex h-full min-h-80 items-center justify-center text-sm text-muted-foreground">
                正在加载邮件详情…
              </div>
            ) : emailDetailError ? (
              <div className="flex h-full min-h-80 flex-col items-center justify-center gap-4 text-sm text-destructive">
                <p>{emailDetailError}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void openEmailDetail(selectedEmailItem)}
                >
                  重试
                </Button>
              </div>
            ) : emailDetail ? (
              <Tabs
                value={emailDetailTab}
                onValueChange={(value) =>
                  setEmailDetailTab(value as MessageDetailTab)
                }
                className="flex h-full min-h-[32rem] flex-col gap-4"
              >
                <TabsList className="w-fit">
                  <TabsTrigger value="text">TXT</TabsTrigger>
                  <TabsTrigger value="html">HTML</TabsTrigger>
                  <TabsTrigger value="source">源码</TabsTrigger>
                </TabsList>

                <TabsContent
                  value="text"
                  className="mt-0 flex-1 overflow-hidden"
                >
                  <div className="h-full overflow-auto rounded-lg border bg-muted/20 p-4">
                    {emailDetail.hasText ? (
                      <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-6">
                        {emailDetail.text}
                      </pre>
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        该邮件没有纯文本内容。
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent
                  value="html"
                  className="mt-0 flex-1 overflow-hidden"
                >
                  <div className="h-full overflow-hidden rounded-lg border bg-background">
                    {emailDetail.hasHtml ? (
                      <iframe
                        title="邮件 HTML 预览"
                        srcDoc={buildIframeSrcDoc(emailDetail.html)}
                        sandbox={iframeSandbox}
                        className="h-full w-full border-0"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                        该邮件没有 HTML 内容。
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent
                  value="source"
                  className="mt-0 flex-1 overflow-hidden"
                >
                  <div className="h-full overflow-auto rounded-lg border bg-muted/20 p-4">
                    <pre className="whitespace-pre-wrap break-words text-xs leading-6 text-foreground">
                      {emailDetailSource}
                    </pre>
                  </div>
                </TabsContent>
              </Tabs>
            ) : (
              <div className="flex h-full min-h-80 items-center justify-center text-sm text-muted-foreground">
                没有可显示的邮件详情。
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );

  const linksWorkspace = (
    <div className="grid min-h-[calc(100vh-8rem)] overflow-hidden rounded-xl border bg-card xl:grid-cols-[minmax(28rem,1fr)_minmax(28rem,0.78fr)]">
      <section className="flex min-h-0 flex-col border-b xl:border-b-0 xl:border-r">
        <div className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold tracking-tight">
                短链列表
              </h2>
              {linksTotal > 0 && (
                <span className="rounded-md bg-muted px-2 py-1 text-[10px] font-medium uppercase text-muted-foreground">
                  {linksTotal} Links
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              选择短链查看归属、限制状态和最近访问日志。
            </p>
          </div>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={handleRefreshLinks}
            disabled={loading}
            aria-label="刷新短链列表"
            title="刷新短链列表"
          >
            <RefreshCw
              className={`h-3.5 w-3.5${loading ? " animate-spin" : ""}`}
            />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          {loading ? (
            <div className="flex h-full min-h-80 items-center justify-center px-6 text-center text-sm text-muted-foreground">
              正在加载记录…
            </div>
          ) : dataError ? (
            <div className="flex h-full min-h-80 flex-col items-center justify-center gap-4 px-6 text-center">
              <p className="text-sm text-destructive">{dataError}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRefreshLinks}
              >
                重试
              </Button>
            </div>
          ) : links.length === 0 ? (
            <div className="flex h-full min-h-80 items-center justify-center px-6 text-center text-sm text-muted-foreground">
              {linksPage > 1 ? "这一页没有记录。" : "还没有链接。"}
            </div>
          ) : (
            <div className="divide-y">
              {links.map((link) => (
                <div
                  key={link.id}
                  className={`group px-5 py-4 transition-colors hover:bg-muted/35 ${
                    selectedLink?.id === link.id
                      ? "bg-primary/[0.05] ring-1 ring-inset ring-primary/40"
                      : ""
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <button
                      type="button"
                      onClick={() => void handleViewLogs(link)}
                      className="min-w-0 flex-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-mono text-sm font-semibold text-primary">
                            {link.domain}/{link.slug}
                          </p>
                          <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                            {link.originalUrl}
                          </p>
                          <p className="mt-1 truncate text-xs text-muted-foreground">
                            {link.userName || link.userEmail || "匿名用户"}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className={`h-6 shrink-0 px-2 text-[10px] font-medium ${
                            link.isExpired
                              ? "border-destructive/30 bg-destructive/5 text-destructive"
                              : "border-primary/20 bg-primary/5 text-primary"
                          }`}
                        >
                          {link.isExpired ? "已失效" : "有效"}
                        </Badge>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {link.clicks} 次点击
                        </span>
                        <span>
                          {link.maxClicks == null
                            ? "不限点击"
                            : `上限 ${link.maxClicks}`}
                        </span>
                        <span>
                          {link.expiresAt
                            ? `过期 ${formatDate(link.expiresAt)}`
                            : "长期有效"}
                        </span>
                      </div>
                    </button>

                    <div className="flex shrink-0 items-center gap-1 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() =>
                          void handleCopy(link.shortUrl, "短链已复制")
                        }
                        className="h-8 w-8"
                        aria-label="复制短链"
                        title="复制短链"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() =>
                          void handleViewLogs(link, { openDialog: true })
                        }
                        className="h-8 w-8"
                        aria-label="展开日志"
                        title="展开日志"
                      >
                        <BarChart2 className="h-4 w-4" />
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
              ))}
            </div>
          )}
        </div>

        {linksTotalPages > 1 && !dataError && (
          <div className="flex items-center justify-between border-t px-5 py-4">
            <p className="text-xs font-medium text-muted-foreground">
              页码 {linksPage} / {linksTotalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={linksPage <= 1 || loading}
                onClick={() => {
                  const nextPage = Math.max(1, linksPage - 1);
                  setLinksPage(nextPage);
                  replaceUrlState({ linksPage: nextPage });
                }}
                className="h-8"
              >
                上一页
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={linksPage >= linksTotalPages || loading}
                onClick={() => {
                  const nextPage = Math.min(linksTotalPages, linksPage + 1);
                  setLinksPage(nextPage);
                  replaceUrlState({ linksPage: nextPage });
                }}
                className="h-8"
              >
                下一页
              </Button>
            </div>
          </div>
        )}
      </section>

      <aside className="flex min-h-0 flex-col">
        {!selectedLink ? (
          <div className="flex min-h-[32rem] flex-1 items-center justify-center px-8 text-center">
            <div className="max-w-sm space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border bg-muted/30">
                <Link2 className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold">选择一条短链</h3>
                <p className="text-sm leading-6 text-muted-foreground">
                  详情面板会显示目标地址、所属用户、限制状态和最近访问日志。
                </p>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-4 border-b px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 space-y-2">
                  <p className="text-xs text-muted-foreground">短链详情</p>
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <h3 className="break-all font-mono text-xl font-semibold">
                      {selectedLink.domain}/{selectedLink.slug}
                    </h3>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() =>
                        void handleCopy(selectedLink.shortUrl, "短链已复制")
                      }
                      className="h-7 w-7"
                      aria-label="复制短链"
                      title="复制短链"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    创建于 {formatDate(selectedLink.createdAt)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge
                    variant="outline"
                    className={
                      selectedLink.isExpired
                        ? "border-destructive/30 bg-destructive/5 text-destructive"
                        : "border-primary/20 bg-primary/5 text-primary"
                    }
                  >
                    {selectedLink.isExpired ? "已失效" : "有效"}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setPendingDeleteLink(selectedLink)}
                    className="text-destructive hover:bg-destructive/10"
                    aria-label="删除短链"
                    title="删除短链"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    void handleCopy(selectedLink.shortUrl, "短链已复制")
                  }
                  className="h-8"
                >
                  <Copy className="h-3.5 w-3.5" />
                  复制
                </Button>
                <Button variant="outline" size="sm" asChild className="h-8">
                  <a
                    href={selectedLink.shortUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    打开
                  </a>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    void handleViewLogs(selectedLink, { openDialog: true })
                  }
                  className="h-8"
                >
                  <BarChart2 className="h-3.5 w-3.5" />
                  展开日志
                </Button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto px-6 py-5">
              <div className="space-y-6">
                <section className="space-y-3">
                  <h4 className="text-sm font-semibold">基本信息</h4>
                  <div className="grid gap-3 rounded-lg border bg-muted/15 p-4 text-sm sm:grid-cols-2">
                    <div className="min-w-0 sm:col-span-2">
                      <p className="text-xs text-muted-foreground">目标链接</p>
                      <p className="mt-1 break-all text-foreground">
                        {selectedLink.originalUrl}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">所属用户</p>
                      <p className="mt-1 break-all">
                        {selectedLink.userName ||
                          selectedLink.userEmail ||
                          "匿名"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">用户 ID</p>
                      <p className="mt-1 break-all font-mono text-xs">
                        {selectedLink.userId || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">有效期</p>
                      <p className="mt-1">{selectedLinkExpirationText}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">点击限制</p>
                      <p className="mt-1">{selectedLinkLimitText}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">失效原因</p>
                      <p className="mt-1">
                        {selectedLink.isExpired
                          ? selectedLink.expiredByClicks
                            ? "达到点击上限"
                            : selectedLink.expiredByDate
                              ? "超过有效期"
                              : "已失效"
                          : "无"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        域名 / 后缀
                      </p>
                      <p className="mt-1 break-all font-mono">
                        {selectedLink.domain} / {selectedLink.slug}
                      </p>
                    </div>
                  </div>
                </section>

                <section className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="text-sm font-semibold">访问概览</h4>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRefreshLogs}
                      disabled={logsLoading}
                      className="h-8"
                    >
                      <RefreshCw
                        className={`h-3.5 w-3.5${logsLoading ? " animate-spin" : ""}`}
                      />
                      刷新
                    </Button>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-lg border bg-background px-3 py-3">
                      <p className="text-xs text-muted-foreground">总点击</p>
                      <p className="mt-1 text-xl font-semibold tabular-nums">
                        {selectedLink.clicks}
                      </p>
                    </div>
                    <div className="rounded-lg border bg-background px-3 py-3">
                      <p className="text-xs text-muted-foreground">本页日志</p>
                      <p className="mt-1 text-xl font-semibold tabular-nums">
                        {selectedLinkLogs.length}
                      </p>
                    </div>
                    <div className="rounded-lg border bg-background px-3 py-3">
                      <p className="text-xs text-muted-foreground">异常事件</p>
                      <p className="mt-1 text-xl font-semibold tabular-nums">
                        {selectedLinkBlockedEvents}
                      </p>
                    </div>
                  </div>
                </section>

                <section className="space-y-3">
                  <h4 className="text-sm font-semibold">最近访问日志</h4>
                  {logsLoading ? (
                    <div className="flex h-40 items-center justify-center rounded-lg border border-dashed bg-muted/5 text-sm text-muted-foreground">
                      正在拉取日志…
                    </div>
                  ) : logsError ? (
                    <div className="flex h-40 flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-destructive/5 px-4 text-center text-sm text-destructive">
                      <p>{logsError}</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleRefreshLogs}
                      >
                        重试
                      </Button>
                    </div>
                  ) : selectedLinkLogs.length === 0 ? (
                    <div className="flex h-40 items-center justify-center rounded-lg border border-dashed bg-muted/5 text-sm text-muted-foreground">
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
                          <div
                            key={log.id}
                            className="grid grid-cols-[1fr_auto_auto] gap-3 px-3 py-3 text-sm"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-xs font-medium">
                                {formatDate(log.createdAt)}
                              </p>
                              <p className="mt-1 truncate text-xs text-muted-foreground">
                                {log.referrer || "直接访问"} ·{" "}
                                {log.ipAddress || "未知 IP"}
                              </p>
                            </div>
                            <Badge
                              variant={getLogBadgeVariant(log.eventType)}
                              className="h-6 self-center text-[10px]"
                            >
                              {getLogEventLabel(log.eventType)}
                            </Badge>
                            <span className="self-center font-mono text-xs text-muted-foreground">
                              {log.statusCode ?? "—"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              </div>
            </div>
          </>
        )}
      </aside>
    </div>
  );

  const emailsWorkspace = (
    <div className="grid min-h-[calc(100vh-8rem)] overflow-hidden rounded-xl border bg-card xl:grid-cols-[minmax(19rem,0.5fr)_minmax(24rem,0.7fr)_minmax(30rem,1fr)]">
      <section className="flex min-h-0 flex-col border-b xl:border-b-0 xl:border-r">
        <div className="space-y-3 border-b px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold tracking-tight">
                  邮箱列表
                </h2>
                {mailboxesTotal > 0 && (
                  <span className="rounded-md bg-muted px-2 py-1 text-[10px] font-medium uppercase text-muted-foreground">
                    {mailboxesTotal} Boxes
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                按用户和地址定位收件箱。
              </p>
            </div>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={handleRefreshEmailData}
              disabled={loadingEmailData}
              aria-label="刷新邮箱数据"
              title="刷新邮箱数据"
            >
              <RefreshCw
                className={`h-3.5 w-3.5${loadingEmailData ? " animate-spin" : ""}`}
              />
            </Button>
          </div>
          <div className="flex gap-2">
            <Input
              id="admin-email-search"
              name="adminEmailSearch"
              aria-label="搜索邮箱、用户、主题、发件人"
              placeholder="搜索邮箱、用户、主题、发件人…"
              autoComplete="off"
              value={emailSearch}
              onChange={(e) => setEmailSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  void handleSearchEmails();
                }
              }}
              className="h-9"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleSearchEmails()}
              disabled={loadingEmailData}
              className="h-9 shrink-0"
            >
              搜索
            </Button>
          </div>
          {emailSearch.trim() && (
            <Button
              variant="link"
              size="sm"
              onClick={handleResetEmailSearch}
              disabled={loadingEmailData && !emailDataLoaded}
              className="h-auto p-0"
            >
              清空搜索
            </Button>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          {loadingEmailData && !emailDataLoaded ? (
            <div className="flex h-full min-h-80 items-center justify-center px-6 text-center text-sm text-muted-foreground">
              正在加载邮箱…
            </div>
          ) : emailDataError ? (
            <div className="flex h-full min-h-80 flex-col items-center justify-center gap-4 px-6 text-center">
              <p className="text-sm text-destructive">{emailDataError}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRefreshEmailData}
              >
                重试
              </Button>
            </div>
          ) : mailboxes.length === 0 ? (
            <div className="flex h-full min-h-80 items-center justify-center px-6 text-center text-sm text-muted-foreground">
              {emailSearch.trim() ? "没有匹配的邮箱。" : "还没有邮箱数据。"}
            </div>
          ) : (
            <div className="divide-y">
              {mailboxes.map((mailbox) => (
                <button
                  key={mailbox.id}
                  type="button"
                  onClick={() => setSelectedMailboxId(mailbox.id)}
                  className={`block w-full px-5 py-4 text-left transition-colors hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                    selectedMailboxId === mailbox.id
                      ? "bg-primary/[0.05] ring-1 ring-inset ring-primary/40"
                      : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-all font-mono text-sm font-semibold">
                        {mailbox.emailAddress}
                      </p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {getMailboxOwnerLabel(mailbox)}
                      </p>
                      {mailbox.userEmail && (
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {mailbox.userEmail}
                        </p>
                      )}
                    </div>
                    <Badge
                      variant={mailbox.isActive ? "secondary" : "outline"}
                      className="shrink-0"
                    >
                      {mailbox.isActive ? "启用" : "停用"}
                    </Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline">{mailbox.messageCount} 封</Badge>
                    <Badge variant="outline">{mailbox.unreadCount} 未读</Badge>
                    <Badge variant="outline">
                      {formatDate(mailbox.createdAt)}
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {mailboxesTotalPages > 1 && !emailDataError && (
          <div className="flex items-center justify-between border-t px-5 py-4">
            <p className="text-xs font-medium text-muted-foreground">
              页码 {mailboxesPage} / {mailboxesTotalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={mailboxesPage <= 1 || loadingEmailData}
                onClick={() =>
                  void handleChangeMailboxesPage(
                    Math.max(1, mailboxesPage - 1),
                  )
                }
                className="h-8"
              >
                上一页
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={mailboxesPage >= mailboxesTotalPages || loadingEmailData}
                onClick={() =>
                  void handleChangeMailboxesPage(
                    Math.min(mailboxesTotalPages, mailboxesPage + 1),
                  )
                }
                className="h-8"
              >
                下一页
              </Button>
            </div>
          </div>
        )}
      </section>

      <section className="flex min-h-0 flex-col border-b xl:border-b-0 xl:border-r">
        <div className="space-y-3 border-b px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-semibold tracking-tight">
                邮件列表
              </h2>
              <p className="mt-1 break-all text-sm text-muted-foreground">
                全部邮箱
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/20 p-1">
            <Button
              type="button"
              variant={emailListMode === "messages" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => {
                setEmailListMode("messages");
                replaceUrlState({ tab: "emails", emailListMode: "messages" });
              }}
              className="h-8 justify-center"
            >
              <Inbox className="h-3.5 w-3.5" />
              正常 {messagesTotal}
            </Button>
            <Button
              type="button"
              variant={emailListMode === "archives" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => {
                setEmailListMode("archives");
                replaceUrlState({ tab: "emails", emailListMode: "archives" });
              }}
              className="h-8 justify-center"
            >
              <Archive className="h-3.5 w-3.5" />
              归档 {archivesTotal}
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          {loadingEmailData && !emailDataLoaded ? (
            <div className="flex h-full min-h-80 items-center justify-center text-sm text-muted-foreground">
              正在同步邮件…
            </div>
          ) : emailDataError ? (
            <div className="flex h-full min-h-80 items-center justify-center px-6 text-center text-sm text-destructive">
              {emailDataError}
            </div>
          ) : emailListMode === "messages" ? (
            messages.length === 0 ? (
              <div className="flex h-full min-h-80 items-center justify-center px-6 text-center text-sm text-muted-foreground">
                没有正常邮件。
              </div>
            ) : (
              <div className="divide-y">
                {messages.map((message) => (
                  <button
                    key={message.id}
                    type="button"
                    onClick={() =>
                      void openEmailDetail({
                        kind: "message",
                        summary: message,
                      })
                    }
                    className={`block w-full px-5 py-4 text-left transition-colors hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                      selectedEmailItem?.kind === "message" &&
                      selectedEmailItem.summary.id === message.id
                        ? "bg-primary/[0.05] ring-1 ring-inset ring-primary/40"
                        : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {message.fromName || message.from}
                        </p>
                        <p className={getOpenMessageSubjectButtonClassName()}>
                          {message.subject || "(无主题)"}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap justify-end gap-1">
                        <Badge
                          variant={message.isRead ? "outline" : "secondary"}
                        >
                          {message.isRead ? "已读" : "未读"}
                        </Badge>
                        {message.hasAttachments && (
                          <Badge variant="outline">附件</Badge>
                        )}
                      </div>
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                      {getEmailPreview(message.text, message.html)}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="break-all font-mono">
                        {message.mailboxEmailAddress}
                      </span>
                      <span>{formatDate(message.receivedAt)}</span>
                    </div>
                  </button>
                ))}
              </div>
            )
          ) : archives.length === 0 ? (
            <div className="flex h-full min-h-80 items-center justify-center px-6 text-center text-sm text-muted-foreground">
              没有归档邮件。
            </div>
          ) : (
            <div className="divide-y">
              {archives.map((archive) => (
                <button
                  key={archive.id}
                  type="button"
                  onClick={() =>
                    void openEmailDetail({ kind: "archive", summary: archive })
                  }
                  className={`block w-full px-5 py-4 text-left transition-colors hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                    selectedEmailItem?.kind === "archive" &&
                    selectedEmailItem.summary.id === archive.id
                      ? "bg-primary/[0.05] ring-1 ring-inset ring-primary/40"
                      : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-all font-mono text-xs text-muted-foreground">
                        {archive.toEmail}
                      </p>
                      <p className="mt-1 truncate text-sm font-medium">
                        {archive.fromName || archive.from}
                      </p>
                      <p
                        className={getOpenMessageSubjectMobileButtonClassName()}
                      >
                        {archive.subject || "(无主题)"}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap justify-end gap-1">
                      <Badge variant="destructive">
                        {archive.failureReason}
                      </Badge>
                      {archive.hasAttachments && (
                        <Badge variant="outline">附件</Badge>
                      )}
                    </div>
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                    {getEmailPreview(archive.text, archive.html)}
                  </p>
                  <p className="mt-3 text-xs text-muted-foreground">
                    {formatDate(archive.receivedAt)}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        {emailListMode === "messages" && messagesTotalPages > 1 && !emailDataError && (
          <div className="flex items-center justify-between border-t px-5 py-4">
            <p className="text-xs font-medium text-muted-foreground">
              页码 {messagesPage} / {messagesTotalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={messagesPage <= 1 || loadingEmailData}
                onClick={() =>
                  void handleChangeMessagesPage(Math.max(1, messagesPage - 1))
                }
                className="h-8"
              >
                上一页
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={messagesPage >= messagesTotalPages || loadingEmailData}
                onClick={() =>
                  void handleChangeMessagesPage(
                    Math.min(messagesTotalPages, messagesPage + 1),
                  )
                }
                className="h-8"
              >
                下一页
              </Button>
            </div>
          </div>
        )}

        {emailListMode === "archives" && archivesTotalPages > 1 && !emailDataError && (
          <div className="flex items-center justify-between border-t px-5 py-4">
            <p className="text-xs font-medium text-muted-foreground">
              页码 {archivesPage} / {archivesTotalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={archivesPage <= 1 || loadingEmailData}
                onClick={() =>
                  void handleChangeArchivesPage(Math.max(1, archivesPage - 1))
                }
                className="h-8"
              >
                上一页
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={archivesPage >= archivesTotalPages || loadingEmailData}
                onClick={() =>
                  void handleChangeArchivesPage(
                    Math.min(archivesTotalPages, archivesPage + 1),
                  )
                }
                className="h-8"
              >
                下一页
              </Button>
            </div>
          </div>
        )}
      </section>

      <aside className="flex min-h-0 flex-col">{inlineEmailDetail}</aside>
    </div>
  );

  const activeTabLabel =
    activeTab === "links"
      ? "链接管理"
      : activeTab === "users"
        ? "用户管理"
        : activeTab === "emails"
          ? "邮箱排查"
          : "站点设置";

  return (
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
            <SidebarGroupLabel>管理导航</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    type="button"
                    isActive={activeTab === "users"}
                    onClick={() => handleChangeTab("users")}
                    tooltip="用户管理"
                  >
                    <Users className="h-4 w-4" />
                    <span>用户</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    type="button"
                    isActive={activeTab === "links"}
                    onClick={() => handleChangeTab("links")}
                    tooltip="链接管理"
                  >
                    <Link2 className="h-4 w-4" />
                    <span>链接</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    type="button"
                    isActive={activeTab === "emails"}
                    onClick={() => handleChangeTab("emails")}
                    tooltip="邮箱排查"
                  >
                    <Mail className="h-4 w-4" />
                    <span>邮箱</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    type="button"
                    isActive={activeTab === "settings"}
                    onClick={() => handleChangeTab("settings")}
                    tooltip="站点设置"
                  >
                    <Settings2 className="h-4 w-4" />
                    <span>设置</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarSeparator />
        <SidebarFooter className="p-3">
          <div className="rounded-lg border border-sidebar-border/60 bg-sidebar-accent/40 p-1.5">
            <UserMenu
              user={user}
              layout="panel"
              align="start"
              className="text-sidebar-foreground hover:bg-sidebar-accent/80 hover:text-sidebar-foreground"
            />
          </div>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
          <div className="flex h-14 items-center px-[var(--page-gutter)]">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="-ml-1" />
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <h1 className="text-sm font-medium">{activeTabLabel}</h1>
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[96rem] flex-1 px-[var(--page-gutter)] py-5 sm:py-6 lg:py-8">
          <Tabs
            value={activeTab}
            onValueChange={handleChangeTab}
            className="space-y-5 sm:space-y-6"
          >
            <TabsContent value="links" className="mt-0">
              {linksWorkspace}
            </TabsContent>

            <TabsContent value="users" className="mt-0">
              <Card>
                <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle className="text-base">用户</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefreshUsers}
                    disabled={loading}
                  >
                    刷新
                  </Button>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="py-14 text-center text-sm text-muted-foreground">
                      正在加载…
                    </div>
                  ) : dataError ? (
                    <div className="space-y-4 py-14 text-center text-sm text-destructive">
                      <p>{dataError}</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleRefreshUsers}
                      >
                        重试
                      </Button>
                    </div>
                  ) : users.length === 0 ? (
                    <div className="py-14 text-center text-sm text-muted-foreground">
                      还没有用户。
                    </div>
                  ) : isDesktop ? (
                    <div className="overflow-x-auto rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="min-w-[120px]">
                              名称
                            </TableHead>
                            <TableHead className="min-w-[160px]">
                              邮箱
                            </TableHead>
                            <TableHead className="w-24">角色</TableHead>
                            <TableHead className="w-24">状态</TableHead>
                            <TableHead className="w-20 text-center hidden sm:table-cell">
                              链接数
                            </TableHead>
                            <TableHead className="w-32 hidden md:table-cell">
                              加入时间
                            </TableHead>
                            <TableHead className="w-24 text-right">
                              操作
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {users.map((u) => (
                            <TableRow key={u.id}>
                              <TableCell className="font-medium">
                                {u.name}
                              </TableCell>
                              <TableCell>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="truncate text-sm text-muted-foreground">
                                      {u.email}
                                    </p>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon-sm"
                                      className="shrink-0"
                                      onClick={() =>
                                        void handleCopy(
                                          u.email,
                                          "用户邮箱已复制",
                                        )
                                      }
                                      aria-label={`复制用户邮箱 ${u.email}`}
                                      title="复制用户邮箱"
                                    >
                                      <Copy className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    u.role === "admin" ? "default" : "secondary"
                                  }
                                >
                                  {u.role}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={u.banned ? "destructive" : "outline"}
                                  title={
                                    u.banned && u.banReason
                                      ? u.banReason
                                      : undefined
                                  }
                                >
                                  {u.banned ? "已封禁" : "正常"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center text-sm hidden sm:table-cell">
                                {u.linkCount}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground hidden md:table-cell">
                                {formatDate(u.createdAt)}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  type="button"
                                  variant={u.banned ? "outline" : "destructive"}
                                  size="sm"
                                  onClick={() => setPendingUserStatusChange(u)}
                                  disabled={mutatingUserId === u.id}
                                >
                                  {u.banned ? (
                                    <UserCheck className="h-4 w-4" />
                                  ) : (
                                    <UserX className="h-4 w-4" />
                                  )}
                                  {u.banned ? "解封" : "封禁"}
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {users.map((u) => (
                        <div key={u.id} className="rounded-lg border p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-medium">{u.name}</p>
                              <div className="mt-1 flex items-center gap-2">
                                <p className="truncate text-sm text-muted-foreground">
                                  {u.email}
                                </p>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  className="shrink-0"
                                  onClick={() =>
                                    void handleCopy(u.email, "用户邮箱已复制")
                                  }
                                  aria-label={`复制用户邮箱 ${u.email}`}
                                  title="复制用户邮箱"
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-2">
                              <Badge
                                variant={
                                  u.role === "admin" ? "default" : "secondary"
                                }
                              >
                                {u.role}
                              </Badge>
                              <Badge
                                variant={u.banned ? "destructive" : "outline"}
                              >
                                {u.banned ? "已封禁" : "正常"}
                              </Badge>
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                            <Badge variant="outline">链接 {u.linkCount}</Badge>
                            <Badge variant="outline">
                              {formatDate(u.createdAt)}
                            </Badge>
                          </div>
                          {u.banned && u.banReason && (
                            <p className="mt-3 text-xs text-muted-foreground">
                              原因：{u.banReason}
                            </p>
                          )}
                          <div className="mt-4 flex justify-end">
                            <Button
                              type="button"
                              variant={u.banned ? "outline" : "destructive"}
                              size="sm"
                              onClick={() => setPendingUserStatusChange(u)}
                              disabled={mutatingUserId === u.id}
                            >
                              {u.banned ? (
                                <UserCheck className="h-4 w-4" />
                              ) : (
                                <UserX className="h-4 w-4" />
                              )}
                              {u.banned ? "解封用户" : "封禁用户"}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="emails" className="mt-0 space-y-6">
              {emailsWorkspace}
            </TabsContent>

            <TabsContent value="settings" className="mt-0">
              <div className="grid gap-6 xl:grid-cols-[minmax(0,28rem)_minmax(0,1fr)]">
                <Card>
                  <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <CardTitle className="text-base">站点设置</CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRefreshSettings}
                      disabled={loading}
                    >
                      刷新
                    </Button>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="siteName">网站名称</Label>
                      <Input
                        id="siteName"
                        name="siteName"
                        autoComplete="organization"
                        value={settings.siteName}
                        onChange={(e) =>
                          setSettings((s) => ({
                            ...s,
                            siteName: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="siteUrl">站点地址</Label>
                      <Input
                        id="siteUrl"
                        name="siteUrl"
                        type="url"
                        autoComplete="url"
                        value={settings.siteUrl}
                        onChange={(e) =>
                          setSettings((s) => ({
                            ...s,
                            siteUrl: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="telegramBotUsername">TG Bot 用户名</Label>
                      <Input
                        id="telegramBotUsername"
                        name="telegramBotUsername"
                        placeholder="例如：shortly_bot（可填写 @shortly_bot）…"
                        autoComplete="off"
                        spellCheck={false}
                        value={settings.telegramBotUsername}
                        onChange={(e) =>
                          setSettings((s) => ({
                            ...s,
                            telegramBotUsername: e.target.value,
                          }))
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        设置后，用户后台 API 页面会显示机器人绑定提示：`/setkey
                        &lt;api_key&gt;`。
                      </p>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="userMaxLinksPerHour">
                        用户每小时创建数（短链 / 临时邮箱）
                      </Label>
                      <Input
                        id="userMaxLinksPerHour"
                        name="userMaxLinksPerHour"
                        type="number"
                        min="1"
                        autoComplete="off"
                        inputMode="numeric"
                        value={settings.userMaxLinksPerHour}
                        onChange={(e) =>
                          setSettings((s) => ({
                            ...s,
                            userMaxLinksPerHour: parseInt(e.target.value) || 0,
                          }))
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        该上限同时应用于短链创建和临时邮箱创建。
                      </p>
                    </div>
                    <Button
                      onClick={handleSaveSettings}
                      disabled={savingSettings}
                      className="mt-2 w-full sm:w-fit"
                    >
                      <Save className="h-4 w-4" />
                      {savingSettings ? "保存中…" : "保存"}
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <CardTitle className="text-base">域名</CardTitle>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRefreshDomains}
                        disabled={loading}
                      >
                        刷新
                      </Button>
                      <Button
                        onClick={openCreateDomainDialog}
                        size="sm"
                        className="w-full sm:w-auto"
                      >
                        <Plus className="h-4 w-4" />
                        新增
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <div className="py-14 text-center text-sm text-muted-foreground">
                        正在加载…
                      </div>
                    ) : dataError ? (
                      <div className="space-y-4 py-14 text-center text-sm text-destructive">
                        <p>{dataError}</p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleRefreshDomains}
                        >
                          重试
                        </Button>
                      </div>
                    ) : domains.length === 0 ? (
                      <div className="py-14 text-center text-sm text-muted-foreground">
                        还没有域名。
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-lg border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="min-w-[180px]">
                                域名
                              </TableHead>
                              <TableHead className="min-w-[180px]">
                                能力
                              </TableHead>
                              <TableHead className="min-w-[180px]">
                                默认
                              </TableHead>
                              <TableHead className="w-24">状态</TableHead>
                              <TableHead className="w-32 hidden md:table-cell">
                                创建时间
                              </TableHead>
                              <TableHead className="w-24 text-right">
                                操作
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {domains.map((domain) => (
                              <TableRow key={domain.id}>
                                <TableCell>
                                  <div className="flex items-start gap-2 min-w-0">
                                    <p className="break-all font-mono text-sm">
                                      {domain.host}
                                    </p>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon-sm"
                                      className="shrink-0"
                                      onClick={() =>
                                        void handleCopy(
                                          domain.host,
                                          "域名已复制",
                                        )
                                      }
                                      aria-label={`复制域名 ${domain.host}`}
                                      title="复制域名"
                                    >
                                      <Copy className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-wrap gap-2">
                                    {domain.supportsShortLinks && (
                                      <Badge variant="secondary">
                                        短链 ≥ {domain.shortLinkMinSlugLength}
                                      </Badge>
                                    )}
                                    {domain.supportsTempEmail && (
                                      <Badge variant="secondary">
                                        邮箱前缀 ≥{" "}
                                        {domain.tempEmailMinLocalPartLength}
                                      </Badge>
                                    )}
                                    {!domain.supportsShortLinks &&
                                      !domain.supportsTempEmail && (
                                        <span className="text-sm text-muted-foreground">
                                          —
                                        </span>
                                      )}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-wrap gap-2">
                                    {domain.isDefaultShortDomain && (
                                      <Badge>默认短链</Badge>
                                    )}
                                    {domain.isDefaultEmailDomain && (
                                      <Badge>默认邮箱</Badge>
                                    )}
                                    {!domain.isDefaultShortDomain &&
                                      !domain.isDefaultEmailDomain && (
                                        <span className="text-sm text-muted-foreground">
                                          —
                                        </span>
                                      )}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    variant={
                                      domain.isActive ? "secondary" : "outline"
                                    }
                                  >
                                    {domain.isActive ? "启用" : "停用"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground hidden md:table-cell">
                                  {formatDate(domain.createdAt)}
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() =>
                                        openEditDomainDialog(domain)
                                      }
                                      title="编辑域名"
                                      aria-label={`编辑域名 ${domain.host}`}
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() =>
                                        setPendingDeleteDomain(domain)
                                      }
                                      className="text-destructive hover:text-destructive"
                                      title="删除域名"
                                      aria-label={`删除域名 ${domain.host}`}
                                      disabled={
                                        domain.isDefaultShortDomain ||
                                        domain.isDefaultEmailDomain
                                      }
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </main>

        <Dialog
          open={domainDialogOpen}
          onOpenChange={(open) => {
            setDomainDialogOpen(open);
            if (!open) resetDomainForm();
          }}
        >
          <DialogContent className="w-[calc(100vw-2rem)] max-h-[min(92vh,48rem)] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingDomain ? "编辑域名" : "新增域名"}
              </DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="domainHost">域名</Label>
                <Input
                  id="domainHost"
                  name="domainHost"
                  placeholder="example.com…"
                  autoComplete="off"
                  spellCheck={false}
                  value={domainForm.host}
                  onChange={(e) => updateDomainForm("host", e.target.value)}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex items-center gap-3 rounded-lg border px-3 py-2 text-sm">
                  <input
                    name="supportsShortLinks"
                    type="checkbox"
                    checked={domainForm.supportsShortLinks}
                    onChange={(e) =>
                      updateDomainForm("supportsShortLinks", e.target.checked)
                    }
                    className="h-4 w-4 rounded border shrink-0"
                  />
                  支持短链接
                </label>
                <label className="flex items-center gap-3 rounded-lg border px-3 py-2 text-sm">
                  <input
                    name="supportsTempEmail"
                    type="checkbox"
                    checked={domainForm.supportsTempEmail}
                    onChange={(e) =>
                      updateDomainForm("supportsTempEmail", e.target.checked)
                    }
                    className="h-4 w-4 rounded border shrink-0"
                  />
                  支持临时邮箱
                </label>
                <label className="flex items-center gap-3 rounded-lg border px-3 py-2 text-sm">
                  <input
                    name="isActive"
                    type="checkbox"
                    checked={domainForm.isActive}
                    onChange={(e) =>
                      updateDomainForm("isActive", e.target.checked)
                    }
                    className="h-4 w-4 rounded border shrink-0"
                  />
                  启用域名
                </label>
                <label className="flex items-center gap-3 rounded-lg border px-3 py-2 text-sm">
                  <input
                    name="isDefaultShortDomain"
                    type="checkbox"
                    checked={domainForm.isDefaultShortDomain}
                    onChange={(e) =>
                      updateDomainForm("isDefaultShortDomain", e.target.checked)
                    }
                    className="h-4 w-4 rounded border shrink-0"
                    disabled={
                      !domainForm.supportsShortLinks || !domainForm.isActive
                    }
                  />
                  默认短链域名
                </label>
                <label className="flex items-center gap-3 rounded-lg border px-3 py-2 text-sm sm:col-span-2">
                  <input
                    name="isDefaultEmailDomain"
                    type="checkbox"
                    checked={domainForm.isDefaultEmailDomain}
                    onChange={(e) =>
                      updateDomainForm("isDefaultEmailDomain", e.target.checked)
                    }
                    className="h-4 w-4 rounded border shrink-0"
                    disabled={
                      !domainForm.supportsTempEmail || !domainForm.isActive
                    }
                  />
                  默认邮箱域名
                </label>
              </div>

              {domainForm.supportsShortLinks && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="domainShortLinkMinSlugLength">
                    短链最短后缀长度
                  </Label>
                  <Input
                    id="domainShortLinkMinSlugLength"
                    name="domainShortLinkMinSlugLength"
                    type="number"
                    min="1"
                    max="50"
                    autoComplete="off"
                    inputMode="numeric"
                    value={domainForm.shortLinkMinSlugLength}
                    onChange={(e) =>
                      updateDomainForm(
                        "shortLinkMinSlugLength",
                        Math.min(
                          50,
                          Math.max(1, parseInt(e.target.value, 10) || 1),
                        ),
                      )
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    自定义短链后缀少于该长度时将被拒绝。
                  </p>
                </div>
              )}

              {domainForm.supportsTempEmail && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="domainTempEmailMinLocalPartLength">
                    邮箱前缀最短长度
                  </Label>
                  <Input
                    id="domainTempEmailMinLocalPartLength"
                    name="domainTempEmailMinLocalPartLength"
                    type="number"
                    min="1"
                    max="64"
                    autoComplete="off"
                    inputMode="numeric"
                    value={domainForm.tempEmailMinLocalPartLength}
                    onChange={(e) =>
                      updateDomainForm(
                        "tempEmailMinLocalPartLength",
                        Math.min(
                          64,
                          Math.max(1, parseInt(e.target.value, 10) || 1),
                        ),
                      )
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    邮箱地址中 @ 前的前缀少于该长度时将被拒绝。
                  </p>
                </div>
              )}

              <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
                <Button
                  variant="outline"
                  onClick={() => setDomainDialogOpen(false)}
                  className="w-full sm:w-auto"
                >
                  取消
                </Button>
                <Button
                  onClick={handleSaveDomain}
                  disabled={savingDomain}
                  className="w-full sm:w-auto"
                >
                  <Save className="h-4 w-4" />
                  {savingDomain
                    ? "保存中…"
                    : editingDomain
                      ? "保存修改"
                      : "创建域名"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog
          open={emailDetailDialogOpen && !!selectedEmailItem}
          onOpenChange={handleEmailDetailDialogOpenChange}
        >
          <DialogContent className={getMessageDetailDialogClassName()}>
            <DialogHeader className="border-b pb-4 pr-8">
              <DialogTitle className="break-words">
                {selectedEmailItem?.summary.subject || "(无主题)"}
              </DialogTitle>
              <DialogDescription className="space-y-2 pt-2 text-xs sm:text-sm">
                {selectedEmailItem?.kind === "message" ? (
                  <>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">正常邮件</Badge>
                      {emailDetail && "isRead" in emailDetail && (
                        <Badge
                          variant={emailDetail.isRead ? "outline" : "secondary"}
                        >
                          {emailDetail.isRead ? "已读" : "未读"}
                        </Badge>
                      )}
                      {emailDetail?.hasAttachments && (
                        <Badge variant="outline">
                          附件 {emailDetail.attachments.length}
                        </Badge>
                      )}
                    </div>
                    <div className="space-y-1 text-muted-foreground">
                      <p className="break-all">
                        发件人：
                        {selectedEmailItem.summary.fromName ||
                          selectedEmailItem.summary.from}
                      </p>
                      <p className="break-all">
                        收件邮箱：
                        {selectedEmailItem.summary.mailboxEmailAddress}
                      </p>
                      <p className="break-all">
                        所属用户：
                        {getMailboxOwnerLabel(selectedEmailItem.summary)}
                      </p>
                      <p>
                        时间：{formatDate(selectedEmailItem.summary.receivedAt)}
                      </p>
                    </div>
                  </>
                ) : selectedEmailItem ? (
                  <>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="destructive">
                        {selectedEmailItem.summary.failureReason}
                      </Badge>
                      {emailDetail?.hasAttachments && (
                        <Badge variant="outline">
                          附件 {emailDetail.attachments.length}
                        </Badge>
                      )}
                    </div>
                    <div className="space-y-1 text-muted-foreground">
                      <p className="break-all">
                        发件人：
                        {selectedEmailItem.summary.fromName ||
                          selectedEmailItem.summary.from}
                      </p>
                      <p className="break-all">
                        目标邮箱：{selectedEmailItem.summary.toEmail}
                      </p>
                      <p>
                        时间：{formatDate(selectedEmailItem.summary.receivedAt)}
                      </p>
                    </div>
                  </>
                ) : null}
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-hidden py-4">
              {loadingEmailDetail ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  正在加载邮件详情…
                </div>
              ) : emailDetailError ? (
                <div className="flex h-full flex-col items-center justify-center gap-4 text-sm text-destructive">
                  <p>{emailDetailError}</p>
                  {selectedEmailItem && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void openEmailDetail(selectedEmailItem)}
                    >
                      重试
                    </Button>
                  )}
                </div>
              ) : emailDetail ? (
                <Tabs
                  value={emailDetailTab}
                  onValueChange={(value) =>
                    setEmailDetailTab(value as MessageDetailTab)
                  }
                  className="flex h-full flex-col gap-4"
                >
                  <TabsList className="w-fit">
                    <TabsTrigger value="text">TXT</TabsTrigger>
                    <TabsTrigger value="html">HTML</TabsTrigger>
                    <TabsTrigger value="source">源码</TabsTrigger>
                  </TabsList>

                  <TabsContent
                    value="text"
                    className="mt-0 flex-1 overflow-hidden"
                  >
                    <div className="h-full overflow-auto rounded-lg border bg-muted/20 p-4">
                      {emailDetail.hasText ? (
                        <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-6">
                          {emailDetail.text}
                        </pre>
                      ) : (
                        <div className="text-sm text-muted-foreground">
                          该邮件没有纯文本内容。
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent
                    value="html"
                    className="mt-0 flex-1 overflow-hidden"
                  >
                    <div className="h-full overflow-hidden rounded-lg border bg-background">
                      {emailDetail.hasHtml ? (
                        <iframe
                          title="邮件 HTML 预览"
                          srcDoc={buildIframeSrcDoc(emailDetail.html)}
                          sandbox={iframeSandbox}
                          className="h-full w-full border-0"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                          该邮件没有 HTML 内容。
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent
                    value="source"
                    className="mt-0 flex-1 overflow-hidden"
                  >
                    <div className="h-full overflow-auto rounded-lg border bg-muted/20 p-4">
                      <pre className="whitespace-pre-wrap break-words text-xs leading-6 text-foreground">
                        {emailDetailSource}
                      </pre>
                    </div>
                  </TabsContent>
                </Tabs>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  没有可显示的邮件详情。
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={logsDialogOpen} onOpenChange={closeLogsDialog}>
          <DialogContent className="w-[calc(100vw-2rem)] max-h-[min(92vh,44rem)] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle className="break-words">
                日志
                {selectedLink && (
                  <span className="ml-2 break-all font-mono text-sm text-muted-foreground">
                    /{selectedLink.slug}
                  </span>
                )}
              </DialogTitle>
              <DialogDescription>查看访问记录。</DialogDescription>
            </DialogHeader>
            <div className="mb-4 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefreshLogs}
                disabled={logsLoading || !selectedLink}
              >
                刷新
              </Button>
            </div>
            {logsLoading ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                正在加载…
              </div>
            ) : logsError ? (
              <div className="space-y-4 py-10 text-center text-sm text-destructive">
                <p>{logsError}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRefreshLogs}
                >
                  重试
                </Button>
              </div>
            ) : logs.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                {selectedLink ? "还没有日志。" : "先选择一条短链。"}
              </div>
            ) : isDesktop ? (
              <div className="max-h-80 overflow-y-auto overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[140px]">时间</TableHead>
                      <TableHead className="min-w-[120px]">事件</TableHead>
                      <TableHead className="w-20 text-center hidden sm:table-cell">
                        状态码
                      </TableHead>
                      <TableHead className="min-w-[140px]">来源</TableHead>
                      <TableHead className="hidden md:table-cell">IP</TableHead>
                      <TableHead className="hidden lg:table-cell">
                        浏览器
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                          {formatDate(log.createdAt)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Badge variant={getLogBadgeVariant(log.eventType)}>
                            {getLogEventLabel(log.eventType)}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden text-center text-sm text-muted-foreground sm:table-cell">
                          {log.statusCode ?? "—"}
                        </TableCell>
                        <TableCell className="max-w-[160px] truncate text-sm">
                          {log.referrer || (
                            <span className="text-muted-foreground">
                              直接访问
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="hidden max-w-[160px] truncate text-sm text-muted-foreground md:table-cell">
                          {log.ipAddress || "—"}
                        </TableCell>
                        <TableCell className="hidden max-w-[160px] truncate text-sm text-muted-foreground lg:table-cell">
                          {log.userAgent?.split(" ").slice(-1)[0] || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="space-y-3">
                {logs.map((log) => (
                  <div key={log.id} className="rounded-lg border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <Badge variant={getLogBadgeVariant(log.eventType)}>
                        {getLogEventLabel(log.eventType)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(log.createdAt)}
                      </span>
                    </div>
                    <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                      <p>状态码：{log.statusCode ?? "—"}</p>
                      <p className="break-all">
                        来源：{log.referrer || "直接访问"}
                      </p>
                      <p className="break-all">IP：{log.ipAddress || "—"}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog
          open={!!pendingDeleteLink}
          onOpenChange={(open) => !open && setPendingDeleteLink(null)}
        >
          <DialogContent className="w-[calc(100vw-2rem)] max-w-md">
            <DialogHeader>
              <DialogTitle>确认删除短链？</DialogTitle>
              <DialogDescription>
                删除后将无法恢复。
                {pendingDeleteLink && (
                  <span className="mt-2 block break-all font-mono text-xs text-muted-foreground">
                    /{pendingDeleteLink.slug}
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setPendingDeleteLink(null)}
              >
                取消
              </Button>
              <Button
                variant="destructive"
                onClick={() =>
                  pendingDeleteLink &&
                  handleDeleteLinkConfirm(pendingDeleteLink)
                }
                disabled={!!deletingLinkId}
              >
                {deletingLinkId ? "删除中…" : "确认删除"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={!!pendingDeleteDomain}
          onOpenChange={(open) => !open && setPendingDeleteDomain(null)}
        >
          <DialogContent className="w-[calc(100vw-2rem)] max-w-md">
            <DialogHeader>
              <DialogTitle>确认删除域名？</DialogTitle>
              <DialogDescription>
                {pendingDeleteDomain
                  ? getDomainDeleteHelpText(pendingDeleteDomain)
                  : "删除后将无法恢复。"}
                {pendingDeleteDomain && (
                  <span className="mt-2 block break-all font-mono text-xs text-muted-foreground">
                    {pendingDeleteDomain.host}
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setPendingDeleteDomain(null)}
              >
                取消
              </Button>
              <Button
                variant="destructive"
                onClick={() =>
                  pendingDeleteDomain &&
                  handleDeleteDomainConfirm(pendingDeleteDomain)
                }
                disabled={!!deletingDomainId}
              >
                {deletingDomainId ? "删除中…" : "确认删除"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={!!pendingUserStatusChange}
          onOpenChange={(open) => !open && setPendingUserStatusChange(null)}
        >
          <DialogContent className="w-[calc(100vw-2rem)] max-w-md">
            <DialogHeader>
              <DialogTitle>
                {pendingUserStatusChange?.banned
                  ? "确认解封用户？"
                  : "确认封禁用户？"}
              </DialogTitle>
              <DialogDescription>
                {pendingUserStatusChange?.banned
                  ? "解封后该用户可以重新登录并使用账号功能。"
                  : "封禁后该用户现有会话会立即失效，且无法继续登录或使用 API Key。"}
                {pendingUserStatusChange && (
                  <span className="mt-2 block break-all font-mono text-xs text-muted-foreground">
                    {pendingUserStatusChange.email}
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setPendingUserStatusChange(null)}
                disabled={!!mutatingUserId}
              >
                取消
              </Button>
              <Button
                variant={
                  pendingUserStatusChange?.banned ? "default" : "destructive"
                }
                onClick={() =>
                  pendingUserStatusChange &&
                  handleUserStatusConfirm(pendingUserStatusChange)
                }
                disabled={!!mutatingUserId}
              >
                {pendingUserStatusChange?.banned ? (
                  <UserCheck className="h-4 w-4" />
                ) : (
                  <UserX className="h-4 w-4" />
                )}
                {mutatingUserId
                  ? pendingUserStatusChange?.banned
                    ? "解封中…"
                    : "封禁中…"
                  : pendingUserStatusChange?.banned
                    ? "确认解封"
                    : "确认封禁"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SidebarInset>
    </SidebarProvider>
  );
}
