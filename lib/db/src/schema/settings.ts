import { pgTable, serial, text, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const settingsTable = pgTable("settings", {
  id: serial("id").primaryKey(),
  hotkey: text("hotkey").notNull().default("CommandOrControl+Shift+Space"),
  aiMode: text("ai_mode").notNull().default("cloud").$type<"local" | "cloud">(),
  aiModel: text("ai_model").notNull().default("gpt-4o-mini"),
  cloudApiKey: text("cloud_api_key"),
  cloudBaseUrl: text("cloud_base_url"),
  ollamaBaseUrl: text("ollama_base_url").notNull().default("http://localhost:11434"),
  theme: text("theme").notNull().default("dark").$type<"light" | "dark" | "system">(),
  launchAtLogin: boolean("launch_at_login").notNull().default(false),
  startMinimized: boolean("start_minimized").notNull().default(false),
  dismissOnBlur: boolean("dismiss_on_blur").notNull().default(true),
  notifyOnSchedule: boolean("notify_on_schedule").notNull().default(true),
  notifyOnError: boolean("notify_on_error").notNull().default(true),
  windowWidth: integer("window_width").notNull().default(780),
  windowHeight: integer("window_height").notNull().default(640),
  onboardingCompleted: boolean("onboarding_completed").notNull().default(false),
});

export const insertSettingsSchema = createInsertSchema(settingsTable).omit({ id: true });
export const updateSettingsSchema = insertSettingsSchema.partial();

export type Settings = typeof settingsTable.$inferSelect;
export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type UpdateSettings = z.infer<typeof updateSettingsSchema>;
