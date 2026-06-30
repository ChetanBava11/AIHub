import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";

const nav = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/contacts", label: "Contacts" },
  { to: "/opportunities", label: "Opportunities" },
  { to: "/inbox", label: "Inbox" },
  { to: "/assistant", label: "AI Assistant" },
  { to: "/settings", label: "Settings" },
] as const;

export function AppShell({ title, children }: { title: string; children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-900">
      <aside className="w-56 border-r border-gray-200 bg-white">
        <div className="px-4 py-4 border-b border-gray-200">
          <span className="font-semibold text-blue-700">OpsCRM</span>
        </div>
        <nav className="p-2 space-y-1">
          {nav.map((n) => {
            const active = pathname === n.to || pathname.startsWith(n.to + "/");
            return (
              <Link
                key={n.to}
                to={n.to}
                className={
                  "block rounded px-3 py-2 text-sm " +
                  (active
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-700 hover:bg-gray-100")
                }
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="flex-1">
        <header className="border-b border-gray-200 bg-white px-6 py-3">
          <h1 className="text-lg font-semibold">{title}</h1>
        </header>
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}