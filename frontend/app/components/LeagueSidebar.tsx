"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { UserButton, useUser } from "@clerk/nextjs";

const nav = (leagueId: string) =>
  [
    { href: `/leagues/${leagueId}`, label: "Home", icon: IconHome },
    { href: `/leagues/${leagueId}/team`, label: "My Team", icon: IconShirt },
    { href: `/leagues/${leagueId}/players`, label: "Players", icon: IconUsers },
    { href: `/leagues/${leagueId}/trades`, label: "Trades", icon: IconSwap },
    { href: `/leagues/${leagueId}/draft`, label: "Draft", icon: IconBoard },
    { href: `/leagues/${leagueId}/rules`, label: "Rules", icon: IconRules },
  ] as const;

function IconHome({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  );
}

function IconShirt({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 3l2.4 1.2L18 4l2 3v3h-2.5L17 20H7V10H3V7l2-3 3.6-.2L12 3z" />
    </svg>
  );
}

function IconUsers({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  );
}

function IconSwap({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
    </svg>
  );
}

function IconBoard({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 4.5v15m6-15v15m-10.875 0h15.75c.621 0 1.125-.504 1.125-1.125V5.625c0-.621-.504-1.125-1.125-1.125H4.125C3.504 4.5 3 5.004 3 5.625v12.75c0 .621.504 1.125 1.125 1.125z" />
    </svg>
  );
}

function IconRules({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}

function IconMenu({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
  );
}

export function LeagueSidebar({ leagueId }: { leagueId: string }) {
  const pathname = usePathname();
  const { user } = useUser();
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const expanded = pinned || hovered;
  const items = nav(leagueId);

  return (
    <>
      <aside
        className={`hidden md:flex shrink-0 flex-col border-r border-white/8 bg-black/30 transition-[width] duration-200 ease-out ${
          expanded ? "w-56" : "w-[72px]"
        }`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div className="flex h-14 items-center justify-between gap-2 border-b border-white/8 px-3">
          <Link
            href="/dashboard"
            className={`flex min-w-0 items-center gap-2 font-bold tracking-tight text-white ${expanded ? "opacity-100" : "opacity-0 w-0 overflow-hidden"}`}
          >
            <span className="truncate text-sm">Crease</span>
          </Link>
          <button
            type="button"
            onClick={() => setPinned((p) => !p)}
            className="rounded-lg p-2 text-zinc-400 hover:bg-white/5 hover:text-white"
            aria-label={pinned ? "Collapse sidebar" : "Expand sidebar"}
          >
            <IconMenu className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 p-2">
          {items.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== `/leagues/${leagueId}` && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold tracking-tight transition ${
                  active
                    ? "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/40"
                    : "text-zinc-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    active ? "bg-emerald-500/20 text-emerald-300" : "bg-white/5 text-zinc-400 group-hover:text-white"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span
                  className={`truncate transition-opacity ${expanded ? "opacity-100" : "sr-only"}`}
                >
                  {label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/8 p-3">
          <div className={`flex items-center gap-2 ${expanded ? "" : "justify-center"}`}>
            <UserButton appearance={{ elements: { avatarBox: "h-9 w-9" } }} />
            {expanded && (
              <span className="truncate text-xs text-zinc-500">{user?.primaryEmailAddress?.emailAddress ?? user?.username ?? "Account"}</span>
            )}
          </div>
        </div>
      </aside>

      <nav className="fixed bottom-0 left-0 right-0 z-50 flex border-t border-white/8 bg-[#0a0a0f]/95 px-2 py-2 backdrop-blur md:hidden">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== `/leagues/${leagueId}` && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 rounded-lg py-1 text-[10px] font-semibold ${
                active ? "text-emerald-400" : "text-zinc-500"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="truncate max-w-[56px]">{label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
