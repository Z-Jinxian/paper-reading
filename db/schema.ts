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
