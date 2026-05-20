import { Router } from "express";
import { db } from "@workspace/db";
import { scheduledTasksTable, settingsTable, knowledgeNotesTable, chatMessagesTable, activityLogTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import cron from "node-cron";
import OpenAI from "openai";
import {
  CreateScheduledTaskBody,
  UpdateScheduledTaskBody,
} from "@workspace/api-zod";

const router = Router();

const activeCrons = new Map<number, cron.ScheduledTask>();

function calcNextRun(schedule: string): Date | null {
  try {
    const interval = cron.schedule(schedule, () => {});
    interval.stop();
    const now = new Date();
    now.setSeconds(now.getSeconds() + 1);
    return now;
  } catch {
    return null;
  }
}

export async function initScheduler() {
  const tasks = await db.select().from(scheduledTasksTable).where(eq(scheduledTasksTable.enabled, true));
  for (const task of tasks) {
    scheduleTask(task);
  }
}

export function scheduleTask(task: { id: number; schedule: string; command: string; name: string }) {
  if (activeCrons.has(task.id)) {
    activeCrons.get(task.id)?.stop();
  }
  if (!cron.validate(task.schedule)) return;
  const job = cron.schedule(task.schedule, async () => {
    await runTask(task.id);
  });
  activeCrons.set(task.id, job);
}

export function stopTask(id: number) {
  activeCrons.get(id)?.stop();
  activeCrons.delete(id);
}

async function runTask(id: number): Promise<{ success: boolean; output: string }> {
  const [task] = await db.select().from(scheduledTasksTable).where(eq(scheduledTasksTable.id, id));
  if (!task) return { success: false, output: "Task not found" };

  const [settings] = await db.select().from(settingsTable).limit(1);
  const notes = await db.select().from(knowledgeNotesTable);
  const knowledgeCtx = notes.length
    ? "\n\n## User Knowledge Base\n" + notes.map(n => `### ${n.title}\n${n.content}`).join("\n\n")
    : "";

  let output = `Executed: ${task.command}`;
  let success = true;

  try {
    const client = settings?.aiMode === "local"
      ? new OpenAI({ baseURL: `${settings.ollamaBaseUrl}/v1`, apiKey: "ollama" })
      : new OpenAI({ apiKey: settings?.cloudApiKey || process.env.OPENAI_API_KEY || "", baseURL: settings?.cloudBaseUrl || undefined });

    const completion = await client.chat.completions.create({
      model: settings?.aiModel || "gpt-4o-mini",
      messages: [
        { role: "system", content: `You are AXIOM scheduled task runner. Execute this task description and provide a brief summary of what was done.${knowledgeCtx}` },
        { role: "user", content: task.command },
      ],
      max_tokens: 512,
    });
    output = completion.choices[0]?.message?.content || output;
  } catch (err) {
    output = `AI provider unavailable. Task recorded: ${task.command}`;
    success = false;
  }

  const ranAt = new Date();
  await db.update(scheduledTasksTable).set({
    lastRunAt: ranAt,
    lastRunStatus: success ? "success" : "error",
    nextRunAt: calcNextRun(task.schedule),
  }).where(eq(scheduledTasksTable.id, id));

  await db.insert(activityLogTable).values({
    type: "scheduled",
    description: `Scheduled: ${task.name}`,
    detail: output.slice(0, 500),
    filesAffected: "[]",
    undoable: false,
  });

  return { success, output };
}

// GET /scheduler/tasks
router.get("/scheduler/tasks", async (_req, res) => {
  const tasks = await db.select().from(scheduledTasksTable).orderBy(desc(scheduledTasksTable.createdAt));
  res.json(tasks);
});

// POST /scheduler/tasks
router.post("/scheduler/tasks", async (req, res) => {
  const body = CreateScheduledTaskBody.parse(req.body);
  const [task] = await db.insert(scheduledTasksTable).values({
    name: body.name,
    command: body.command,
    schedule: body.schedule,
    scheduleLabel: body.scheduleLabel,
    enabled: body.enabled !== false,
    nextRunAt: calcNextRun(body.schedule),
  }).returning();
  if (task.enabled) scheduleTask(task);
  res.status(201).json(task);
});

// GET /scheduler/tasks/:id
router.get("/scheduler/tasks/:id", async (req, res) => {
  const [task] = await db.select().from(scheduledTasksTable).where(eq(scheduledTasksTable.id, parseInt(req.params.id)));
  if (!task) return res.status(404).json({ error: "Not found" });
  res.json(task);
});

// PATCH /scheduler/tasks/:id
router.patch("/scheduler/tasks/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const body = UpdateScheduledTaskBody.parse(req.body);
  const updateData: Record<string, unknown> = { ...body };
  if (body.schedule) updateData.nextRunAt = calcNextRun(body.schedule);
  const [task] = await db.update(scheduledTasksTable).set(updateData).where(eq(scheduledTasksTable.id, id)).returning();
  if (!task) return res.status(404).json({ error: "Not found" });
  if (task.enabled) scheduleTask(task);
  else stopTask(id);
  res.json(task);
});

// DELETE /scheduler/tasks/:id
router.delete("/scheduler/tasks/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  stopTask(id);
  await db.delete(scheduledTasksTable).where(eq(scheduledTasksTable.id, id));
  res.status(204).send();
});

// POST /scheduler/tasks/:id/run
router.post("/scheduler/tasks/:id/run", async (req, res) => {
  const id = parseInt(req.params.id);
  const result = await runTask(id);
  res.json({ ...result, ranAt: new Date() });
});

// POST /scheduler/tasks/:id/toggle
router.post("/scheduler/tasks/:id/toggle", async (req, res) => {
  const id = parseInt(req.params.id);
  const [existing] = await db.select().from(scheduledTasksTable).where(eq(scheduledTasksTable.id, id));
  if (!existing) return res.status(404).json({ error: "Not found" });
  const [task] = await db.update(scheduledTasksTable).set({ enabled: !existing.enabled }).where(eq(scheduledTasksTable.id, id)).returning();
  if (task.enabled) scheduleTask(task);
  else stopTask(id);
  res.json(task);
});

// GET /scheduler/status
router.get("/scheduler/status", async (_req, res) => {
  const tasks = await db.select().from(scheduledTasksTable);
  const now = new Date();
  const statusTasks = tasks.map(t => ({
    id: t.id,
    name: t.name,
    enabled: t.enabled,
    nextRunAt: t.nextRunAt?.toISOString() || null,
    secondsUntilRun: t.nextRunAt ? Math.max(0, Math.floor((t.nextRunAt.getTime() - now.getTime()) / 1000)) : null,
  }));
  res.json({
    tasks: statusTasks,
    totalEnabled: tasks.filter(t => t.enabled).length,
    totalDisabled: tasks.filter(t => !t.enabled).length,
  });
});

export { runTask };
export default router;
