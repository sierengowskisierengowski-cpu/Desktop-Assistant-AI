import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const knowledgeNotesTable = pgTable("knowledge_notes", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull().default(""),
  pinned: boolean("pinned").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertKnowledgeNoteSchema = createInsertSchema(knowledgeNotesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const updateKnowledgeNoteSchema = insertKnowledgeNoteSchema.partial();

export type KnowledgeNote = typeof knowledgeNotesTable.$inferSelect;
export type InsertKnowledgeNote = z.infer<typeof insertKnowledgeNoteSchema>;
export type UpdateKnowledgeNote = z.infer<typeof updateKnowledgeNoteSchema>;
