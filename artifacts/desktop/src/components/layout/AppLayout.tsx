import { Sidebar } from "./Sidebar";
import { useLocation } from "wouter";
import { useEffect } from "react";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  useEffect(() => {
    // Apply dark mode by default if not set
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background bg-[url('https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-3xl z-0" />
      <Sidebar />
      <main className="flex-1 overflow-auto relative z-10 h-full p-4">
        <div className="h-full glass-panel rounded-2xl overflow-hidden shadow-2xl relative flex flex-col">
          {children}
        </div>
      </main>
    </div>
  );
}
