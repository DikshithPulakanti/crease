"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
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
  stats: Record<string, number>;
  breakdown: Record<string, unknown>;
};

type StatCol = { key: string; label: string };

const GK_COLS: StatCol[] = [
  { key: "saves", label: "Saves" },
  { key: "saves_inside_box", label: "Saves (Inside Box)" },
  { key: "penalty_saves", label: "Penalty Saves" },
  { key: "clean_sheet", label: "Clean Sheet" },
  { key: "goals_conceded", label: "Goals Conceded" },
  { key: "high_claims", label: "High Claims" },
  { key: "sweeper_keeper_actions", label: "Sweeper Actions" },
  { key: "errors_leading_to_goal", label: "Errors" },
];

const DEF_COLS: StatCol[] = [
  { key: "tackles_won", label: "Tackles Won" },
  { key: "interceptions", label: "Interceptions" },
  { key: "clearances", label: "Clearances" },
  { key: "blocked_shots", label: "Blocks" },
  { key: "aerial_duels_won", label: "Aerial Duels" },
  { key: "ground_duels_won", label: "Ground Duels" },
  { key: "clean_sheet", label: "Clean Sheet" },
  { key: "goals_conceded", label: "Goals Conceded" },
  { key: "dribbled_past", label: "Dribbled Past" },
  { key: "errors_leading_to_goal", label: "Errors" },
  { key: "goals", label: "Goals" },
  { key: "assists", label: "Assists" },
];

const MID_COLS: StatCol[] = [
  { key: "goals", label: "Goals" },
  { key: "assists", label: "Assists" },
  { key: "key_passes", label: "Key Passes" },
  { key: "chances_created", label: "Chances Created" },
  { key: "dribbles", label: "Dribbles" },
  { key: "tackles_won", label: "Tackles Won" },
  { key: "interceptions", label: "Interceptions" },
  { key: "recoveries", label: "Recoveries" },
  { key: "possession_lost", label: "Possession Lost" },
  { key: "tackles_attacking_third", label: "Tackles (Att. Third)" },
];

const ATT_COLS: StatCol[] = [
  { key: "goals", label: "Goals" },
  { key: "assists", label: "Assists" },
  { key: "shots_on_target", label: "Shots on Target" },
  { key: "dribbles", label: "Dribbles" },
  { key: "big_chances_created", label: "Big Chances Created" },
  { key: "big_chances_missed", label: "Big Chances Missed" },
  { key: "xG", label: "xG" },
  { key: "shots_off_target", label: "Shots Off Target" },
  { key: "offsides", label: "Offsides" },
  { key: "tackles_attacking_third", label: "Tackles (Att. Third)" },
];

const COLS_BY_POS: Record<string, StatCol[]> = {
  GK: GK_COLS,
  DEF: DEF_COLS,
  MID: MID_COLS,
  ATT: ATT_COLS,
};

const BREAKDOWN_CATEGORIES: Record<string, string[]> = {
  ATTACKING: [
    "goals", "assists", "shots_on_target", "shots_off_target",
    "big_chances_created", "big_chances_missed", "xG",
    "chances_created", "key_passes", "dribbles",
  ],
  DEFENDING: [
    "tackles_won", "interceptions", "clearances", "blocked_shots",
    "aerial_duels_won", "ground_duels_won", "clean_sheet",
    "goals_conceded", "dribbled_past", "saves", "saves_inside_box",
    "penalty_saves", "high_claims", "sweeper_keeper_actions",
    "recoveries", "tackles_attacking_third",
  ],
  GENERAL: [
    "starting_xi", "winning_team", "captain", "minutes_played",
    "yellow_cards", "red_cards", "errors_leading_to_goal",
    "possession_lost", "offsides",
  ],
};

