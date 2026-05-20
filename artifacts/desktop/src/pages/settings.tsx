import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Settings as SettingsIcon, Cpu, Cloud, Keyboard, FolderOpen, Bell, Monitor, RefreshCw, Loader2, CheckCircle2, AlertTriangle, Trash2, Pin } from "lucide-react";
import { electron, isElectron } from "@/lib/electron-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  useGetSettings, getGetSettingsQueryKey,
  useUpdateSettings,
  useGetAiStatus, getGetAiStatusQueryKey,
  useListAiModels, getListAiModelsQueryKey,
  usePullAiModel,
  useDeleteAiModel,
  useGetModelPullStatus,
  getGetModelPullStatusQueryKey,
} from "@workspace/api-client-react";
import type { AppSettings, AppSettingsUpdate } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";

function Section({ title, icon: Icon, children }: { title: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card rounded-xl p-5 border border-white/10 space-y-4"
    >
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <Separator className="bg-white/10" />
      <div className="space-y-4">{children}</div>
    </motion.div>
  );
}

function SettingRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground/90">{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export default function Settings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [pullModelName, setPullModelName] = useState("");
  const [activePulling, setActivePulling] = useState<string | null>(null);

  const { data: settings, isLoading } = useGetSettings({ query: { queryKey: getGetSettingsQueryKey() } });
  const { data: aiStatus } = useGetAiStatus({
    query: { queryKey: getGetAiStatusQueryKey(), refetchInterval: 10000 },
  });
  const { data: models = [] } = useListAiModels({ query: { queryKey: getListAiModelsQueryKey() } });

  const { data: pullStatus } = useGetModelPullStatus(activePulling ?? "", {
    query: {
      queryKey: getGetModelPullStatusQueryKey(activePulling ?? ""),
      enabled: !!activePulling,
      refetchInterval: (query) => {
        const data = query.state.data;
        if (!data) return 1500;
        if (data.status === "pulling") return 1500;
        return false;
      },
    },
  });

  useEffect(() => {
    if (!pullStatus || !activePulling) return;
    if (pullStatus.status === "complete") {
      toast({ title: `Model "${activePulling}" ready`, description: "Model downloaded successfully" });
      setActivePulling(null);
      queryClient.invalidateQueries({ queryKey: getListAiModelsQueryKey() });
    } else if (pullStatus.status === "error") {
      toast({ title: `Pull failed`, description: pullStatus.error || "Unknown error", variant: "destructive" });
      setActivePulling(null);
    }
  }, [pullStatus, activePulling, toast, queryClient]);

  const updateSettings = useUpdateSettings();
  const pullModel = usePullAiModel();
  const deleteModel = useDeleteAiModel();

  const update = useCallback((patch: AppSettingsUpdate) => {
    updateSettings.mutate({ data: patch }, {
      onSuccess: async () => {
        queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
        // Apply OS-level effects when running as Electron desktop app
        if (isElectron) {
          if (patch.hotkey !== undefined) {
            const result = await electron.updateHotkey(patch.hotkey);
            if (!result.success) {
              toast({ title: "Hotkey could not be registered", description: "Try a different key combination", variant: "destructive" });
            }
          }
          if (patch.launchAtLogin !== undefined) {
            await electron.setAutoLaunch(patch.launchAtLogin);
          }
          if (patch.dismissOnBlur !== undefined) {
            await electron.setDismissOnBlur(patch.dismissOnBlur);
          }
        }
      },
      onError: () => toast({ title: "Settings update failed", variant: "destructive" }),
    });
  }, [updateSettings, queryClient, toast]);

  const handlePullModel = () => {
    if (!pullModelName.trim()) return;
    const name = pullModelName.trim();
    pullModel.mutate({ data: { name } }, {
      onSuccess: () => {
        toast({ title: `Pulling ${name}…`, description: "Downloading in background — progress shown below" });
        setPullModelName("");
        setActivePulling(name);
      },
      onError: (e: unknown) => {
        const msg = e instanceof Error ? e.message : "Check that Ollama is running";
        toast({ title: "Pull failed", description: msg, variant: "destructive" });
      },
    });
  };

  const handleDeleteModel = (name: string) => {
    deleteModel.mutate({ name }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAiModelsQueryKey() });
        toast({ title: `Model ${name} removed` });
      },
    });
  };

  const handleRerunOnboarding = () => {
    update({ onboardingCompleted: false });
    setTimeout(() => setLocation("/onboarding"), 100);
  };

  const localModels = models.filter(m => m.type === "local");
  const cloudModels = models.filter(m => m.type === "cloud");

  if (isLoading || !settings) {
    return (
      <div className="p-6 space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-48 rounded-xl bg-white/5" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-white/10">
        <h1 className="text-base font-semibold">Settings</h1>
        <p className="text-xs text-muted-foreground mt-0.5">All changes apply immediately</p>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-4">

        {/* AI Mode */}
        <Section title="AI Provider" icon={Cpu}>
          <SettingRow
            label="Mode"
            description="Switch between local GPU (Ollama) and cloud AI"
          >
            <div className="flex gap-2">
              <Button
                size="sm"
                className={cn(
                  "h-7 text-xs",
                  settings.aiMode === "local"
                    ? "bg-primary/20 text-primary border border-primary/30"
                    : "glass-button"
                )}
                onClick={() => update({ aiMode: "local" })}
                data-testid="button-ai-mode-local"
              >
                <Cpu className="w-3 h-3 mr-1" />
                Local GPU
              </Button>
              <Button
                size="sm"
                className={cn(
                  "h-7 text-xs",
                  settings.aiMode === "cloud"
                    ? "bg-primary/20 text-primary border border-primary/30"
                    : "glass-button"
                )}
                onClick={() => update({ aiMode: "cloud" })}
                data-testid="button-ai-mode-cloud"
              >
                <Cloud className="w-3 h-3 mr-1" />
                Cloud
              </Button>
            </div>
          </SettingRow>

          {/* Ollama status */}
          {settings.aiMode === "local" && (
            <div className={cn(
              "rounded-lg p-3 border text-xs",
              aiStatus?.ollamaAvailable
                ? "bg-green-500/5 border-green-500/20"
                : "bg-amber-500/5 border-amber-500/20"
            )}>
              <div className="flex items-center gap-2">
                {aiStatus?.ollamaAvailable
                  ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                  : <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />}
                <span className={cn("flex-1", aiStatus?.ollamaAvailable ? "text-green-300" : "text-amber-300")}>
                  {aiStatus?.ollamaAvailable
                    ? `Ollama connected · v${aiStatus.ollamaVersion || "unknown"}`
                    : "Ollama not detected — install from ollama.ai and run `ollama serve`"}
                </span>
                {!aiStatus?.ollamaAvailable && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-[10px] px-2 border border-amber-500/30 text-amber-300 hover:bg-amber-500/10 shrink-0"
                    onClick={() => update({ aiMode: "cloud" })}
                    data-testid="button-fallback-to-cloud"
                  >
                    <Cloud className="w-2.5 h-2.5 mr-1" />
                    Use Cloud
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Local: Ollama base URL + model */}
          {settings.aiMode === "local" && (
            <>
              <SettingRow label="Ollama URL">
                <Input
                  value={settings.ollamaBaseUrl}
                  onChange={e => update({ ollamaBaseUrl: e.target.value })}
                  className="glass-input h-7 text-xs w-52 font-mono"
                  data-testid="input-ollama-url"
                />
              </SettingRow>

              <SettingRow label="Active Model">
                <Select value={settings.aiModel} onValueChange={v => update({ aiModel: v })}>
                  <SelectTrigger className="glass-input h-7 text-xs w-44" data-testid="select-local-model">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="glass-panel border-white/10">
                    {localModels.length === 0 && (
                      <SelectItem value={settings.aiModel} className="text-xs">{settings.aiModel}</SelectItem>
                    )}
                    {localModels.map(m => (
                      <SelectItem key={m.name} value={m.name} className="text-xs">{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SettingRow>

              {/* Model manager */}
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Installed Models</p>
                {localModels.length === 0 ? (
                  <p className="text-xs text-muted-foreground/50 italic">No local models — pull one below</p>
                ) : (
                  <div className="space-y-1.5">
                    {localModels.map(m => (
                      <div key={m.name} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-white/5">
                        <div>
                          <span className="text-xs font-medium">{m.name}</span>
                          {m.size && <span className="text-[10px] text-muted-foreground ml-2">{m.size}</span>}
                        </div>
                        <button
                          className="w-5 h-5 flex items-center justify-center rounded hover:bg-destructive/10"
                          onClick={() => handleDeleteModel(m.name)}
                          data-testid={`button-delete-model-${m.name}`}
                        >
                          <Trash2 className="w-3 h-3 text-muted-foreground hover:text-destructive" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {/* Active pull progress */}
                {activePulling && pullStatus && (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-2.5 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-primary font-medium flex items-center gap-1">
                        <Loader2 className="w-2.5 h-2.5 animate-spin" />
                        Pulling {activePulling}…
                      </span>
                      <span className="text-muted-foreground">{pullStatus.progress ?? 0}%</span>
                    </div>
                    <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-500"
                        style={{ width: `${pullStatus.progress ?? 0}%` }}
                      />
                    </div>
                    {pullStatus.total != null && pullStatus.total > 0 && (
                      <p className="text-[10px] text-muted-foreground/60">
                        {((pullStatus.completed ?? 0) / 1e9).toFixed(1)} / {(pullStatus.total / 1e9).toFixed(1)} GB
                      </p>
                    )}
                  </div>
                )}
                <div className="flex gap-2 mt-2">
                  <Input
                    value={pullModelName}
                    onChange={e => setPullModelName(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handlePullModel()}
                    placeholder="llama3, mistral, phi3..."
                    className="glass-input h-7 text-xs flex-1"
                    data-testid="input-pull-model"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs border border-white/10"
                    onClick={handlePullModel}
                    disabled={!pullModelName.trim() || pullModel.isPending || !!activePulling}
                    data-testid="button-pull-model"
                  >
                    {pullModel.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Pull"}
                  </Button>
                </div>
              </div>
            </>
          )}

          {/* Cloud: API key + model */}
          {settings.aiMode === "cloud" && (
            <>
              <SettingRow label="API Key">
                <Input
                  type="password"
                  value={settings.cloudApiKey || ""}
                  onChange={e => update({ cloudApiKey: e.target.value })}
                  placeholder="sk-..."
                  className="glass-input h-7 text-xs w-52 font-mono"
                  data-testid="input-api-key"
                />
              </SettingRow>
              <SettingRow label="Base URL" description="Override for custom OpenAI-compatible endpoints">
                <Input
                  value={settings.cloudBaseUrl || ""}
                  onChange={e => update({ cloudBaseUrl: e.target.value })}
                  placeholder="https://api.openai.com/v1"
                  className="glass-input h-7 text-xs w-52 font-mono"
                  data-testid="input-base-url"
                />
              </SettingRow>
              <SettingRow label="Model">
                <Select value={settings.aiModel} onValueChange={v => update({ aiModel: v })}>
                  <SelectTrigger className="glass-input h-7 text-xs w-44" data-testid="select-cloud-model">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="glass-panel border-white/10">
                    {cloudModels.map(m => (
                      <SelectItem key={m.name} value={m.name} className="text-xs">
                        {m.name}
                        {m.description && <span className="text-muted-foreground ml-1">· {m.description}</span>}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SettingRow>
            </>
          )}
        </Section>

        {/* Hotkey */}
        <Section title="Global Hotkey" icon={Keyboard}>
          <SettingRow label="Activation Hotkey" description="Press this combination to open AXIOM from anywhere">
            <Input
              value={settings.hotkey}
              onChange={e => update({ hotkey: e.target.value })}
              placeholder="CommandOrControl+Shift+Space"
              className="glass-input h-7 text-xs w-56 font-mono"
              data-testid="input-hotkey"
            />
          </SettingRow>
        </Section>

        {/* Theme */}
        <Section title="Appearance" icon={Monitor}>
          <SettingRow label="Theme">
            <Select value={settings.theme} onValueChange={v => update({ theme: v as "light" | "dark" | "system" })}>
              <SelectTrigger className="glass-input h-7 text-xs w-32" data-testid="select-theme">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="glass-panel border-white/10">
                <SelectItem value="dark" className="text-xs">Dark</SelectItem>
                <SelectItem value="light" className="text-xs">Light</SelectItem>
                <SelectItem value="system" className="text-xs">System</SelectItem>
              </SelectContent>
            </Select>
          </SettingRow>
        </Section>

        {/* Window behavior */}
        <Section title="Window Behavior" icon={Monitor}>
          <SettingRow label="Launch at Login">
            <Switch
              checked={settings.launchAtLogin}
              onCheckedChange={v => update({ launchAtLogin: v })}
              data-testid="switch-launch-at-login"
            />
          </SettingRow>
          <SettingRow label="Start Minimized">
            <Switch
              checked={settings.startMinimized}
              onCheckedChange={v => update({ startMinimized: v })}
              data-testid="switch-start-minimized"
            />
          </SettingRow>
          <SettingRow label="Dismiss on Focus Loss">
            <Switch
              checked={settings.dismissOnBlur}
              onCheckedChange={v => update({ dismissOnBlur: v })}
              data-testid="switch-dismiss-on-blur"
            />
          </SettingRow>
        </Section>

        {/* Notifications */}
        <Section title="Notifications" icon={Bell}>
          <SettingRow label="Notify on Scheduled Task Complete">
            <Switch
              checked={settings.notifyOnSchedule}
              onCheckedChange={v => update({ notifyOnSchedule: v })}
              data-testid="switch-notify-schedule"
            />
          </SettingRow>
          <SettingRow label="Notify on Error">
            <Switch
              checked={settings.notifyOnError}
              onCheckedChange={v => update({ notifyOnError: v })}
              data-testid="switch-notify-error"
            />
          </SettingRow>
        </Section>

        {/* Onboarding */}
        <Section title="Setup" icon={RefreshCw}>
          <SettingRow label="Re-run Onboarding" description="Walk through the setup wizard again">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs border border-white/10 hover:bg-white/10"
              onClick={handleRerunOnboarding}
              data-testid="button-rerun-onboarding"
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Re-run
            </Button>
          </SettingRow>
        </Section>

      </div>
    </div>
  );
}
