import fs from "fs/promises";
import path from "path";
import os from "os";
import { db } from "@workspace/db";
import { activityLogTable, allowedPathsTable } from "@workspace/db";

export const TEMP_UNDO_DIR = path.join(os.tmpdir(), "axiom-undo");

export async function ensureUndoDir() {
  await fs.mkdir(TEMP_UNDO_DIR, { recursive: true });
}

export async function canonicalize(p: string): Promise<string> {
  try {
    return await fs.realpath(p);
  } catch {
    return path.resolve(p);
  }
}

export async function isPathAllowed(targetPath: string): Promise<boolean> {
  const allowed = await db.select().from(allowedPathsTable);
  const canonical = await canonicalize(targetPath);
  return allowed.some(a => {
    const base = path.resolve(a.path);
    return canonical === base || canonical.startsWith(base + path.sep);
  });
}

export type ScanFile = {
  name: string;
  path: string;
  size: number;
  modifiedAt: Date;
  type: "file" | "directory";
  extension: string | null;
};

export async function scanDirectory(
  dirPath: string,
  recursive: boolean,
  maxDepth: number,
  currentDepth = 0
): Promise<ScanFile[]> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const results: ScanFile[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    try {
      const stat = await fs.stat(fullPath);
      results.push({
        name: entry.name,
        path: fullPath,
        size: stat.size,
        modifiedAt: stat.mtime,
        type: entry.isDirectory() ? "directory" : "file",
        extension: entry.isFile() ? path.extname(entry.name).toLowerCase() || null : null,
      });
      if (recursive && entry.isDirectory() && currentDepth < maxDepth) {
        results.push(...await scanDirectory(fullPath, recursive, maxDepth, currentDepth + 1));
      }
    } catch {}
  }
  return results;
}

export function applyCriteria(files: ScanFile[], criteria?: string | null): ScanFile[] {
  if (!criteria) return files;
  let result = [...files];
  const daysOld = parseInt(criteria.match(/(\d+)\s*days?/i)?.[1] || "0");
  const ext = criteria.match(/\.([\w]+)/)?.[0];
  const sizeKB = parseInt(criteria.match(/(\d+)\s*[kK][bB]/)?.[1] || "0");
  const sizeMB = parseInt(criteria.match(/(\d+)\s*[mM][bB]/)?.[1] || "0");
  if (daysOld > 0) {
    const cutoff = new Date(Date.now() - daysOld * 86400000);
    result = result.filter(f => f.modifiedAt < cutoff);
  }
  if (ext) result = result.filter(f => f.extension === ext);
  if (sizeKB > 0) result = result.filter(f => f.size > sizeKB * 1024);
  if (sizeMB > 0) result = result.filter(f => f.size > sizeMB * 1024 * 1024);
  return result;
}

export const TYPE_MAP: Record<string, string> = {
  ".jpg": "Images", ".jpeg": "Images", ".png": "Images", ".gif": "Images",
  ".webp": "Images", ".svg": "Images", ".bmp": "Images",
  ".mp4": "Videos", ".mov": "Videos", ".avi": "Videos", ".mkv": "Videos", ".webm": "Videos",
  ".mp3": "Audio", ".wav": "Audio", ".flac": "Audio", ".aac": "Audio", ".ogg": "Audio",
  ".pdf": "Documents", ".doc": "Documents", ".docx": "Documents", ".txt": "Documents",
  ".md": "Documents", ".xlsx": "Documents", ".pptx": "Documents",
  ".zip": "Archives", ".tar": "Archives", ".gz": "Archives", ".rar": "Archives", ".7z": "Archives",
  ".js": "Code", ".ts": "Code", ".py": "Code", ".go": "Code", ".rs": "Code",
  ".java": "Code", ".c": "Code", ".cpp": "Code", ".rb": "Code",
};

export interface ExecuteParams {
  operation: "delete" | "move" | "organize" | "rename" | "dedup";
  path: string;
  criteria?: string | null;
  destination?: string | null;
  skipActivityLog?: boolean;
}

export interface ExecuteResult {
  success: boolean;
  filesProcessed: number;
  summary: string;
  details: string[];
  undoKey: string | null;
}

