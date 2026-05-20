import { Link, useLocation } from "wouter";
import { MessageSquare, CalendarClock, BookOpen, Activity, Zap, FolderSearch, Settings, Activity as ActivityIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGetSettings, getGetSettingsQueryKey } from "@workspace/api-client-react";

export function Sidebar() {
  const [location] = useLocation();
  const { data: settings } = useGetSettings({ query: { queryKey: getGetSettingsQueryKey() } });

  if (settings && !settings.onboardingCompleted && location !== "/onboarding") {
    return null; // Don't show sidebar during onboarding
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
    <div className="w-16 flex-shrink-0 border-r border-white/10 glass-panel flex flex-col items-center py-4 space-y-4 h-full relative z-10">
      <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center border border-primary/30 mb-4 shadow-[0_0_15px_rgba(var(--primary),0.3)]">
        <Zap className="w-5 h-5 text-primary" />
      </div>
      
      {links.map((link) => {
        const isActive = location === link.href || (location === "/" && link.href === "/chat");
        const Icon = link.icon;
        
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-200 relative group",
              isActive 
                ? "bg-primary/20 text-primary shadow-[inset_0_0_10px_rgba(var(--primary),0.2)]" 
                : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
            )}
            title={link.label}
          >
            <Icon className="w-5 h-5" />
            {isActive && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-primary rounded-r-full" />
            )}
            
            <div className="absolute left-14 bg-popover text-popover-foreground text-xs px-2 py-1 rounded opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap border border-white/10 glass-card">
              {link.label}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
