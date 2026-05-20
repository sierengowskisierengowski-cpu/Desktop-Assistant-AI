import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const quickActionsTable = pgTable("quick_actions", {
  id: serial("id").primaryKey(),
  label: text("label").notNull(),
  command: text("command").notNull(),
  icon: text("icon"),
  color: text("color"),
  order: integer("order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertQuickActionSchema = createInsertSchema(quickActionsTable).omit({ id: true, createdAt: true });
export const updateQuickActionSchema = insertQuickActionSchema.partial();

export type QuickAction = typeof quickActionsTable.$inferSelect;
export type InsertQuickAction = z.infer<typeof insertQuickActionSchema>;
export type UpdateQuickAction = z.infer<typeof updateQuickActionSchema>;
