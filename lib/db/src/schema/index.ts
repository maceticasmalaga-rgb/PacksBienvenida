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
  units: number;
  unitPrice: number;
  subtotal: number;
  discount: number;
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
  individualUnits: integer("individual_units").notNull().default(0),
  totalUnits: integer("total_units").notNull(),
  subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull().default("0"),
  discountTotal: numeric("discount_total", { precision: 12, scale: 2 }).notNull().default("0"),
  estimatedTotal: numeric("estimated_total", { precision: 12, scale: 2 }).notNull(),
  notes: text("notes"),
  status: text("status").notNull().default("new"),
  adminNotes: text("admin_notes"),
  lastContactAt: timestamp("last_contact_at", { withTimezone: true }),
  nextFollowUpAt: timestamp("next_follow_up_at", { withTimezone: true }),
  finalSaleAmount: numeric("final_sale_amount", { precision: 12, scale: 2 }),
  businessEmailStatus: text("business_email_status").notNull().default("not_configured"),
  customerEmailStatus: text("customer_email_status").notNull().default("not_configured"),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});