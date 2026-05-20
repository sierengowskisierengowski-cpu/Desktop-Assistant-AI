import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const allowedPathsTable = pgTable("allowed_paths", {
  id: serial("id").primaryKey(),
  path: text("path").notNull().unique(),
  label: text("label"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAllowedPathSchema = createInsertSchema(allowedPathsTable).omit({ id: true, createdAt: true });

export type AllowedPath = typeof allowedPathsTable.$inferSelect;
export type InsertAllowedPath = z.infer<typeof insertAllowedPathSchema>;
