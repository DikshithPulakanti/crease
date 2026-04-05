"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { apiUrl } from "@/lib/api";
import { PlayerProfileModal } from "@/app/components/PlayerProfileModal";

type PoolPlayer = {
  rank: number;
  id: string;
  name: string;
  position: string;
  club: string;
  photo_url: string | null;
  owner_team_id: string | null;
  owner_team_name: string | null;
  points_season: number;
  stats: {
    goals: number;
    assists: number;
    clean_sheets: number;
    saves: number;
    yellows: number;
    reds: number;
  };
};

type GameweekOption = {
  id: string;
  number: number;
  label: string;
};

const BAR = [
  "bg-emerald-500",
  "bg-violet-500",
  "bg-amber-500",
  "bg-sky-500",
  "bg-rose-500",
  "bg-cyan-500",
];

export default function PlayerPoolPage() {
  const params = useParams();
  const leagueId = params.leagueId as string;
  const { user } = useUser();

  const [rows, setRows] = useState<PoolPlayer[]>([]);
  const [teams, setTeams] = useState<{ id: string; name: string; user_id: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [pos, setPos] = useState<string>("ALL");
  const [q, setQ] = useState("");
  const [freeOnly, setFreeOnly] = useState(false);
  const [domIntl, setDomIntl] = useState<"ALL" | "DOM" | "INTL">("ALL");
  const [advOpen, setAdvOpen] = useState(false);
  const [mateFilter, setMateFilter] = useState<Record<string, boolean>>({});
  const [clubFilter, setClubFilter] = useState<Record<string, boolean>>({});
  const [modalId, setModalId] = useState<string | null>(null);
  const [gameweeks, setGameweeks] = useState<GameweekOption[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<number>(1);

  const myTeamId = useMemo(
    () => teams.find((t) => t.user_id === user?.id)?.id,
    [teams, user?.id]
  );

  useEffect(() => {
    let c = false;
    (async () => {
      try {
        const gwRes = await fetch(apiUrl(`/leagues/${leagueId}/gameweeks`));
        const gwData: GameweekOption[] = gwRes.ok ? await gwRes.json() : [];
        if (!c) {
          if (gwData.length > 0) {
            setGameweeks(gwData);
          } else {
            setGameweeks(
              Array.from({ length: 5 }, (_, i) => ({
                id: `fallback-${i + 1}`,
                number: i + 1,
                label: `Week ${i + 1}`,
              }))
            );
          }
        }

        const [pr, hub] = await Promise.all([
          fetch(apiUrl(`/leagues/${leagueId}/players?gameweek=${selectedWeek}`)),
          fetch(apiUrl(`/leagues/${leagueId}/hub`)),
        ]);
        if (!pr.ok) throw new Error("Failed to load players");
        const pool = await pr.json();
        const h = hub.ok ? await hub.json() : { teams: [] };
        if (!c) {
          setRows(pool);
          setTeams(h.teams ?? []);
        }
      } catch (e) {
        if (!c) setErr(e instanceof Error ? e.message : "Error");
      } finally {
        if (!c) setLoading(false);
      }
    })();
    return () => {
      c = true;
    };
  }, [leagueId]);

  const fetchPlayers = useCallback(async (week: number, free: boolean) => {
    try {
      const params = new URLSearchParams({ gameweek: String(week) });
      if (free) params.set("free_agents_only", "true");
      const res = await fetch(apiUrl(`/leagues/${leagueId}/players?${params}`));
      if (!res.ok) throw new Error("Failed to load players");
      setRows(await res.json());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    }
  }, [leagueId]);

  const handleWeekChange = (week: number) => {
    setSelectedWeek(week);
    fetchPlayers(week, freeOnly);
  };

  const handleFreeOnlyChange = (checked: boolean) => {
    setFreeOnly(checked);
    fetchPlayers(selectedWeek, checked);
  };

  const clubs = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => s.add(r.club));
    return Array.from(s).sort();
  }, [rows]);

  const leaguemates = useMemo(() => teams.filter((t) => t.id !== myTeamId), [teams, myTeamId]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (pos !== "ALL" && r.position !== pos) return false;
      const qq = q.trim().toLowerCase();
      if (qq && !r.name.toLowerCase().includes(qq) && !r.club.toLowerCase().includes(qq))
        return false;
      if (freeOnly && r.owner_team_id) return false;
      if (domIntl === "DOM" && r.club && !isDomestic(r.club)) return false;
      if (domIntl === "INTL" && r.club && isDomestic(r.club)) return false;
      const activeMates = Object.entries(mateFilter).filter(([, v]) => v).map(([k]) => k);
      if (activeMates.length && r.owner_team_id && !activeMates.includes(r.owner_team_id))
        return false;
      const activeClubs = Object.entries(clubFilter).filter(([, v]) => v).map(([k]) => k);
      if (activeClubs.length && !activeClubs.includes(r.club)) return false;
      return true;
    });
  }, [rows, pos, q, freeOnly, domIntl, mateFilter, clubFilter]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-8">
        <p className="text-sm text-zinc-500">Loading player pool…</p>
      </div>
    );
  }

  if (err) {
    return (
      <div className="p-8">
        <p className="text-red-400">{err}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 md:pb-8">
      <header className="border-b border-white/8 px-4 py-6 md:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Player Pool</h1>
            <p className="text-sm text-zinc-500">{rows.length} players</p>
          </div>
          <div className="flex flex-1 flex-wrap items-center justify-end gap-2 md:max-w-md">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Find player"
              className="min-w-[160px] flex-1 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-zinc-600"
            />
            <button
              type="button"
              onClick={() => setAdvOpen(true)}
              className="rounded-xl border border-white/8 p-2 text-zinc-400 hover:bg-white/5 hover:text-white"
              aria-label="Advanced filters"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {["ALL", "GK", "DEF", "MID", "ATT"].map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPos(p)}
              className={`rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wide ${
                pos === p
                  ? "bg-violet-600 text-white"
                  : "border border-white/8 bg-white/[0.03] text-zinc-400 hover:border-white/20"
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          <select className="rounded-xl border border-white/8 bg-black/40 px-3 py-2 font-semibold text-white">
            <option>Champions League 2025/26</option>
          </select>
          <select
            value={selectedWeek}
            onChange={(e) => handleWeekChange(Number(e.target.value))}
            className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 font-semibold text-emerald-300"
          >
            {gameweeks.map((gw) => (
              <option key={gw.id} value={gw.number}>
                {gw.label}
              </option>
            ))}
          </select>
          <label className="flex cursor-pointer items-center gap-2 text-zinc-400">
            <input
              type="checkbox"
              checked={freeOnly}
              onChange={(e) => handleFreeOnlyChange(e.target.checked)}
              className="rounded border-white/20 bg-black/40"
            />
            Free agents only
          </label>
          <div className="flex rounded-xl border border-white/8 p-0.5">
            {(["ALL", "DOM", "INTL"] as const).map((x) => (
              <button
                key={x}
                type="button"
                onClick={() => setDomIntl(x)}
                className={`rounded-lg px-3 py-1 text-xs font-bold ${
                  domIntl === x ? "bg-emerald-500/20 text-emerald-300" : "text-zinc-500"
                }`}
              >
                {x}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="overflow-x-auto px-2 md:px-6">
        <table className="w-full min-w-[900px] border-separate border-spacing-y-1 text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-zinc-500">
              <th className="px-2 py-2"> </th>
              <th className="px-2 py-2">#</th>
              <th className="px-2 py-2">Player</th>
              <th className="px-2 py-2 text-right text-violet-300">PTS</th>
              <th className="px-2 py-2 text-center">G</th>
              <th className="px-2 py-2 text-center">A</th>
              <th className="px-2 py-2 text-center">CS</th>
              <th className="px-2 py-2 text-center">Sv</th>
              <th className="px-2 py-2 text-center">Y</th>
              <th className="px-2 py-2 text-center">R</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => {
              const ownedByOther = r.owner_team_id && r.owner_team_id !== myTeamId;
              const bar =
                BAR[
                  (teams.findIndex((t) => t.id === r.owner_team_id) + 1 || i) % BAR.length
                ];
              return (
                <tr key={r.id} className="rounded-2xl">
                  <td className="rounded-l-2xl border-y border-l border-white/8 bg-white/[0.03] px-0">
                    <div className="flex h-full items-stretch">
                      <span className={`w-1 rounded-l-2xl ${r.owner_team_id ? bar : "bg-zinc-700"}`} />
                      <button
                        type="button"
                        className="flex flex-1 items-center justify-center px-2 text-emerald-400 hover:text-emerald-300"
                        title={ownedByOther ? "Propose trade" : "Add"}
                      >
                        {ownedByOther ? "⇄" : "+"}
                      </button>
                    </div>
                  </td>
                  <td className="border-y border-white/8 bg-white/[0.03] px-2 font-mono text-xs text-zinc-500">
                    {r.rank}
                  </td>
                  <td
                    className="max-w-[320px] cursor-pointer border-y border-white/8 bg-white/[0.03] px-2 py-2 hover:bg-white/[0.06]"
                    onClick={() => setModalId(r.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-zinc-800">
                        {r.photo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={r.photo_url} alt="" className="h-full w-full object-cover" />
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-white">{r.name}</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-bold text-zinc-300">
                            {r.position}
                          </span>
                          <span className="rounded bg-violet-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-violet-300">
                            {r.club}
                          </span>
                          {r.owner_team_name && (
                            <span className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-zinc-500">
                              {r.owner_team_name}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="border-y border-white/8 bg-white/[0.03] px-2 text-right font-bold text-violet-400">
                    {r.points_season.toFixed(1)}
                  </td>
                  <td className="border-y border-white/8 bg-white/[0.03] text-center text-zinc-400">
                    {r.stats.goals}
                  </td>
                  <td className="border-y border-white/8 bg-white/[0.03] text-center text-zinc-400">
                    {r.stats.assists}
                  </td>
                  <td className="border-y border-white/8 bg-white/[0.03] text-center text-zinc-400">
                    {r.stats.clean_sheets}
                  </td>
                  <td className="border-y border-white/8 bg-white/[0.03] text-center text-zinc-400">
                    {r.stats.saves}
                  </td>
                  <td className="border-y border-white/8 bg-white/[0.03] text-center text-zinc-400">
                    {r.stats.yellows}
                  </td>
                  <td className="rounded-r-2xl border-y border-r border-white/8 bg-white/[0.03] text-center text-zinc-400">
                    {r.stats.reds}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {advOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
          <div className="h-full w-full max-w-md border-l border-white/8 bg-[#0a0a0f] p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wide text-white">Filtered by</h2>
              <button
                type="button"
                onClick={() => {
                  setMateFilter({});
                  setClubFilter({});
                }}
                className="text-xs font-bold text-violet-400 hover:underline"
              >
                Clear
              </button>
            </div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Leaguemate</p>
            <ul className="mb-6 max-h-40 space-y-2 overflow-y-auto">
              {leaguemates.map((t) => (
                <li key={t.id}>
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
                    <input
                      type="checkbox"
                      checked={!!mateFilter[t.id]}
                      onChange={(e) =>
                        setMateFilter((m) => ({ ...m, [t.id]: e.target.checked }))
                      }
                    />
                    {t.name}
                  </label>
                </li>
              ))}
            </ul>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Clubs</p>
            <div className="flex flex-wrap gap-2">
              {clubs.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() =>
                    setClubFilter((cf) => ({ ...cf, [c]: !cf[c] }))
                  }
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                    clubFilter[c]
                      ? "border-violet-500 bg-violet-500/20 text-violet-200"
                      : "border-white/10 bg-white/[0.03] text-zinc-400"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setAdvOpen(false)}
              className="mt-8 w-full rounded-2xl border border-white/8 py-3 text-sm font-bold text-white hover:bg-white/5"
            >
              Done
            </button>
          </div>
        </div>
      )}

      <PlayerProfileModal
        leagueId={leagueId}
        playerId={modalId}
        owningTeamName={
          modalId ? rows.find((x) => x.id === modalId)?.owner_team_name ?? null : null
        }
        onClose={() => setModalId(null)}
      />
    </div>
  );
}

function isDomestic(club: string): boolean {
  const english = ["Arsenal", "Liverpool", "Chelsea", "City", "United", "Tottenham"];
  return english.some((e) => club.includes(e));
}