function statLabel(key: string): string {
  return key
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function formatStatVal(key: string, val: number | undefined): string {
  if (val === undefined || val === null) return "–";
  if (key === "clean_sheet") return val ? "✓" : "–";
  if (key === "xG") return val.toFixed(2);
  return String(val);
}

export function PlayerProfileModal({
  leagueId,
  playerId,
  owningTeamName,
  ownerTeamId,
  myTeamId,
  currentWeek,
  onClose,
}: {
  leagueId: string;
  playerId: string | null;
  owningTeamName?: string | null;
  ownerTeamId?: string | null;
  myTeamId?: string | null;
  currentWeek?: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"log" | "history">("log");
  const [loading, setLoading] = useState(false);
  const [player, setPlayer] = useState<PlayerInfo | null>(null);
  const [rows, setRows] = useState<GamelogRow[]>([]);
  const [breakdownGw, setBreakdownGw] = useState<GamelogRow | null>(null);

  useEffect(() => {
    if (!playerId) return;
    setTab("log");
    setBreakdownGw(null);
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

  const posCols = useMemo(
    () => COLS_BY_POS[player?.position ?? ""] ?? MID_COLS,
    [player?.position]
  );

  const seasonAgg = useMemo(() => {
    const agg: Record<string, number> = {};
    let totalPts = 0;
    for (const r of rows) {
      totalPts += r.total_points;
      for (const col of posCols) {
        const v = r.stats?.[col.key];
        if (typeof v === "number") {
          agg[col.key] = (agg[col.key] ?? 0) + v;
        }
      }
    }
    return { totalPts, agg };
  }, [rows, posCols]);

  if (!playerId) return null;

  const parts = (player?.name ?? "?").split(" ");
  const first = parts[0] ?? "";
  const last = parts.slice(1).join(" ") || " ";

  const isMine = !!(myTeamId && ownerTeamId && ownerTeamId === myTeamId);
  const isOther = !!(ownerTeamId && ownerTeamId !== myTeamId);
  const isFreeAgent = !ownerTeamId;
  const weekLabel = currentWeek ?? 1;

  function handleAction() {
    if (isOther) {
      onClose();
      router.push(
        `/leagues/${leagueId}/trades?player=${playerId}&team=${ownerTeamId}`
      );
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0f] shadow-2xl">
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
              onClick={() => { setTab("log"); setBreakdownGw(null); }}
              className={`border-b-2 py-3 text-sm font-semibold ${
                tab === "log" ? "border-emerald-500 text-white" : "border-transparent text-zinc-500"
              }`}
            >
              Game Log
            </button>
            <button
              type="button"
              onClick={() => { setTab("history"); setBreakdownGw(null); }}
              className={`border-b-2 py-3 text-sm font-semibold ${
                tab === "history" ? "border-emerald-500 text-white" : "border-transparent text-zinc-500"
              }`}
            >
              History
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {loading && <p className="text-sm text-zinc-500">Loading…</p>}

          {!loading && tab === "log" && !breakdownGw && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/8 text-xs uppercase tracking-wide text-zinc-500">
                    <th className="whitespace-nowrap pb-2 pr-2">Week</th>
                    <th className="whitespace-nowrap pb-2 pr-2">Opponent</th>
                    <th className="whitespace-nowrap pb-2 pr-2 text-violet-300">Points</th>
                    {posCols.map((c) => (
                      <th key={c.key} className="whitespace-nowrap pb-2 pr-2 text-center">
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const opp = r.stats?.opponent as unknown as string | undefined;
                    return (
                      <tr key={r.gameweek_id} className="border-b border-white/5">
                        <td className="whitespace-nowrap py-2 pr-2 font-medium text-white">{r.number}</td>
                        <td className="whitespace-nowrap py-2 pr-2 text-zinc-400">{opp || r.label}</td>
                        <td className="whitespace-nowrap py-2 pr-2">
                          <button
                            type="button"
                            onClick={() => setBreakdownGw(r)}
                            className="font-semibold text-violet-400 hover:text-violet-300 hover:underline"
                          >
                            {r.total_points.toFixed(1)}
                          </button>
                        </td>
                        {posCols.map((c) => (
                          <td key={c.key} className="whitespace-nowrap py-2 pr-2 text-center text-zinc-400">
                            {formatStatVal(c.key, r.stats?.[c.key])}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {rows.length === 0 && (
                <p className="py-6 text-center text-sm text-zinc-500">No game log yet.</p>
              )}
            </div>
          )}

          {!loading && tab === "log" && breakdownGw && (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setBreakdownGw(null)}
                  className="text-xs font-semibold text-zinc-400 hover:text-white"
                >
                  ← Back to Game Log
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
              <CategoryBreakdown stats={breakdownGw.breakdown} />
            </div>
          )}

          {!loading && tab === "history" && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/8 text-xs uppercase tracking-wide text-zinc-500">
                    <th className="whitespace-nowrap pb-2 pr-2">Season</th>
                    <th className="whitespace-nowrap pb-2 pr-2 text-violet-300">Points</th>
                    {posCols.map((c) => (
                      <th key={c.key} className="whitespace-nowrap pb-2 pr-2 text-center">
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-white/5">
                    <td className="whitespace-nowrap py-2 pr-2 font-medium text-white">2025/26</td>
                    <td className="whitespace-nowrap py-2 pr-2 font-semibold text-violet-400">
                      {seasonAgg.totalPts.toFixed(1)}
                    </td>
                    {posCols.map((c) => (
                      <td key={c.key} className="whitespace-nowrap py-2 pr-2 text-center text-zinc-400">
                        {formatStatVal(c.key, seasonAgg.agg[c.key])}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
              {rows.length === 0 && (
                <p className="py-6 text-center text-sm text-zinc-500">No data yet this season.</p>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-white/8 p-4">
          {isOther && (
            <button
              type="button"
              onClick={handleAction}
              className="w-full rounded-xl bg-violet-600 py-3 text-sm font-bold uppercase tracking-wide text-white hover:bg-violet-500"
            >
              Trade for Week {weekLabel}
            </button>
          )}
          {isMine && (
            <button
              type="button"
              className="w-full rounded-xl bg-red-600 py-3 text-sm font-bold uppercase tracking-wide text-white hover:bg-red-500"
            >
              Drop from Week {weekLabel}
            </button>
          )}
          {isFreeAgent && (
            <button
              type="button"
              className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold uppercase tracking-wide text-white hover:bg-emerald-500"
            >
              Add to Squad
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function CategoryBreakdown({ stats }: { stats: Record<string, unknown> }) {
  if (!stats || typeof stats !== "object") {
    return <p className="text-sm text-zinc-500">No breakdown stored for this week.</p>;
  }

  const allEntries = Object.entries(stats).filter(([k]) => k !== "total" && k !== "opponent");

  const categorized = new Map<string, [string, unknown][]>();
  const used = new Set<string>();

  for (const [cat, keys] of Object.entries(BREAKDOWN_CATEGORIES)) {
    const items: [string, unknown][] = [];
    for (const key of keys) {
      if (key in stats && stats[key] !== 0 && stats[key] !== null && stats[key] !== undefined) {
        items.push([key, stats[key]]);
        used.add(key);
      }
    }
    if (items.length > 0) categorized.set(cat, items);
  }

  const uncategorized = allEntries.filter(([k]) => !used.has(k));
  if (uncategorized.length > 0) {
    categorized.set("OTHER", uncategorized);
  }

  if (categorized.size === 0) {
    return <p className="text-sm text-zinc-500">No stat lines.</p>;
  }

  const catColors: Record<string, string> = {
    ATTACKING: "border-violet-500/40 bg-violet-500/5",
    DEFENDING: "border-sky-500/40 bg-sky-500/5",
    GENERAL: "border-emerald-500/40 bg-emerald-500/5",
    OTHER: "border-zinc-500/40 bg-zinc-500/5",
  };
  const catLabelColors: Record<string, string> = {
    ATTACKING: "text-violet-400",
    DEFENDING: "text-sky-400",
    GENERAL: "text-emerald-400",
    OTHER: "text-zinc-400",
  };

  return (
    <div className="space-y-3">
      {Array.from(categorized.entries()).map(([cat, items]) => (
        <div
          key={cat}
          className={`rounded-xl border p-3 ${catColors[cat] ?? catColors.OTHER}`}
        >
          <p className={`mb-2 text-xs font-bold uppercase tracking-wide ${catLabelColors[cat] ?? catLabelColors.OTHER}`}>
            {cat}
          </p>
          <div className="space-y-1">
            {items.map(([k, v]) => (
              <div key={k} className="flex items-center justify-between text-sm">
                <span className="text-zinc-300">
                  {statLabel(k)}
                  {typeof v === "number" && v !== 0 && (
                    <span className="ml-1 text-zinc-500">({Math.abs(v)})</span>
                  )}
                </span>
                <span className={`font-semibold ${
                  typeof v === "number" && v > 0
                    ? "text-emerald-400"
                    : typeof v === "number" && v < 0
                      ? "text-red-400"
                      : "text-zinc-400"
                }`}>
                  {typeof v === "number" ? (v >= 0 ? `+${v}` : String(v)) : String(v)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
