import { Sidebar } from "./Sidebar";
import { WindowTitleBar } from "./WindowTitleBar";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { useGetSettings, getGetSettingsQueryKey } from "@workspace/api-client-react";

function applyTheme(theme: string) {
  const root = document.documentElement;
  if (theme === "light") {
    root.classList.remove("dark");
    root.classList.add("light");
  } else if (theme === "dark") {
    root.classList.remove("light");
    root.classList.add("dark");
  } else {
    // system
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.classList.remove("light", "dark");
    root.classList.add(prefersDark ? "dark" : "light");
  }
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data: settings } = useGetSettings({ query: { queryKey: getGetSettingsQueryKey() } });

  useEffect(() => {
    const theme = settings?.theme ?? "dark";
    applyTheme(theme);

    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => applyTheme("system");
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
    return undefined;
  }, [settings?.theme]);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background bg-[url('https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-3xl z-0" />
      <Sidebar />
      <main className="flex-1 overflow-auto relative z-10 h-full p-4 flex flex-col">
        <WindowTitleBar />
        <div className="flex-1 glass-panel rounded-2xl overflow-hidden shadow-2xl relative flex flex-col min-h-0">
          {children}
        </div>
      </main>
    </div>
  );
}
