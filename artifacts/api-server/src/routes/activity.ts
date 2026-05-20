import { Router } from "express";
import { db } from "@workspace/db";
import { activityLogTable } from "@workspace/db";
import { eq, desc, count, sql } from "drizzle-orm";
import { ListActivityLogQueryParams } from "@workspace/api-zod";
import fs from "fs/promises";
import path from "path";

const router = Router();

// GET /activity
router.get("/activity", async (req, res) => {
  const query = ListActivityLogQueryParams.parse(req.query);
  const limit = query.limit ?? 50;
  let rows;
  if (!query.type || query.type === "all") {
    rows = await db.select().from(activityLogTable)
      .orderBy(desc(activityLogTable.createdAt))
      .limit(limit);
  } else {
    rows = await db.select().from(activityLogTable)
      .where(eq(activityLogTable.type, query.type as "chat" | "file_op" | "scheduled"))
      .orderBy(desc(activityLogTable.createdAt))
      .limit(limit);
  }
  const result = rows.map(r => ({
    ...r,
    filesAffected: JSON.parse(r.filesAffected || "[]"),
  }));
  res.json(result);
});

// POST /activity/:id/undo
router.post("/activity/:id/undo", async (req, res) => {
  const id = parseInt(req.params.id);
  const [entry] = await db.select().from(activityLogTable).where(eq(activityLogTable.id, id));
  if (!entry) return res.status(404).json({ error: "Not found" });
  if (!entry.undoable || entry.undone) {
    return res.json({ success: false, message: "This action cannot be undone", filesRestored: [] });
  }

  const filesRestored: string[] = [];
  if (entry.undoData) {
    try {
      const undoInfo = JSON.parse(entry.undoData) as { files: Array<{ tempPath: string; originalPath: string }> };
      for (const f of undoInfo.files || []) {
        try {
          await fs.mkdir(path.dirname(f.originalPath), { recursive: true });
          await fs.rename(f.tempPath, f.originalPath);
          filesRestored.push(f.originalPath);
        } catch {}
      }
    } catch {}
  }

  await db.update(activityLogTable).set({ undone: true }).where(eq(activityLogTable.id, id));
  res.json({ success: true, message: `Restored ${filesRestored.length} file(s)`, filesRestored });
});

// GET /activity/summary
router.get("/activity/summary", async (_req, res) => {
  const [totalRow] = await db.select({ value: count() }).from(activityLogTable);
  const [chatRow] = await db.select({ value: count() }).from(activityLogTable).where(eq(activityLogTable.type, "chat"));
  const [fileRow] = await db.select({ value: count() }).from(activityLogTable).where(eq(activityLogTable.type, "file_op"));
  const [schedRow] = await db.select({ value: count() }).from(activityLogTable).where(eq(activityLogTable.type, "scheduled"));

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [recentRow] = await db.select({ value: count() }).from(activityLogTable)
    .where(sql`created_at > ${since}`);

  res.json({
    total: Number(totalRow.value),
    byType: {
      chat: Number(chatRow.value),
      file_op: Number(fileRow.value),
      scheduled: Number(schedRow.value),
    },
    recentCount: Number(recentRow.value),
  });
});

export default router;
