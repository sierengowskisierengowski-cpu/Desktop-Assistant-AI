import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const activityLogTable = pgTable("activity_log", {
  id: serial("id").primaryKey(),
  type: text("type").notNull().$type<"chat" | "file_op" | "scheduled">(),
  description: text("description").notNull(),
  detail: text("detail"),
  filesAffected: text("files_affected").notNull().default("[]"),
  undoable: boolean("undoable").notNull().default(false),
  undone: boolean("undone").notNull().default(false),
  undoData: text("undo_data"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertActivitySchema = createInsertSchema(activityLogTable).omit({ id: true, createdAt: true, undone: true });

export type ActivityEntry = typeof activityLogTable.$inferSelect;
export type InsertActivity = z.infer<typeof insertActivitySchema>;
