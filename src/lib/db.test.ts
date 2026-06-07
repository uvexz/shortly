import { describe, expect, it } from "bun:test"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

const currentDir = fileURLToPath(new URL(".", import.meta.url))
const dbPath = resolve(currentDir, "db.ts")
const schemaPath = resolve(currentDir, "schema.ts")

async function readSource(path: string) {
  return Bun.file(path).text()
}

describe("db bootstrap regression checks", () => {
  it("keeps runtime bootstrap SQL aligned with core schema tables, columns, and indexes", async () => {
    const [dbSource, schemaSource] = await Promise.all([readSource(dbPath), readSource(schemaPath)])

    const requiredTables = [
      {
        name: "user",
        columns: ["role TEXT NOT NULL DEFAULT 'user'", "email_verified INTEGER NOT NULL DEFAULT 0"],
      },
      {
        name: "session",
        columns: ["token TEXT NOT NULL UNIQUE", "user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE"],
      },
      {
        name: "short_link",
        columns: ["domain TEXT NOT NULL DEFAULT ''", "clicks INTEGER NOT NULL DEFAULT 0", "creator_ip TEXT"],
      },
      {
        name: "link_log",
        columns: ["event_type TEXT NOT NULL", "status_code INTEGER"],
      },
      {
        name: "site_setting",
        columns: [
          "site_name TEXT NOT NULL DEFAULT 'Shortly'",
          "telegram_bot_username TEXT NOT NULL DEFAULT ''",
          "user_max_links_per_hour INTEGER NOT NULL DEFAULT 50",
        ],
      },
      {
        name: "site_domain",
        columns: ["host TEXT NOT NULL UNIQUE", "is_default_short_domain INTEGER NOT NULL DEFAULT 0", "is_default_email_domain INTEGER NOT NULL DEFAULT 0"],
      },
      {
        name: "temp_mailbox",
        columns: ["email_address TEXT NOT NULL UNIQUE", "is_active INTEGER NOT NULL DEFAULT 1"],
      },
      {
        name: "temp_email_message",
        columns: ["is_read INTEGER NOT NULL DEFAULT 0", "cc_json TEXT NOT NULL DEFAULT '[]'", "headers_json TEXT NOT NULL DEFAULT '[]'"],
      },
      {
        name: "temp_email_archive",
        columns: ["failure_reason TEXT NOT NULL DEFAULT 'mailbox_not_found'", "headers_json TEXT NOT NULL DEFAULT '[]'"],
      },
      {
        name: "api_key",
        columns: ["key_hash TEXT NOT NULL UNIQUE", "last_used_at INTEGER"],
      },
    ]

    for (const table of requiredTables) {
      expect(schemaSource).toContain(`sqliteTable(\"${table.name}\"`)
      expect(dbSource).toContain(`CREATE TABLE IF NOT EXISTS ${table.name} (`)
      for (const column of table.columns) {
        expect(dbSource).toContain(column)
      }
    }

    const requiredIndexes = [
      "short_link_domain_slug_idx",
      "short_link_user_id_idx",
      "short_link_created_at_idx",
      "short_link_creator_ip_idx",
      "short_link_domain_idx",
      "click_log_link_id_idx",
      "click_log_created_at_idx",
      "link_log_link_id_idx",
      "link_log_owner_user_id_idx",
      "link_log_event_type_idx",
      "link_log_created_at_idx",
      "site_domain_short_idx",
      "site_domain_email_idx",
      "telegram_binding_user_id_idx",
      "temp_mailbox_user_id_idx",
      "temp_mailbox_domain_idx",
      "temp_email_message_mailbox_id_idx",
      "temp_email_message_message_id_idx",
      "temp_email_message_received_at_idx",
      "temp_email_attachment_message_id_idx",
      "temp_email_archive_message_id_idx",
      "temp_email_archive_to_email_idx",
      "temp_email_archive_received_at_idx",
      "temp_email_archive_attachment_archive_id_idx",
      "api_key_user_id_idx",
      "api_key_key_prefix_idx",
    ]

    for (const indexName of requiredIndexes) {
      expect(schemaSource).toContain(indexName)
      expect(dbSource).toContain(indexName)
    }
  })

  it("covers every schema table in runtime bootstrap SQL", async () => {
    const [dbSource, schemaSource] = await Promise.all([readSource(dbPath), readSource(schemaPath)])

    const schemaTableNames = Array.from(schemaSource.matchAll(/sqliteTable\("([^"]+)"/g)).map((match) => match[1]!)

    for (const tableName of schemaTableNames) {
      expect(dbSource).toContain(`CREATE TABLE IF NOT EXISTS ${tableName} (`)
    }
  })

  it("covers every schema index name in runtime bootstrap SQL", async () => {
    const [dbSource, schemaSource] = await Promise.all([readSource(dbPath), readSource(schemaPath)])

    const schemaIndexNames = Array.from(schemaSource.matchAll(/(?:uniqueIndex|index)\("([^"]+)"/g)).map((match) => match[1]!)

    for (const indexName of schemaIndexNames) {
      expect(dbSource).toContain(indexName)
    }
  })

  it("limits runtime schema repair to named legacy compatibility helpers", async () => {
    const dbSource = await readSource(dbPath)

    expect(dbSource).toContain("await Promise.all([\n    ensureLegacyShortLinkColumns(),\n    ensureLegacyUserColumns(),\n    ensureLegacySiteSettingColumns(),\n    ensureLegacySiteDomainColumns(),\n  ])")
    expect(dbSource).toContain("await ensureLegacyShortLinkDomainSlugMigration()")
    expect(dbSource).not.toContain('ensureColumn("session"')
    expect(dbSource).not.toContain('ensureColumn("account"')
    expect(dbSource).not.toContain('ensureColumn("temp_email_message"')
  })

  it("keeps the legacy short_link uniqueness migration guard active", async () => {
    const dbSource = await readSource(dbPath)

    expect(dbSource).toContain("PRAGMA index_list(short_link);")
    expect(dbSource).toContain("PRAGMA index_info(${indexName});")
    expect(dbSource).toContain('if (columns.length === 1 && columns[0] === "slug")')
    expect(dbSource).toContain("await rebuildLegacyShortLinkTable()")
  })

  it("scopes runtime column backfills to named legacy compatibility helpers", async () => {
    const dbSource = await readSource(dbPath)

    expect(dbSource).toContain("async function ensureLegacyShortLinkColumns()")
    expect(dbSource).toContain("async function ensureLegacyUserColumns()")
    expect(dbSource).toContain("async function ensureLegacySiteSettingColumns()")
    expect(dbSource).toContain("async function ensureLegacySiteDomainColumns()")
    expect(dbSource).toContain('ensureColumn("short_link", "expires_at", "expires_at INTEGER")')
    expect(dbSource).toContain('ensureColumn("user", "banned", "banned INTEGER NOT NULL DEFAULT 0")')
    expect(dbSource).toContain('ensureColumn("user", "ban_reason", "ban_reason TEXT")')
    expect(dbSource).toContain('ensureColumn("user", "ban_expires", "ban_expires INTEGER")')
    expect(dbSource).toContain('ensureColumn("site_setting", "telegram_bot_username", "telegram_bot_username TEXT NOT NULL DEFAULT \'\'")')
    expect(dbSource).toContain('ensureColumn("site_setting", "user_max_links_per_hour", "user_max_links_per_hour INTEGER NOT NULL DEFAULT 50")')
    expect(dbSource).toContain('ensureColumn("site_domain", "short_link_min_slug_length", "short_link_min_slug_length INTEGER NOT NULL DEFAULT 1")')
    expect(dbSource).toContain('ensureColumn("site_domain", "temp_email_min_local_part_length", "temp_email_min_local_part_length INTEGER NOT NULL DEFAULT 1")')
    expect(dbSource).not.toContain('ensureColumn("api_key"')
  })

  it("keeps short_link table rebuild SQL aligned with the current bootstrap shape", async () => {
    const dbSource = await readSource(dbPath)

    expect(dbSource).toContain("async function rebuildLegacyShortLinkTable()")

    const requiredRebuildSnippets = [
      "CREATE TABLE IF NOT EXISTS short_link__new (",
      "domain TEXT NOT NULL DEFAULT ''",
      "creator_ip TEXT",
      "INSERT INTO short_link__new",
      "ALTER TABLE short_link__new RENAME TO short_link;",
      "CREATE UNIQUE INDEX IF NOT EXISTS short_link_domain_slug_idx ON short_link(domain, slug);",
    ]

    for (const snippet of requiredRebuildSnippets) {
      expect(dbSource).toContain(snippet)
    }
  })

  it("keeps runtime backfills limited to explicit legacy helpers", async () => {
    const dbSource = await readSource(dbPath)

    expect(dbSource).toContain("async function ensureLegacySiteDomainColumns()")
    expect(dbSource).toContain("async function ensureLegacyUserColumns()")
    expect(dbSource).not.toContain('ensureColumn("api_key"')
  })

  it("does not bootstrap the removed legacy slug-only unique index", async () => {
    const dbSource = await readSource(dbPath)
    expect(dbSource).not.toContain("CREATE UNIQUE INDEX IF NOT EXISTS short_link_slug_idx")
  })

  it("ensures telegram binding keeps both unique indexes in schema and bootstrap SQL", async () => {
    const [dbSource, schemaSource] = await Promise.all([readSource(dbPath), readSource(schemaPath)])

    expect(schemaSource).toContain("telegram_binding_user_id_idx")
    expect(schemaSource).toContain("telegram_binding_chat_id_idx")
    expect(dbSource).toContain("telegram_binding_user_id_idx")
    expect(dbSource).toContain("telegram_binding_chat_id_idx")
  })

  it("ensures mailbox and archive tables keep their received-at and relation indexes", async () => {
    const [dbSource, schemaSource] = await Promise.all([readSource(dbPath), readSource(schemaPath)])

    const requiredIndexNames = [
      "temp_email_message_received_at_idx",
      "temp_email_archive_received_at_idx",
      "temp_email_attachment_message_id_idx",
      "temp_email_archive_attachment_archive_id_idx",
    ]

    for (const indexName of requiredIndexNames) {
      expect(schemaSource).toContain(indexName)
      expect(dbSource).toContain(indexName)
    }
  })

  it("keeps auth tables in bootstrap SQL with the fields Better Auth relies on", async () => {
    const dbSource = await readSource(dbPath)

    const authTableSnippets = [
      "CREATE TABLE IF NOT EXISTS user (",
      "email TEXT NOT NULL UNIQUE",
      "CREATE TABLE IF NOT EXISTS session (",
      "token TEXT NOT NULL UNIQUE",
      "CREATE TABLE IF NOT EXISTS account (",
      "provider_id TEXT NOT NULL",
      "CREATE TABLE IF NOT EXISTS passkey (",
      "credential_id TEXT NOT NULL",
      "CREATE TABLE IF NOT EXISTS verification (",
      "identifier TEXT NOT NULL",
    ]

    for (const snippet of authTableSnippets) {
      expect(dbSource).toContain(snippet)
    }
  })

  it("keeps link and domain bootstrap SQL aligned with default values used elsewhere", async () => {
    const dbSource = await readSource(dbPath)

    const expectedDefaults = [
      "site_name TEXT NOT NULL DEFAULT 'Shortly'",
      "telegram_bot_username TEXT NOT NULL DEFAULT ''",
      "supports_short_links INTEGER NOT NULL DEFAULT 0",
      "supports_temp_email INTEGER NOT NULL DEFAULT 0",
      "is_active INTEGER NOT NULL DEFAULT 1",
    ]

    for (const snippet of expectedDefaults) {
      expect(dbSource).toContain(snippet)
    }
  })

  it("keeps archive and message JSON fields bootstrapped with array defaults", async () => {
    const dbSource = await readSource(dbPath)

    const jsonDefaults = [
      "cc_json TEXT NOT NULL DEFAULT '[]'",
      "reply_to_json TEXT NOT NULL DEFAULT '[]'",
      "headers_json TEXT NOT NULL DEFAULT '[]'",
    ]

    for (const snippet of jsonDefaults) {
      expect(dbSource).toContain(snippet)
    }
  })

  it("keeps api_key bootstrap SQL aligned with prefix lookup support", async () => {
    const dbSource = await readSource(dbPath)

    expect(dbSource).toContain("key_prefix TEXT NOT NULL")
    expect(dbSource).toContain("CREATE INDEX IF NOT EXISTS api_key_key_prefix_idx ON api_key(key_prefix);")
  })

  it("keeps temp mailbox bootstrap SQL aligned with uniqueness expectations", async () => {
    const dbSource = await readSource(dbPath)

    expect(dbSource).toContain("email_address TEXT NOT NULL UNIQUE")
    expect(dbSource).toContain("CREATE INDEX IF NOT EXISTS temp_mailbox_domain_idx ON temp_mailbox(domain);")
  })

  it("keeps site domain bootstrap SQL aligned with unique host constraints", async () => {
    const dbSource = await readSource(dbPath)

    expect(dbSource).toContain("host TEXT NOT NULL UNIQUE")
    expect(dbSource).toContain("CREATE INDEX IF NOT EXISTS site_domain_short_idx ON site_domain(supports_short_links, is_active);")
    expect(dbSource).toContain("CREATE INDEX IF NOT EXISTS site_domain_email_idx ON site_domain(supports_temp_email, is_active);")
  })

  it("keeps runtime bootstrap SQL aligned for api key and telegram tables", async () => {
    const dbSource = await readSource(dbPath)

    expect(dbSource).toContain("CREATE TABLE IF NOT EXISTS telegram_binding (")
    expect(dbSource).toContain("chat_id TEXT NOT NULL UNIQUE")
    expect(dbSource).toContain("CREATE TABLE IF NOT EXISTS api_key (")
    expect(dbSource).toContain("key_hash TEXT NOT NULL UNIQUE")
  })

  it("keeps link log bootstrap SQL aligned with admin analytics expectations", async () => {
    const dbSource = await readSource(dbPath)

    expect(dbSource).toContain("CREATE TABLE IF NOT EXISTS link_log (")
    expect(dbSource).toContain("owner_user_id TEXT")
    expect(dbSource).toContain("event_type TEXT NOT NULL")
    expect(dbSource).toContain("status_code INTEGER")
  })

  it("keeps short_link bootstrap SQL aligned with rate-limit and redirect behavior", async () => {
    const dbSource = await readSource(dbPath)

    const shortLinkSnippets = [
      "clicks INTEGER NOT NULL DEFAULT 0",
      "expires_at INTEGER",
      "max_clicks INTEGER",
      "creator_ip TEXT",
      "created_at INTEGER NOT NULL DEFAULT (unixepoch())",
    ]

    for (const snippet of shortLinkSnippets) {
      expect(dbSource).toContain(snippet)
    }
  })

  it("keeps archive attachment bootstrap SQL aligned with cascade deletes", async () => {
    const dbSource = await readSource(dbPath)

    expect(dbSource).toContain("archive_id TEXT NOT NULL REFERENCES temp_email_archive(id) ON DELETE CASCADE")
    expect(dbSource).toContain("message_id TEXT NOT NULL REFERENCES temp_email_message(id) ON DELETE CASCADE")
  })

  it("keeps session bootstrap SQL aligned with audit fields", async () => {
    const dbSource = await readSource(dbPath)

    expect(dbSource).toContain("ip_address TEXT")
    expect(dbSource).toContain("user_agent TEXT")
    expect(dbSource).toContain("updated_at INTEGER NOT NULL DEFAULT (unixepoch())")
  })

  it("keeps verification bootstrap SQL aligned with expiry tracking", async () => {
    const dbSource = await readSource(dbPath)

    expect(dbSource).toContain("expires_at INTEGER NOT NULL")
    expect(dbSource).toContain("value TEXT NOT NULL")
  })

  it("keeps passkey bootstrap SQL aligned with device metadata", async () => {
    const dbSource = await readSource(dbPath)

    expect(dbSource).toContain("device_type TEXT NOT NULL")
    expect(dbSource).toContain("backed_up INTEGER NOT NULL")
    expect(dbSource).toContain("transports TEXT")
  })

  it("keeps site_setting bootstrap SQL aligned with default row creation", async () => {
    const dbSource = await readSource(dbPath)

    expect(dbSource).toContain("CREATE TABLE IF NOT EXISTS site_setting (")
    expect(dbSource).toContain("id TEXT PRIMARY KEY DEFAULT 'default'")
    expect(dbSource).toContain("INSERT OR IGNORE INTO site_setting (id) VALUES ('default');")
  })

  it("keeps email archive bootstrap SQL aligned with failure capture", async () => {
    const dbSource = await readSource(dbPath)

    expect(dbSource).toContain("failure_reason TEXT NOT NULL DEFAULT 'mailbox_not_found'")
    expect(dbSource).toContain("message_id TEXT")
  })

  it("keeps runtime bootstrap SQL aligned with table creation order for foreign keys", async () => {
    const dbSource = await readSource(dbPath)

    expect(dbSource.indexOf("CREATE TABLE IF NOT EXISTS user (")).toBeLessThan(dbSource.indexOf("CREATE TABLE IF NOT EXISTS session ("))
    expect(dbSource.indexOf("CREATE TABLE IF NOT EXISTS short_link (")).toBeLessThan(dbSource.indexOf("CREATE TABLE IF NOT EXISTS click_log ("))
    expect(dbSource.indexOf("CREATE TABLE IF NOT EXISTS temp_mailbox (")).toBeLessThan(dbSource.indexOf("CREATE TABLE IF NOT EXISTS temp_email_message ("))
  })

  it("keeps bootstrap SQL aligned with the unique short_link domain+slug contract", async () => {
    const dbSource = await readSource(dbPath)

    expect(dbSource).toContain("CREATE UNIQUE INDEX IF NOT EXISTS short_link_domain_slug_idx ON short_link(domain, slug);")
    expect(dbSource).not.toContain("UNIQUE(slug)")
  })

  it("keeps bootstrap SQL aligned with optional link ownership", async () => {
    const dbSource = await readSource(dbPath)

    expect(dbSource).toContain("user_id TEXT REFERENCES user(id) ON DELETE SET NULL")
    expect(dbSource).toContain("owner_user_id TEXT")
  })

  it("keeps bootstrap SQL aligned with timestamp defaults across key tables", async () => {
    const dbSource = await readSource(dbPath)

    const timestampDefaults = [
      "created_at INTEGER NOT NULL DEFAULT (unixepoch())",
      "updated_at INTEGER NOT NULL DEFAULT (unixepoch())",
      "received_at INTEGER NOT NULL DEFAULT (unixepoch())",
    ]

    for (const snippet of timestampDefaults) {
      expect(dbSource).toContain(snippet)
    }
  })

  it("keeps api key bootstrap SQL aligned with user cascade deletes", async () => {
    const dbSource = await readSource(dbPath)

    expect(dbSource).toContain("user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE")
    expect(dbSource).toContain("last_used_at INTEGER")
  })

  it("keeps telegram bootstrap SQL aligned with chat uniqueness", async () => {
    const dbSource = await readSource(dbPath)

    expect(dbSource).toContain("chat_id TEXT NOT NULL UNIQUE")
    expect(dbSource).toContain("username TEXT")
  })

  it("keeps temp email message bootstrap SQL aligned with sender metadata", async () => {
    const dbSource = await readSource(dbPath)

    expect(dbSource).toContain('"from" TEXT NOT NULL')
    expect(dbSource).toContain("from_name TEXT")
    expect(dbSource).toContain("subject TEXT NOT NULL DEFAULT ''")
  })

  it("keeps temp email archive bootstrap SQL aligned with sender metadata", async () => {
    const dbSource = await readSource(dbPath)

    expect(dbSource).toContain('"from" TEXT NOT NULL')
    expect(dbSource).toContain("from_name TEXT")
    expect(dbSource).toContain("subject TEXT NOT NULL DEFAULT ''")
  })

  it("keeps temp email attachment bootstrap SQL aligned with storage metadata", async () => {
    const dbSource = await readSource(dbPath)

    expect(dbSource).toContain("filename TEXT NOT NULL")
    expect(dbSource).toContain("mime_type TEXT NOT NULL")
    expect(dbSource).toContain("r2_path TEXT NOT NULL")
  })

  it("keeps link log bootstrap SQL indexed for owner and event queries", async () => {
    const dbSource = await readSource(dbPath)

    expect(dbSource).toContain("CREATE INDEX IF NOT EXISTS link_log_owner_user_id_idx ON link_log(owner_user_id);")
    expect(dbSource).toContain("CREATE INDEX IF NOT EXISTS link_log_event_type_idx ON link_log(event_type);")
  })

  it("keeps short_link bootstrap SQL indexed for creator IP queries", async () => {
    const dbSource = await readSource(dbPath)

    expect(dbSource).toContain("CREATE INDEX IF NOT EXISTS short_link_creator_ip_idx ON short_link(creator_ip);")
    expect(dbSource).toContain("CREATE INDEX IF NOT EXISTS short_link_created_at_idx ON short_link(created_at);")
  })

  it("keeps click_log bootstrap SQL indexed for link history queries", async () => {
    const dbSource = await readSource(dbPath)

    expect(dbSource).toContain("CREATE INDEX IF NOT EXISTS click_log_link_id_idx ON click_log(link_id);")
    expect(dbSource).toContain("CREATE INDEX IF NOT EXISTS click_log_created_at_idx ON click_log(created_at);")
  })

  it("keeps bootstrap SQL aligned with mailbox ownership constraints", async () => {
    const dbSource = await readSource(dbPath)

    expect(dbSource).toContain("user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE")
    expect(dbSource).toContain("email_address TEXT NOT NULL UNIQUE")
  })

  it("keeps archive bootstrap SQL aligned with optional provider message ids", async () => {
    const dbSource = await readSource(dbPath)

    expect(dbSource).toContain("message_id TEXT,")
    expect(dbSource).toContain("to_email TEXT NOT NULL")
  })

  it("keeps verification bootstrap SQL optional timestamps aligned", async () => {
    const dbSource = await readSource(dbPath)

    expect(dbSource).toContain("created_at INTEGER DEFAULT (unixepoch())")
    expect(dbSource).toContain("updated_at INTEGER DEFAULT (unixepoch())")
  })

  it("keeps account bootstrap SQL aligned with token metadata fields", async () => {
    const dbSource = await readSource(dbPath)

    expect(dbSource).toContain("access_token TEXT")
    expect(dbSource).toContain("refresh_token TEXT")
    expect(dbSource).toContain("scope TEXT")
    expect(dbSource).toContain("password TEXT")
  })

  it("keeps temp email tables bootstrapped before their attachments indexes", async () => {
    const dbSource = await readSource(dbPath)

    expect(dbSource.indexOf("CREATE TABLE IF NOT EXISTS temp_email_message (")).toBeLessThan(dbSource.indexOf("CREATE INDEX IF NOT EXISTS temp_email_message_mailbox_id_idx ON temp_email_message(mailbox_id);"))
    expect(dbSource.indexOf("CREATE TABLE IF NOT EXISTS temp_email_archive (")).toBeLessThan(dbSource.indexOf("CREATE INDEX IF NOT EXISTS temp_email_archive_message_id_idx ON temp_email_archive(message_id);"))
  })

  it("keeps api key bootstrap SQL after auth tables and before indexes", async () => {
    const dbSource = await readSource(dbPath)

    expect(dbSource.indexOf("CREATE TABLE IF NOT EXISTS api_key (")).toBeGreaterThan(dbSource.indexOf("CREATE TABLE IF NOT EXISTS user ("))
    expect(dbSource.indexOf("CREATE INDEX IF NOT EXISTS api_key_user_id_idx ON api_key(user_id);")).toBeGreaterThan(dbSource.indexOf("CREATE TABLE IF NOT EXISTS api_key ("))
  })

  it("keeps site domain bootstrap SQL before its indexes", async () => {
    const dbSource = await readSource(dbPath)

    expect(dbSource.indexOf("CREATE TABLE IF NOT EXISTS site_domain (")).toBeLessThan(dbSource.indexOf("CREATE INDEX IF NOT EXISTS site_domain_short_idx ON site_domain(supports_short_links, is_active);"))
    expect(dbSource.indexOf("CREATE TABLE IF NOT EXISTS site_domain (")).toBeLessThan(dbSource.indexOf("CREATE INDEX IF NOT EXISTS site_domain_email_idx ON site_domain(supports_temp_email, is_active);"))
  })

  it("keeps short_link rebuild SQL aligned with copied columns order", async () => {
    const dbSource = await readSource(dbPath)

    expect(dbSource).toContain("INSERT INTO short_link__new (")
    expect(dbSource).toContain("SELECT\n      id,\n      user_id,\n      original_url,\n      slug,\n      domain,")
  })

  it("keeps initDb safeguards for backfilled columns and default site settings", async () => {
    const dbSource = await readSource(dbPath)

    const requiredBackfills = [
      'ensureColumn("short_link", "expires_at", "expires_at INTEGER")',
      'ensureColumn("short_link", "max_clicks", "max_clicks INTEGER")',
      'ensureColumn("short_link", "creator_ip", "creator_ip TEXT")',
      'ensureColumn("short_link", "domain", "domain TEXT NOT NULL DEFAULT \'\'")',
      'ensureColumn("site_setting", "telegram_bot_username", "telegram_bot_username TEXT NOT NULL DEFAULT \'\'")',
      'ensureColumn("site_setting", "user_max_links_per_hour", "user_max_links_per_hour INTEGER NOT NULL DEFAULT 50")',
      'INSERT OR IGNORE INTO site_setting (id) VALUES (\'default\')',
      'await ensureLegacyShortLinkDomainSlugMigration()',
    ]

    for (const snippet of requiredBackfills) {
      expect(dbSource).toContain(snippet)
    }
  })
})
