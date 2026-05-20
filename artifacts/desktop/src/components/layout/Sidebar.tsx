import { Link, useLocation } from "wouter";
import { MessageSquare, CalendarClock, BookOpen, Activity, Zap, FolderSearch, Settings, Activity as ActivityIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGetSettings, getGetSettingsQueryKey } from "@workspace/api-client-react";

export function Sidebar() {
  const [location] = useLocation();
  const { data: settings } = useGetSettings({ query: { queryKey: getGetSettingsQueryKey() } });

  if (settings && !settings.onboardingCompleted && location !== "/onboarding") {
    return null;
  }

  if (location === "/onboarding") return null;

  const links = [
    { href: "/chat", icon: MessageSquare, label: "Chat" },
    { href: "/scheduler", icon: CalendarClock, label: "Scheduler" },
    { href: "/knowledge", icon: BookOpen, label: "Knowledge" },
    { href: "/activity", icon: Activity, label: "Activity" },
    { href: "/quick-actions", icon: Zap, label: "Quick Actions" },
    { href: "/files", icon: FolderSearch, label: "Files" },
    { href: "/stats", icon: ActivityIcon, label: "Stats" },
    { href: "/settings", icon: Settings, label: "Settings" },
  ];

  return (
    <div className="w-16 flex-shrink-0 border-r border-white/[0.07] bg-background flex flex-col items-center py-4 space-y-1 h-full relative z-10">
      {/* Logo mark */}
      <div className="w-9 h-9 rounded-xl bg-white/[0.06] flex items-center justify-center border border-white/20 mb-5 shadow-[0_0_0_1px_rgba(255,255,255,0.05)]">
        <Zap className="w-4 h-4 text-foreground/80" />
      </div>

      {links.map((link) => {
        const isActive = location === link.href || (location === "/" && link.href === "/chat");
        const Icon = link.icon;

        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-200 relative group border",
              isActive
                ? "bg-white/[0.08] border-white/30 text-foreground shadow-[0_0_0_1px_rgba(255,255,255,0.06),inset_0_1px_0_rgba(255,255,255,0.08)]"
                : "border-transparent text-muted-foreground hover:bg-white/[0.05] hover:border-white/15 hover:text-foreground/80"
            )}
            title={link.label}
          >
            <Icon className="w-4 h-4" />

            {/* Active left-edge indicator */}
            {isActive && (
              <div className="absolute -left-px top-1/2 -translate-y-1/2 w-[3px] h-5 bg-foreground/60 rounded-r-full" />
            )}

            {/* Tooltip */}
            <div className="absolute left-[52px] bg-popover text-popover-foreground text-xs px-2.5 py-1.5 rounded-md opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap border border-white/[0.08] shadow-xl z-50">
              {link.label}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
