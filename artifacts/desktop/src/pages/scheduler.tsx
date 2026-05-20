import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Play, Trash2, ToggleLeft, ToggleRight, Clock, CheckCircle2, XCircle, Loader2, CalendarClock, ChevronDown, ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  useListScheduledTasks, getListScheduledTasksQueryKey,
  useCreateScheduledTask,
  useDeleteScheduledTask,
  useRunScheduledTask,
  useToggleScheduledTask,
  useGetSchedulerStatus, getGetSchedulerStatusQueryKey,
  useGetTaskRunLogs,
} from "@workspace/api-client-react";
import type { ScheduledTask } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

const SCHEDULE_PRESETS = [
  { label: "Every day at 9am", cron: "0 9 * * *" },
  { label: "Every Monday at 9am", cron: "0 9 * * 1" },
  { label: "Every hour", cron: "0 * * * *" },
  { label: "Every 30 minutes", cron: "*/30 * * * *" },
  { label: "Every Sunday at midnight", cron: "0 0 * * 0" },
  { label: "1st of every month", cron: "0 8 1 * *" },
  { label: "Custom cron...", cron: "custom" },
];

function formatRelative(date: string | null | undefined): string {
  if (!date) return "Never";
  const d = new Date(date);
  const diff = d.getTime() - Date.now();
  const abs = Math.abs(diff);
  if (abs < 60000) return diff > 0 ? "in <1 min" : "just now";
  if (abs < 3600000) {
    const m = Math.round(abs / 60000);
    return diff > 0 ? `in ${m}m` : `${m}m ago`;
  }
  if (abs < 86400000) {
    const h = Math.round(abs / 3600000);
    return diff > 0 ? `in ${h}h` : `${h}h ago`;
  }
  const dy = Math.round(abs / 86400000);
  return diff > 0 ? `in ${dy}d` : `${dy}d ago`;
}

