// Export your models here. Add one export per file
// export * from "./posts";
//
// Each model/table should ideally be split into different files.
// Each model/table should define a Drizzle table, insert schema, and types:
//
//   import { pgTable, text, serial } from "drizzle-orm/pg-core";
//   import { createInsertSchema } from "drizzle-zod";
//   import { z } from "zod/v4";
//
//   export const postsTable = pgTable("posts", {
//     id: serial("id").primaryKey(),
//     title: text("title").notNull(),
//   });
//
//   export const insertPostSchema = createInsertSchema(postsTable).omit({ id: true });
//   export type InsertPost = z.infer<typeof insertPostSchema>;
//   export type Post = typeof postsTable.$inferSelect;

import { integer, jsonb, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export type QuoteItem = {
  selectionType: "product" | "combo";
  selectionId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export const quoteRequestsTable = pgTable("quote_requests", {
  id: uuid("id").primaryKey(),
  companyName: text("company_name").notNull(),
  contactName: text("contact_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  apartmentCount: integer("apartment_count"),
  items: jsonb("items").$type<QuoteItem[]>().notNull(),
  totalUnits: integer("total_units").notNull(),
  estimatedTotal: numeric("estimated_total", { precision: 12, scale: 2 }).notNull(),
  notes: text("notes"),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
});