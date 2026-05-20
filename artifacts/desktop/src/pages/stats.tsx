import { motion } from "framer-motion";
import { Cpu, MemoryStick, HardDrive, Clock, Activity } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetSystemStats, getGetSystemStatsQueryKey } from "@workspace/api-client-react";

function GaugeBar({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono font-medium" style={{ color }}>{value}%</span>
      </div>
      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(0)} MB`;
  return `${(bytes / 1e3).toFixed(0)} KB`;
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function Stats() {
  const { data: stats, isLoading } = useGetSystemStats({
    query: {
      queryKey: getGetSystemStatsQueryKey(),
      refetchInterval: 3000,
    },
  });

  const cpuColor = !stats ? "#22d3ee" : stats.cpu > 80 ? "#f87171" : stats.cpu > 60 ? "#fb923c" : "#22d3ee";
  const memColor = !stats ? "#a78bfa" : stats.memory.percent > 80 ? "#f87171" : stats.memory.percent > 60 ? "#fb923c" : "#a78bfa";

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold">System Status</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Live stats · refreshes every 3 seconds</p>
        </div>
        {stats && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span>Uptime {formatUptime(stats.uptime)}</span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-36 rounded-xl bg-white/5" />
            ))}
          </div>
        ) : !stats ? (
          <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
            Could not load system stats
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* CPU */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card rounded-xl p-5 border border-white/10"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                      <Cpu className="w-4 h-4 text-cyan-400" />
                    </div>
                    <span className="text-sm font-medium">CPU</span>
                  </div>
                  <span className="text-2xl font-bold font-mono" style={{ color: cpuColor }}>{stats.cpu}%</span>
                </div>
                <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: `linear-gradient(90deg, ${cpuColor}88, ${cpuColor})` }}
                    initial={{ width: 0 }}
                    animate={{ width: `${stats.cpu}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2">{stats.cpu < 30 ? "Idle" : stats.cpu < 60 ? "Moderate load" : stats.cpu < 80 ? "High load" : "Very high load"}</p>
              </motion.div>

              {/* RAM */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="glass-card rounded-xl p-5 border border-white/10"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
                      <MemoryStick className="w-4 h-4 text-violet-400" />
                    </div>
                    <span className="text-sm font-medium">Memory</span>
                  </div>
                  <span className="text-2xl font-bold font-mono" style={{ color: memColor }}>{stats.memory.percent}%</span>
                </div>
                <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: `linear-gradient(90deg, ${memColor}88, ${memColor})` }}
                    initial={{ width: 0 }}
                    animate={{ width: `${stats.memory.percent}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {formatBytes(stats.memory.used)} used · {formatBytes(stats.memory.free)} free · {formatBytes(stats.memory.total)} total
                </p>
              </motion.div>
            </div>

            {/* Disk */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="glass-card rounded-xl p-5 border border-white/10"
            >
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <HardDrive className="w-4 h-4 text-emerald-400" />
                </div>
                <span className="text-sm font-medium">Disk Usage</span>
              </div>
              <div className="space-y-3">
                {stats.disk.map((d, i) => {
                  const diskColor = d.percent > 90 ? "#f87171" : d.percent > 70 ? "#fb923c" : "#34d399";
                  return (
                    <div key={i} className="space-y-1.5" data-testid={`disk-${i}`}>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground font-mono">{d.mount}</span>
                        <span className="text-muted-foreground">
                          {formatBytes(d.used)} / {formatBytes(d.total)}
                          <span className="ml-2 font-medium font-mono" style={{ color: diskColor }}>{d.percent}%</span>
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: diskColor }}
                          initial={{ width: 0 }}
                          animate={{ width: `${d.percent}%` }}
                          transition={{ duration: 0.6, delay: i * 0.08 }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>

            {/* Quick stat cards */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="grid grid-cols-3 gap-3"
            >
              <div className="glass-card rounded-xl p-4 border border-white/10 text-center">
                <Activity className="w-4 h-4 text-cyan-400 mx-auto mb-2" />
                <div className="text-lg font-bold font-mono text-cyan-400">{stats.cpu}%</div>
                <div className="text-xs text-muted-foreground">CPU Load</div>
              </div>
              <div className="glass-card rounded-xl p-4 border border-white/10 text-center">
                <MemoryStick className="w-4 h-4 text-violet-400 mx-auto mb-2" />
                <div className="text-lg font-bold font-mono text-violet-400">{formatBytes(stats.memory.used)}</div>
                <div className="text-xs text-muted-foreground">RAM Used</div>
              </div>
              <div className="glass-card rounded-xl p-4 border border-white/10 text-center">
                <Clock className="w-4 h-4 text-emerald-400 mx-auto mb-2" />
                <div className="text-lg font-bold font-mono text-emerald-400">{formatUptime(stats.uptime)}</div>
                <div className="text-xs text-muted-foreground">Uptime</div>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