export async function executeFileOperation(params: ExecuteParams): Promise<ExecuteResult> {
  await ensureUndoDir();
  const files = await scanDirectory(params.path, true, 3);
  let affected = files.filter(f => f.type === "file");
  const details: string[] = [];
  const undoFiles: Array<{ tempPath: string; originalPath: string }> = [];
  const undoMoves: Array<{ from: string; to: string }> = [];
  let processed = 0;

  if (params.operation === "delete") {
    affected = applyCriteria(affected, params.criteria);
    for (const f of affected) {
      try {
        const tempPath = path.join(TEMP_UNDO_DIR, `${Date.now()}_${f.name}`);
        await fs.rename(f.path, tempPath);
        undoFiles.push({ tempPath, originalPath: f.path });
        details.push(`Deleted: ${f.name}`);
        processed++;
      } catch {}
    }
  } else if (params.operation === "organize") {
    for (const f of affected) {
      const folder = f.extension ? (TYPE_MAP[f.extension] || "Other") : "Other";
      const destDir = path.join(params.path, folder);
      await fs.mkdir(destDir, { recursive: true });
      const destPath = path.join(destDir, f.name);
      try {
        await fs.rename(f.path, destPath);
        undoMoves.push({ from: f.path, to: destPath });
        details.push(`Moved ${f.name} → ${folder}/`);
        processed++;
      } catch {}
    }
  } else if (params.operation === "move" && params.destination) {
    await fs.mkdir(params.destination, { recursive: true });
    for (const f of affected) {
      const destPath = path.join(params.destination, f.name);
      try {
        await fs.rename(f.path, destPath);
        undoMoves.push({ from: f.path, to: destPath });
        details.push(`Moved: ${f.name}`);
        processed++;
      } catch {}
    }
  } else if (params.operation === "dedup") {
    const sizeMap = new Map<number, ScanFile[]>();
    affected.forEach(f => {
      const arr = sizeMap.get(f.size) || [];
      arr.push(f);
      sizeMap.set(f.size, arr);
    });
    const dupes = [...sizeMap.values()].filter(g => g.length > 1).flatMap(g => g.slice(1));
    for (const f of dupes) {
      try {
        const tempPath = path.join(TEMP_UNDO_DIR, `${Date.now()}_${f.name}`);
        await fs.rename(f.path, tempPath);
        undoFiles.push({ tempPath, originalPath: f.path });
        details.push(`Removed duplicate: ${f.name}`);
        processed++;
      } catch {}
    }
    affected = dupes;
  } else if (params.operation === "rename") {
    const criteria = params.criteria || "";
    const prefixMatch = criteria.match(/prefix[:\s]+["']?([^"',]+?)["']?(?:,|$)/i);
    const replaceMatch = criteria.match(/replace[:\s]+["']?(.+?)["']?\s+with\s+["']?(.+?)["']?(?:,|$)/i);
    const addNumbers = /number/i.test(criteria);
    let index = 1;
    for (const f of affected) {
      const ext = f.extension || "";
      const base = path.basename(f.name, ext);
      let newName = f.name;
      if (prefixMatch) {
        newName = `${prefixMatch[1]}${f.name}`;
      } else if (replaceMatch) {
        newName = base.replaceAll(replaceMatch[1], replaceMatch[2]) + ext;
      } else if (addNumbers) {
        newName = `${String(index).padStart(3, "0")}_${f.name}`;
      }
      if (newName !== f.name) {
        const destPath = path.join(path.dirname(f.path), newName);
        try {
          await fs.rename(f.path, destPath);
          undoMoves.push({ from: f.path, to: destPath });
          details.push(`Renamed: ${f.name} → ${newName}`);
          processed++;
        } catch {}
      }
      index++;
    }
  }

  const undoKey = undoFiles.length > 0
    ? JSON.stringify({ files: undoFiles })
    : undoMoves.length > 0
      ? JSON.stringify({ moves: undoMoves })
      : null;

  if (!params.skipActivityLog) {
    await db.insert(activityLogTable).values({
      type: "file_op",
      description: `${params.operation} on ${params.path}`,
      detail: details.slice(0, 5).join(", "),
      filesAffected: JSON.stringify(files.filter(f => f.type === "file").slice(0, processed).map(f => f.path)),
      undoable: undoKey !== null,
      undoData: undoKey,
    });
  }

  return {
    success: true,
    filesProcessed: processed,
    summary: `Processed ${processed} files via ${params.operation}`,
    details: details.slice(0, 20),
    undoKey,
  };
}
