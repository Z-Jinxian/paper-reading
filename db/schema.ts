import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const paperChanges = sqliteTable("paper_changes", {
  id: text("id").primaryKey().notNull(),
  data: text("data").notNull(),
  revision: integer("revision").notNull(),
  updatedAt: text("updated_at").notNull(),
  deletedAt: text("deleted_at"),
});

export const modelProfiles = sqliteTable("model_profiles", {
  id: text("id").primaryKey().notNull(),
  name: text("name").notNull(),
  baseUrl: text("base_url").notNull(),
  model: text("model").notNull(),
  sealedKey: text("sealed_key"),
  updatedAt: text("updated_at").notNull(),
});

export const paperTopics = sqliteTable("paper_topics", {
  id: text("id").primaryKey().notNull(),
  name: text("name").notNull(),
  nameKey: text("name_key").notNull().unique(),
  createdAt: text("created_at").notNull(),
});

export const industryEvents = sqliteTable("industry_events", {
  id: text("id").primaryKey().notNull(),
  sourceKey: text("source_key").notNull().unique(),
  data: text("data").notNull(),
  revision: integer("revision").notNull(),
  firstSeen: text("first_seen").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const industryChecks = sqliteTable("industry_checks", {
  domain: text("domain").primaryKey().notNull(),
  checkedAt: text("checked_at").notNull(),
  data: text("data").notNull(),
});

export const frontierDigests = sqliteTable("frontier_digests", {
  day: text("day").primaryKey().notNull(),
  through: text("through").notNull(),
  messageId: text("message_id").notNull(),
});
