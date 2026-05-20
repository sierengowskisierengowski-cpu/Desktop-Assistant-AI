import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const scheduledTasksTable = pgTable("scheduled_tasks", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  command: text("command").notNull(),
  schedule: text("schedule").notNull(),
  scheduleLabel: text("schedule_label"),
  enabled: boolean("enabled").notNull().default(true),
  lastRunAt: timestamp("last_run_at"),
  lastRunStatus: text("last_run_status"),
  nextRunAt: timestamp("next_run_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertScheduledTaskSchema = createInsertSchema(scheduledTasksTable).omit({ id: true, createdAt: true, lastRunAt: true, lastRunStatus: true, nextRunAt: true });
export const updateScheduledTaskSchema = insertScheduledTaskSchema.partial();

export type ScheduledTask = typeof scheduledTasksTable.$inferSelect;
export type InsertScheduledTask = z.infer<typeof insertScheduledTaskSchema>;
export type UpdateScheduledTask = z.infer<typeof updateScheduledTaskSchema>;
