import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core"
import { sql } from "drizzle-orm"

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  role: text("role").notNull().default("user"),
  banned: integer("banned", { mode: "boolean" }).notNull().default(false),
  banReason: text("ban_reason"),
  banExpires: integer("ban_expires", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
})

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
})

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp" }),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp" }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
})

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
})

export const passkey = sqliteTable("passkey", {
  id: text("id").primaryKey(),
  name: text("name"),
  publicKey: text("public_key").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  credentialID: text("credential_id").notNull(),
  counter: integer("counter").notNull(),
  deviceType: text("device_type").notNull(),
  backedUp: integer("backed_up", { mode: "boolean" }).notNull(),
  transports: text("transports"),
  aaguid: text("aaguid"),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
})

export const shortLink = sqliteTable("short_link", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
  originalUrl: text("original_url").notNull(),
  slug: text("slug").notNull(),
  domain: text("domain").notNull().default(""),
  clicks: integer("clicks").notNull().default(0),
  expiresAt: integer("expires_at", { mode: "timestamp" }),
  maxClicks: integer("max_clicks"),
  creatorIp: text("creator_ip"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (t) => ({
  domainSlugIdx: uniqueIndex("short_link_domain_slug_idx").on(t.domain, t.slug),
  userIdIdx: index("short_link_user_id_idx").on(t.userId),
  createdAtIdx: index("short_link_created_at_idx").on(t.createdAt),
  creatorIpIdx: index("short_link_creator_ip_idx").on(t.creatorIp),
  domainIdx: index("short_link_domain_idx").on(t.domain),
}))

export const clickLog = sqliteTable("click_log", {
  id: text("id").primaryKey(),
  linkId: text("link_id")
    .notNull()
    .references(() => shortLink.id, { onDelete: "cascade" }),
  referrer: text("referrer"),
  userAgent: text("user_agent"),
  ipAddress: text("ip_address"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (t) => ({
  linkIdIdx: index("click_log_link_id_idx").on(t.linkId),
  createdAtIdx: index("click_log_created_at_idx").on(t.createdAt),
}))

export const linkLog = sqliteTable("link_log", {
  id: text("id").primaryKey(),
  linkId: text("link_id"),
  linkSlug: text("link_slug").notNull(),
  ownerUserId: text("owner_user_id"),
  eventType: text("event_type").notNull(),
  referrer: text("referrer"),
  userAgent: text("user_agent"),
  ipAddress: text("ip_address"),
  statusCode: integer("status_code"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (t) => ({
  linkIdIdx: index("link_log_link_id_idx").on(t.linkId),
  ownerUserIdIdx: index("link_log_owner_user_id_idx").on(t.ownerUserId),
  eventTypeIdx: index("link_log_event_type_idx").on(t.eventType),
  createdAtIdx: index("link_log_created_at_idx").on(t.createdAt),
}))

export const siteSetting = sqliteTable("site_setting", {
  id: text("id").primaryKey().default("default"),
  siteName: text("site_name").notNull().default("Shortly"),
  siteUrl: text("site_url").notNull().default(""),
  telegramBotUsername: text("telegram_bot_username").notNull().default(""),
  userMaxLinksPerHour: integer("user_max_links_per_hour").notNull().default(50),
})

export const siteDomain = sqliteTable("site_domain", {
  id: text("id").primaryKey(),
  host: text("host").notNull(),
  supportsShortLinks: integer("supports_short_links", { mode: "boolean" }).notNull().default(false),
  shortLinkMinSlugLength: integer("short_link_min_slug_length").notNull().default(1),
  supportsTempEmail: integer("supports_temp_email", { mode: "boolean" }).notNull().default(false),
  tempEmailMinLocalPartLength: integer("temp_email_min_local_part_length").notNull().default(1),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  isDefaultShortDomain: integer("is_default_short_domain", { mode: "boolean" }).notNull().default(false),
  isDefaultEmailDomain: integer("is_default_email_domain", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (t) => ({
  hostIdx: uniqueIndex("site_domain_host_idx").on(t.host),
  shortDomainIdx: index("site_domain_short_idx").on(t.supportsShortLinks, t.isActive),
  emailDomainIdx: index("site_domain_email_idx").on(t.supportsTempEmail, t.isActive),
}))

export const telegramBinding = sqliteTable("telegram_binding", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  chatId: text("chat_id").notNull(),
  username: text("username"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (t) => ({
  userIdIdx: uniqueIndex("telegram_binding_user_id_idx").on(t.userId),
  chatIdIdx: uniqueIndex("telegram_binding_chat_id_idx").on(t.chatId),
}))

export const tempMailbox = sqliteTable("temp_mailbox", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  emailAddress: text("email_address").notNull(),
  localPart: text("local_part").notNull(),
  domain: text("domain").notNull(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (t) => ({
  emailAddressIdx: uniqueIndex("temp_mailbox_email_address_idx").on(t.emailAddress),
  userIdIdx: index("temp_mailbox_user_id_idx").on(t.userId),
  domainIdx: index("temp_mailbox_domain_idx").on(t.domain),
}))

export const tempEmailMessage = sqliteTable("temp_email_message", {
  id: text("id").primaryKey(),
  mailboxId: text("mailbox_id")
    .notNull()
    .references(() => tempMailbox.id, { onDelete: "cascade" }),
  messageId: text("message_id"),
  from: text("from").notNull(),
  fromName: text("from_name"),
  subject: text("subject").notNull().default(""),
  text: text("text").notNull().default(""),
  html: text("html").notNull().default(""),
  receivedAt: integer("received_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  isRead: integer("is_read", { mode: "boolean" }).notNull().default(false),
  ccJson: text("cc_json").notNull().default("[]"),
  replyToJson: text("reply_to_json").notNull().default("[]"),
  headersJson: text("headers_json").notNull().default("[]"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (t) => ({
  mailboxIdIdx: index("temp_email_message_mailbox_id_idx").on(t.mailboxId),
  messageIdIdx: index("temp_email_message_message_id_idx").on(t.messageId),
  receivedAtIdx: index("temp_email_message_received_at_idx").on(t.receivedAt),
}))

export const tempEmailAttachment = sqliteTable("temp_email_attachment", {
  id: text("id").primaryKey(),
  messageId: text("message_id")
    .notNull()
    .references(() => tempEmailMessage.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(),
  r2Path: text("r2_path").notNull(),
  size: integer("size").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (t) => ({
  messageIdIdx: index("temp_email_attachment_message_id_idx").on(t.messageId),
}))

export const tempEmailArchive = sqliteTable("temp_email_archive", {
  id: text("id").primaryKey(),
  toEmail: text("to_email").notNull(),
  messageId: text("message_id"),
  from: text("from").notNull(),
  fromName: text("from_name"),
  subject: text("subject").notNull().default(""),
  text: text("text").notNull().default(""),
  html: text("html").notNull().default(""),
  receivedAt: integer("received_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  ccJson: text("cc_json").notNull().default("[]"),
  replyToJson: text("reply_to_json").notNull().default("[]"),
  headersJson: text("headers_json").notNull().default("[]"),
  failureReason: text("failure_reason").notNull().default("mailbox_not_found"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (t) => ({
  messageIdIdx: index("temp_email_archive_message_id_idx").on(t.messageId),
  toEmailIdx: index("temp_email_archive_to_email_idx").on(t.toEmail),
  receivedAtIdx: index("temp_email_archive_received_at_idx").on(t.receivedAt),
}))

export const tempEmailArchiveAttachment = sqliteTable("temp_email_archive_attachment", {
  id: text("id").primaryKey(),
  archiveId: text("archive_id")
    .notNull()
    .references(() => tempEmailArchive.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(),
  r2Path: text("r2_path").notNull(),
  size: integer("size").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (t) => ({
  archiveIdIdx: index("temp_email_archive_attachment_archive_id_idx").on(t.archiveId),
}))

export const apiKey = sqliteTable("api_key", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  keyPrefix: text("key_prefix").notNull(),
  keyHash: text("key_hash").notNull().unique(),
  lastUsedAt: integer("last_used_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (t) => ({
  userIdIdx: index("api_key_user_id_idx").on(t.userId),
  keyPrefixIdx: index("api_key_key_prefix_idx").on(t.keyPrefix),
}))
