import { Router } from "express";
import { db } from "@workspace/db";
import { allowedPathsTable, activityLogTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import fs from "fs/promises";
import path from "path";
import os from "os";
import {
  ScanFilesBody,
  PreviewFileOpBody,
  ExecuteFileOpBody,
  AddAllowedPathBody,
} from "@workspace/api-zod";

const router = Router();

const TEMP_UNDO_DIR = path.join(os.tmpdir(), "axiom-undo");

async function ensureUndoDir() {
  await fs.mkdir(TEMP_UNDO_DIR, { recursive: true });
}

async function isPathAllowed(targetPath: string): Promise<boolean> {
  const allowed = await db.select().from(allowedPathsTable);
  return allowed.some(a => targetPath.startsWith(a.path));
}

async function scanDirectory(dirPath: string, recursive: boolean, maxDepth: number, currentDepth = 0): Promise<Array<{ name: string; path: string; size: number; modifiedAt: Date; type: "file" | "directory"; extension: string | null }>> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    try {
      const stat = await fs.stat(fullPath);
      results.push({
        name: entry.name,
        path: fullPath,
        size: stat.size,
        modifiedAt: stat.mtime,
        type: entry.isDirectory() ? "directory" as const : "file" as const,
        extension: entry.isFile() ? path.extname(entry.name).toLowerCase() || null : null,
      });
      if (recursive && entry.isDirectory() && currentDepth < maxDepth) {
        const children = await scanDirectory(fullPath, recursive, maxDepth, currentDepth + 1);
        results.push(...children);
      }
    } catch {}
  }
  return results;
}

// GET /files/allowed-paths
router.get("/files/allowed-paths", async (_req, res) => {
  const paths = await db.select().from(allowedPathsTable);
  res.json(paths);
});

// POST /files/allowed-paths
router.post("/files/allowed-paths", async (req, res) => {
  const body = AddAllowedPathBody.parse(req.body);
  try {
    await fs.access(body.path);
  } catch {
    return res.status(400).json({ error: "Path does not exist or is not accessible" });
  }
  const [created] = await db.insert(allowedPathsTable).values({
    path: body.path,
    label: body.label,
  }).returning().catch(() => [null]);
  if (!created) return res.status(409).json({ error: "Path already added" });
  res.status(201).json(created);
});

// DELETE /files/allowed-paths/:id
router.delete("/files/allowed-paths/:id", async (req, res) => {
  await db.delete(allowedPathsTable).where(eq(allowedPathsTable.id, parseInt(req.params.id)));
  res.status(204).send();
});

// POST /files/scan
router.post("/files/scan", async (req, res) => {
  const body = ScanFilesBody.parse(req.body);
  if (!await isPathAllowed(body.path)) {
    return res.status(403).json({ error: "Path not in allowed list. Add it in Settings > Allowed Paths first." });
  }
  try {
    const files = await scanDirectory(body.path, body.recursive ?? false, body.maxDepth ?? 2);
    const totalSize = files.filter(f => f.type === "file").reduce((sum, f) => sum + f.size, 0);
    res.json({ path: body.path, files, totalCount: files.length, totalSize });
  } catch (err) {
    res.status(400).json({ error: "Could not scan directory" });
  }
});

// POST /files/preview
router.post("/files/preview", async (req, res) => {
  const body = PreviewFileOpBody.parse(req.body);
  if (!await isPathAllowed(body.path)) {
    return res.status(403).json({ error: "Path not allowed" });
  }

  const files = await scanDirectory(body.path, true, 3);
  let affected = files.filter(f => f.type === "file");
  let summary = "";
  let reversible = true;

  if (body.operation === "delete") {
    if (body.criteria) {
      const daysOld = parseInt(body.criteria.match(/(\d+)\s*days?/i)?.[1] || "0");
      const ext = body.criteria.match(/\.(\w+)/)?.[0];
      const sizeKB = parseInt(body.criteria.match(/(\d+)\s*[kK][bB]/)?.[1] || "0");
      if (daysOld > 0) {
        const cutoff = new Date(Date.now() - daysOld * 86400000);
        affected = affected.filter(f => f.modifiedAt < cutoff);
      }
      if (ext) affected = affected.filter(f => f.extension === ext);
      if (sizeKB > 0) affected = affected.filter(f => f.size > sizeKB * 1024);
    }
    summary = `Delete ${affected.length} files (${(affected.reduce((s, f) => s + f.size, 0) / 1e6).toFixed(1)} MB)`;
  } else if (body.operation === "organize") {
    summary = `Organize ${affected.length} files by type into subfolders`;
  } else if (body.operation === "dedup") {
    const sizeMap = new Map<number, typeof affected>();
    affected.forEach(f => {
      const arr = sizeMap.get(f.size) || [];
      arr.push(f);
      sizeMap.set(f.size, arr);
    });
    affected = [...sizeMap.values()].filter(g => g.length > 1).flat().slice(1);
    summary = `Remove ${affected.length} potential duplicate files`;
  } else if (body.operation === "move" && body.destination) {
    summary = `Move ${affected.length} files to ${body.destination}`;
  } else {
    summary = `Process ${affected.length} files`;
  }

  res.json({
    operation: body.operation,
    affectedFiles: affected.slice(0, 100),
    summary,
    totalSize: affected.reduce((s, f) => s + f.size, 0),
    reversible,
  });
});

