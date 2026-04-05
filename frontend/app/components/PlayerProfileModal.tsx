"use client";

import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/api";

type PlayerInfo = {
  id: string;
  name: string;
  position: string;
  club: string;
  photo_url: string | null;
};

type GamelogRow = {
  gameweek_id: string;
  number: number;
  label: string;
  total_points: number;
  breakdown: Record<string, unknown>;
};

export function PlayerProfileModal({
  leagueId,
  playerId,
  owningTeamName,
  onClose,
}: {
  leagueId: string;
  playerId: string | null;
  owningTeamName?: string | null;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"log" | "history">("log");
  const [loading, setLoading] = useState(false);
  const [player, setPlayer] = useState<PlayerInfo | null>(null);
  const [rows, setRows] = useState<GamelogRow[]>([]);
  const [breakdownGw, setBreakdownGw] = useState<GamelogRow | null>(null);

  useEffect(() => {
    if (!playerId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(
          apiUrl(`/players/${playerId}/gamelog?league_id=${encodeURIComponent(leagueId)}`)
        );
        if (!res.ok) throw new Error("load failed");
        const data = (await res.json()) as {
          player: PlayerInfo;
          rows: GamelogRow[];
        };
        if (!cancelled) {
          setPlayer(data.player);
          setRows(data.rows);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [playerId, leagueId]);

  if (!playerId) return null;

  const parts = (player?.name ?? "?").split(" ");
  const first = parts[0] ?? "";
  const last = parts.slice(1).join(" ") || " ";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="relative max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0f] shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-lg bg-black/40 p-2 text-zinc-400 hover:text-white"
          aria-label="Close"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="bg-gradient-to-br from-violet-900/80 to-slate-900/90 px-6 pb-6 pt-8">
          <div className="flex gap-4">
            <div className="h-28 w-28 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black/30">
              {player?.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={player.photo_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-3xl font-bold text-zinc-500">
                  {first[0]}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-300">
                {first} <span className="text-white">{last}</span>
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="rounded-full border border-white/10 bg-black/30 px-2 py-0.5 text-xs text-zinc-200">
                  {player?.club ?? "—"}
                </span>
                <span className="rounded-full border border-white/10 bg-black/30 px-2 py-0.5 text-xs text-zinc-200">
                  {player?.position ?? "—"}
                </span>
                {owningTeamName && (
                  <span className="rounded-full bg-violet-500/30 px-2 py-0.5 text-xs font-semibold text-violet-200">
                    {owningTeamName}
                  </span>
                )}
              </div>
              <div className="mt-3 flex gap-2 text-xs text-zinc-400">
                <span className="rounded border border-white/10 px-2 py-1">OVR RANK: N/A</span>
                <span className="rounded border border-white/10 px-2 py-1">POS RANK: N/A</span>
              </div>
            </div>
          </div>
        </div>

        <div className="border-b border-white/8 px-4">
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => setTab("log")}
              className={`border-b-2 py-3 text-sm font-semibold ${
                tab === "log" ? "border-emerald-500 text-white" : "border-transparent text-zinc-500"
              }`}
            >
              Game Log
            </button>
            <button
              type="button"
              onClick={() => setTab("history")}
              className={`border-b-2 py-3 text-sm font-semibold ${
                tab === "history" ? "border-emerald-500 text-white" : "border-transparent text-zinc-500"
              }`}
            >
              History
            </button>
          </div>
        </div>

        <div className="max-h-[50vh] overflow-y-auto p-4">
          {loading && <p className="text-sm text-zinc-500">Loading…</p>}
          {!loading && tab === "log" && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/8 text-xs uppercase tracking-wide text-zinc-500">
                    <th className="pb-2 pr-2">Week</th>
                    <th className="pb-2 pr-2">Label</th>
                    <th className="pb-2 pr-2">PTS</th>
                    <th className="pb-2"> </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.gameweek_id} className="border-b border-white/5">
                      <td className="py-2 pr-2 font-medium text-white">{r.number}</td>
                      <td className="py-2 pr-2 text-zinc-400">{r.label}</td>
                      <td className="py-2 pr-2 font-semibold text-violet-400">{r.total_points.toFixed(1)}</td>
                      <td className="py-2">
                        <button
                          type="button"
                          onClick={() => setBreakdownGw(r)}
                          className="text-xs font-semibold text-emerald-400 hover:underline"
                        >
                          Breakdown
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length === 0 && <p className="py-6 text-center text-sm text-zinc-500">No game log yet.</p>}
            </div>
          )}
          {!loading && tab === "history" && (
            <p className="py-6 text-center text-sm text-zinc-500">Trade & roster history coming soon.</p>
          )}
        </div>

        {breakdownGw && (
          <div className="border-t border-white/8 bg-black/40 p-4">
            <div className="mb-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setBreakdownGw(null)}
                className="text-xs font-semibold text-zinc-400 hover:text-white"
              >
                ← Back
              </button>
              <span className="text-xs font-bold uppercase tracking-wide text-white">
                Points — {breakdownGw.label}
              </span>
            </div>
            <div className="mb-4 flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Total fantasy points
              </span>
              <span className="text-2xl font-bold text-violet-400">
                {breakdownGw.total_points.toFixed(1)}
              </span>
            </div>
            <BreakdownCards stats={breakdownGw.breakdown} />
          </div>
        )}

        <div className="border-t border-white/8 p-4">
          <button
            type="button"
            className="w-full rounded-xl bg-red-600 py-3 text-sm font-bold uppercase tracking-wide text-white hover:bg-red-500"
          >
            Roster actions — use My Team
          </button>
        </div>
      </div>
    </div>
  );
}

function BreakdownCards({ stats }: { stats: Record<string, unknown> }) {
  if (!stats || typeof stats !== "object") {
    return <p className="text-sm text-zinc-500">No breakdown stored for this week.</p>;
  }
  const entries = Object.entries(stats).filter(([k]) => k !== "total");
  if (entries.length === 0) {
    return <p className="text-sm text-zinc-500">No stat lines.</p>;
  }
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {entries.slice(0, 12).map(([k, v]) => (
        <div
          key={k}
          className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2 text-sm"
        >
          <span className="text-zinc-400">{k}</span>
          <span className="float-right font-semibold text-emerald-400">
            {typeof v === "number" ? `+${v}` : String(v)}
          </span>
        </div>
      ))}
    </div>
  );
}