function TaskRunLog({ taskId }: { taskId: number }) {
  const { data: logs = [], isLoading } = useGetTaskRunLogs({ id: taskId });

  if (isLoading) {
    return (
      <div className="pt-2 space-y-1.5">
        {[0, 1].map(i => <Skeleton key={i} className="h-8 w-full rounded-lg bg-white/5" />)}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <p className="pt-2 text-[11px] text-muted-foreground/60 italic">No runs yet — click Run Now to trigger this task.</p>
    );
  }

  return (
    <div className="pt-2 space-y-1.5 max-h-40 overflow-y-auto pr-1">
      {logs.map((log) => (
        <div key={log.id} className="flex items-start gap-2 rounded-lg bg-white/5 px-2.5 py-2">
          {log.detail?.toLowerCase().includes("error") || log.detail?.toLowerCase().includes("failed") ? (
            <XCircle className="w-3 h-3 text-red-400 mt-0.5 shrink-0" />
          ) : (
            <CheckCircle2 className="w-3 h-3 text-green-400 mt-0.5 shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-foreground/80 leading-relaxed">{log.detail || log.description}</p>
            <p className="text-[10px] text-muted-foreground/50 mt-0.5">
              {log.createdAt ? formatRelative(log.createdAt) : ""}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function TaskCard({ task, onRun, onToggle, onDelete }: {
  task: ScheduledTask;
  onRun: (id: number) => void;
  onToggle: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  const [showLog, setShowLog] = useState(false);
  const statusColor = task.lastRunStatus === "success" ? "text-green-400" : task.lastRunStatus === "error" ? "text-red-400" : "text-muted-foreground";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn(
        "glass-card rounded-xl border transition-all duration-200",
        task.enabled ? "border-white/10 hover:border-white/20" : "border-white/5 opacity-60"
      )}
      data-testid={`task-card-${task.id}`}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <CalendarClock className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="text-sm font-medium truncate">{task.name}</span>
              {task.enabled ? (
                <Badge className="text-[10px] h-4 px-1.5 bg-green-500/10 text-green-400 border-green-500/20">Active</Badge>
              ) : (
                <Badge className="text-[10px] h-4 px-1.5 bg-white/5 text-muted-foreground border-white/10">Paused</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate mb-3">{task.command}</p>

            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>{task.scheduleLabel || task.schedule}</span>
              </div>
              {task.lastRunAt && (
                <div className={cn("flex items-center gap-1", statusColor)}>
                  {task.lastRunStatus === "success" ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                  <span>Last: {formatRelative(task.lastRunAt)}</span>
                </div>
              )}
              {task.nextRunAt && task.enabled && (
                <div className="flex items-center gap-1 text-primary/70">
                  <Clock className="w-3 h-3" />
                  <span>Next: {formatRelative(task.nextRunAt)}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <Button
              size="icon"
              variant="ghost"
              className="w-7 h-7 hover:bg-primary/10 hover:text-primary"
              onClick={() => onRun(task.id)}
              title="Run now"
              data-testid={`button-run-task-${task.id}`}
            >
              <Play className="w-3.5 h-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="w-7 h-7 hover:bg-white/10"
              onClick={() => onToggle(task.id)}
              title={task.enabled ? "Pause" : "Enable"}
              data-testid={`button-toggle-task-${task.id}`}
            >
              {task.enabled
                ? <ToggleRight className="w-4 h-4 text-primary" />
                : <ToggleLeft className="w-4 h-4 text-muted-foreground" />}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="w-7 h-7 hover:bg-destructive/10 hover:text-destructive"
              onClick={() => onDelete(task.id)}
              title="Delete"
              data-testid={`button-delete-task-${task.id}`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Run log toggle */}
      <div
        className="px-4 py-2 border-t border-white/5 flex items-center gap-1.5 cursor-pointer hover:bg-white/5 transition-colors"
        onClick={() => setShowLog(v => !v)}
        data-testid={`button-show-log-${task.id}`}
      >
        <ScrollText className="w-3 h-3 text-muted-foreground/60" />
        <span className="text-[11px] text-muted-foreground/60">Run log</span>
        <ChevronDown className={cn("w-3 h-3 text-muted-foreground/50 ml-auto transition-transform", showLog && "rotate-180")} />
      </div>

      <AnimatePresence>
        {showLog && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="px-4 pb-3 overflow-hidden"
          >
            <TaskRunLog taskId={task.id} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function Scheduler() {
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [command, setCommand] = useState("");
  const [schedulePreset, setSchedulePreset] = useState("");
  const [customCron, setCustomCron] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: tasks = [], isLoading } = useListScheduledTasks({ query: { queryKey: getListScheduledTasksQueryKey() } });
  const { data: status } = useGetSchedulerStatus({ query: { queryKey: getGetSchedulerStatusQueryKey(), refetchInterval: 5000 } });

  const createTask = useCreateScheduledTask();
  const deleteTask = useDeleteScheduledTask();
  const runTask = useRunScheduledTask();
  const toggleTask = useToggleScheduledTask();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListScheduledTasksQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetSchedulerStatusQueryKey() });
  };

  const handleAdd = () => {
    const schedule = schedulePreset === "custom" ? customCron : schedulePreset;
    if (!name.trim() || !command.trim() || !schedule) {
      toast({ title: "Please fill in all fields", variant: "destructive" });
      return;
    }
    const preset = SCHEDULE_PRESETS.find(p => p.cron === schedule);
    createTask.mutate(
      { data: { name, command, schedule, scheduleLabel: preset?.label } },
      {
        onSuccess: () => {
          invalidate();
          setShowAdd(false);
          setName(""); setCommand(""); setSchedulePreset(""); setCustomCron("");
          toast({ title: "Task created" });
        },
        onError: () => toast({ title: "Failed to create task", variant: "destructive" }),
      }
    );
  };

  const handleRun = (id: number) => {
    runTask.mutate({ id }, {
      onSuccess: (r) => {
        invalidate();
        queryClient.invalidateQueries({ queryKey: ["scheduler", "tasks", id, "logs"] });
        toast({ title: r.success ? "Task completed" : "Task failed", description: r.output?.slice(0, 120) });
      },
    });
  };

  const handleToggle = (id: number) => {
    toggleTask.mutate({ id }, { onSuccess: () => invalidate() });
  };

  const handleDelete = (id: number) => {
    deleteTask.mutate({ id }, { onSuccess: () => invalidate() });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold">Task Scheduler</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {status ? `${status.totalEnabled} active · ${status.totalDisabled} paused` : "Loading..."}
          </p>
        </div>
        <Button
          size="sm"
          className="bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 h-8 text-xs"
          onClick={() => setShowAdd(true)}
          data-testid="button-add-task"
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Add Task
        </Button>
      </div>

      {/* Status bar */}
      {status && status.tasks.length > 0 && (
        <div className="px-6 py-2.5 border-b border-white/5 flex gap-4 overflow-x-auto scrollbar-hide">
          {status.tasks.filter(t => t.enabled && t.nextRunAt).slice(0, 4).map(t => (
            <div key={t.id} className="flex items-center gap-1.5 shrink-0">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <span className="text-[11px] text-muted-foreground">{t.name}</span>
              <span className="text-[11px] text-primary/70">{formatRelative(t.nextRunAt)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Task list */}
      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl bg-white/5" />
            ))}
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[300px] gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
              <CalendarClock className="w-7 h-7 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium">No scheduled tasks</p>
              <p className="text-xs text-muted-foreground mt-1">Create a task to automate recurring actions</p>
            </div>
            <Button
              size="sm"
              className="bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30"
              onClick={() => setShowAdd(true)}
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Create First Task
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {tasks.map(task => (
                <TaskCard key={task.id} task={task} onRun={handleRun} onToggle={handleToggle} onDelete={handleDelete} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Add task dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="glass-panel border-white/10 bg-card/80 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">New Scheduled Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Task Name</Label>
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Weekly cleanup"
                className="glass-input h-8 text-sm"
                data-testid="input-task-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">What should it do?</Label>
              <Textarea
                value={command}
                onChange={e => setCommand(e.target.value)}
                placeholder="Delete files in Downloads older than 14 days"
                className="glass-input text-sm min-h-[70px] resize-none"
                data-testid="input-task-command"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Schedule</Label>
              <Select value={schedulePreset} onValueChange={setSchedulePreset}>
                <SelectTrigger className="glass-input h-8 text-sm" data-testid="select-schedule">
                  <SelectValue placeholder="Pick a schedule..." />
                </SelectTrigger>
                <SelectContent className="glass-panel border-white/10">
                  {SCHEDULE_PRESETS.map(p => (
                    <SelectItem key={p.cron} value={p.cron} className="text-sm">{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {schedulePreset === "custom" && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Cron Expression</Label>
                <Input
                  value={customCron}
                  onChange={e => setCustomCron(e.target.value)}
                  placeholder="0 9 * * 1"
                  className="glass-input h-8 text-sm font-mono"
                  data-testid="input-custom-cron"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button
              size="sm"
              className="text-xs bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30"
              onClick={handleAdd}
              disabled={createTask.isPending}
              data-testid="button-create-task"
            >
              {createTask.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
              Create Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