// POST /files/execute
router.post("/files/execute", async (req, res) => {
  const body = ExecuteFileOpBody.parse(req.body);
  if (!await isPathAllowed(body.path)) {
    return res.status(403).json({ error: "Path not allowed" });
  }
  if (!body.confirmed) {
    return res.status(400).json({ error: "Operation not confirmed" });
  }

  await ensureUndoDir();
  const files = await scanDirectory(body.path, true, 3);
  let affected = files.filter(f => f.type === "file");
  const details: string[] = [];
  const undoFiles: Array<{ tempPath: string; originalPath: string }> = [];
  let processed = 0;

  if (body.operation === "delete") {
    if (body.criteria) {
      const daysOld = parseInt(body.criteria.match(/(\d+)\s*days?/i)?.[1] || "0");
      const ext = body.criteria.match(/\.(\w+)/)?.[0];
      if (daysOld > 0) {
        const cutoff = new Date(Date.now() - daysOld * 86400000);
        affected = affected.filter(f => f.modifiedAt < cutoff);
      }
      if (ext) affected = affected.filter(f => f.extension === ext);
    }
    for (const f of affected) {
      try {
        const tempPath = path.join(TEMP_UNDO_DIR, `${Date.now()}_${f.name}`);
        await fs.rename(f.path, tempPath);
        undoFiles.push({ tempPath, originalPath: f.path });
        details.push(`Deleted: ${f.name}`);
        processed++;
      } catch {}
    }
  } else if (body.operation === "organize") {
    const typeMap: Record<string, string> = {
      ".jpg": "Images", ".jpeg": "Images", ".png": "Images", ".gif": "Images", ".webp": "Images", ".svg": "Images",
      ".mp4": "Videos", ".mov": "Videos", ".avi": "Videos", ".mkv": "Videos",
      ".mp3": "Audio", ".wav": "Audio", ".flac": "Audio", ".aac": "Audio",
      ".pdf": "Documents", ".doc": "Documents", ".docx": "Documents", ".txt": "Documents", ".md": "Documents",
      ".zip": "Archives", ".tar": "Archives", ".gz": "Archives", ".rar": "Archives",
      ".js": "Code", ".ts": "Code", ".py": "Code", ".go": "Code", ".rs": "Code",
    };
    for (const f of affected) {
      const folder = f.extension ? (typeMap[f.extension] || "Other") : "Other";
      const destDir = path.join(body.path, folder);
      await fs.mkdir(destDir, { recursive: true });
      const destPath = path.join(destDir, f.name);
      try {
        await fs.rename(f.path, destPath);
        details.push(`Moved ${f.name} → ${folder}/`);
        processed++;
      } catch {}
    }
  } else if (body.operation === "move" && body.destination) {
    await fs.mkdir(body.destination, { recursive: true });
    for (const f of affected) {
      try {
        await fs.rename(f.path, path.join(body.destination, f.name));
        details.push(`Moved: ${f.name}`);
        processed++;
      } catch {}
    }
  }

  const undoKey = undoFiles.length > 0 ? JSON.stringify({ files: undoFiles }) : null;

  await db.insert(activityLogTable).values({
    type: "file_op",
    description: `${body.operation} on ${body.path}`,
    detail: details.slice(0, 5).join(", "),
    filesAffected: JSON.stringify(affected.slice(0, processed).map(f => f.path)),
    undoable: undoFiles.length > 0,
    undoData: undoKey,
  });

  res.json({
    success: true,
    filesProcessed: processed,
    summary: `Processed ${processed} files`,
    details: details.slice(0, 20),
    undoKey,
  });
});

export default router;
