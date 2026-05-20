import { Router } from "express";
import { db } from "@workspace/db";
import { settingsTable } from "@workspace/db";
import OpenAI from "openai";
import { PullAiModelBody } from "@workspace/api-zod";

const router = Router();

const CLOUD_MODELS = [
  { name: "gpt-4o", type: "cloud" as const, size: null, contextLength: 128000, description: "Most capable OpenAI model" },
  { name: "gpt-4o-mini", type: "cloud" as const, size: null, contextLength: 128000, description: "Fast and cost-efficient" },
  { name: "gpt-4-turbo", type: "cloud" as const, size: null, contextLength: 128000, description: "GPT-4 with vision" },
  { name: "gpt-3.5-turbo", type: "cloud" as const, size: null, contextLength: 16385, description: "Legacy fast model" },
];

async function checkOllama(baseUrl: string): Promise<{ available: boolean; version: string | null; models: Array<{ name: string; size: string }> }> {
  try {
    const res = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return { available: false, version: null, models: [] };
    const data = await res.json() as { models?: Array<{ name: string; size: number }> };
    const vRes = await fetch(`${baseUrl}/api/version`, { signal: AbortSignal.timeout(2000) }).catch(() => null);
    let version: string | null = null;
    if (vRes?.ok) {
      const vData = await vRes.json() as { version?: string };
      version = vData.version || null;
    }
    const models = (data.models || []).map(m => ({
      name: m.name,
      size: m.size ? `${(m.size / 1e9).toFixed(1)} GB` : "unknown",
    }));
    return { available: true, version, models };
  } catch {
    return { available: false, version: null, models: [] };
  }
}

// GET /ai/status
router.get("/ai/status", async (_req, res) => {
  const [settings] = await db.select().from(settingsTable).limit(1);
  const ollamaUrl = settings?.ollamaBaseUrl || "http://localhost:11434";
  const { available, version } = await checkOllama(ollamaUrl);
  res.json({
    mode: settings?.aiMode || "cloud",
    ollamaAvailable: available,
    ollamaVersion: version,
    activeModel: settings?.aiModel || "gpt-4o-mini",
    cloudConfigured: !!(settings?.cloudApiKey || process.env.OPENAI_API_KEY),
  });
});

// GET /ai/models
router.get("/ai/models", async (_req, res) => {
  const [settings] = await db.select().from(settingsTable).limit(1);
  const ollamaUrl = settings?.ollamaBaseUrl || "http://localhost:11434";
  const { available, models: localModels } = await checkOllama(ollamaUrl);
  const local = available ? localModels.map(m => ({
    name: m.name,
    type: "local" as const,
    size: m.size,
    contextLength: null,
    description: "Local Ollama model",
  })) : [];
  res.json([...local, ...CLOUD_MODELS]);
});

// POST /ai/models/pull
router.post("/ai/models/pull", async (req, res) => {
  const body = PullAiModelBody.parse(req.body);
  const [settings] = await db.select().from(settingsTable).limit(1);
  const ollamaUrl = settings?.ollamaBaseUrl || "http://localhost:11434";
  try {
    fetch(`${ollamaUrl}/api/pull`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: body.name }),
    }).catch(() => {});
    res.json({ name: body.name, status: "pulling", progress: 0 });
  } catch {
    res.json({ name: body.name, status: "error", progress: null });
  }
});

// DELETE /ai/models/:name
router.delete("/ai/models/:name", async (req, res) => {
  const [settings] = await db.select().from(settingsTable).limit(1);
  const ollamaUrl = settings?.ollamaBaseUrl || "http://localhost:11434";
  try {
    await fetch(`${ollamaUrl}/api/delete`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: req.params.name }),
    });
  } catch {}
  res.status(204).send();
});

export default router;
