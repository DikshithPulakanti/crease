"use client";

import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/api";

type ActivityRow = {
  id: string;
  type: string;
  actor_team_id: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
};

export function ActivityLogPanel({
  leagueId,
  teamNameById,
}: {
  leagueId: string;
  teamNameById?: Record<string, string>;
}) {
  const [open, setOpen] = useState(true);
  const [items, setItems] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(apiUrl(`/leagues/${leagueId}/activity`));
        if (!res.ok) throw new Error("Failed to load activity");
        const data = (await res.json()) as ActivityRow[];
        if (!cancelled) setItems(data);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [leagueId]);

  const name = (id: string | null | undefined) =>
    (id && teamNameById?.[id]) ?? "Team";

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden shrink-0 border-l border-white/8 bg-black/20 px-2 py-3 text-zinc-500 hover:text-white lg:flex lg:flex-col lg:items-center"
        aria-label="Open activity log"
      >
        <span className="text-[10px] font-bold uppercase tracking-widest [writing-mode:vertical-rl] rotate-180">
          Activity
        </span>
      </button>
    );
  }

  return (
    <aside className="hidden w-[min(100%,320px)] shrink-0 flex-col border-l border-white/8 bg-black/20 lg:flex">
      <div className="flex items-center justify-between border-b border-white/8 px-3 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold tracking-tight text-white">Activity Log</span>
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-semibold text-zinc-300">
            {items.length}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg p-1.5 text-zinc-500 hover:bg-white/5 hover:text-white"
          aria-label="Collapse activity log"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {loading && <p className="text-sm text-zinc-500">Loading…</p>}
        {err && <p className="text-sm text-red-400">{err}</p>}
        {!loading && !err && items.length === 0 && (
          <p className="text-sm text-zinc-500">No activity yet.</p>
        )}
        <ul className="space-y-3">
          {items.map((a) => (
            <li
              key={a.id}
              className="rounded-2xl border border-white/8 bg-white/[0.03] p-3 text-sm"
            >
              <ActivityCard
                a={a}
                teamName={name(a.actor_team_id)}
              />
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

function ActivityCard({
  a,
  teamName,
}: {
  a: ActivityRow;
  teamName: string;
}) {
  const rel = formatRelative(a.created_at);
  const abs = formatAbsolute(a.created_at);
  const p = a.payload ?? {};

  if (a.type === "trade_proposed" || a.type === "trade_accepted" || a.type === "trade_rejected") {
    return (
      <div>
        <div className="mb-2 flex items-start justify-between gap-2">
          <span className="font-semibold text-white">{teamName}</span>
          <span className="text-right text-xs text-zinc-500">
            {rel}
            <br />
            <span className="text-zinc-600">{abs}</span>
          </span>
        </div>
        <p className="text-xs uppercase tracking-wide text-violet-400">{a.type.replace(/_/g, " ")}</p>
        <p className="mt-1 text-xs text-zinc-400">
          Trade involving players — see Trades page for details.
        </p>
      </div>
    );
  }

  if (a.type === "free_agent_claim") {
    const inId = p.player_in_id as string | undefined;
    const outId = p.player_out_id as string | undefined;
    return (
      <div>
        <div className="mb-2 flex items-start justify-between gap-2">
          <span className="font-semibold text-white">{teamName}</span>
          <span className="text-right text-xs text-zinc-500">
            {rel}
            <br />
            <span className="text-zinc-600">{abs}</span>
          </span>
        </div>
        <div className="space-y-2">
          {inId && (
            <div className="flex items-center gap-2 text-emerald-400">
              <span className="text-xs font-bold">+ ADD</span>
              <span className="text-xs text-zinc-300">Player {inId.slice(0, 8)}…</span>
            </div>
          )}
          {outId && (
            <div className="flex items-center gap-2 text-red-400">
              <span className="text-xs font-bold">− DROP</span>
              <span className="text-xs text-zinc-300">Player {outId.slice(0, 8)}…</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-1 flex items-start justify-between gap-2">
        <span className="font-semibold text-white">{teamName}</span>
        <span className="text-xs text-zinc-500">{rel}</span>
      </div>
      <p className="text-xs text-zinc-400">{a.type}</p>
    </div>
  );
}

function formatRelative(iso: string): string {
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function formatAbsolute(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
