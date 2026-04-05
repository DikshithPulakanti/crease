"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { UserButton, useUser } from "@clerk/nextjs";
import Link from "next/link";
import { apiUrl } from "@/lib/api";

type HubTeam = {
  id: string;
  name: string;
  user_id: string;
  draft_position: number | null;
  standings_points?: number;
};

type Gameweek = {
  id: string;
  number: number;
  label: string;
  starts_at: string | null;
  locks_at: string | null;
  ends_at: string | null;
};

type StandRow = {
  rank: number;
  team_id: string;
  name: string;
  user_id: string;
  wins: number;
  losses: number;
  fantasy_points_season: number;
};

const ACCENT_BAR = [
  "bg-emerald-500",
  "bg-violet-500",
  "bg-amber-500",
  "bg-sky-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-fuchsia-500",
  "bg-lime-500",
];

export default function LeagueHubPage() {
  const params = useParams();
  const leagueId = params.leagueId as string;
  const { user } = useUser();

  const [name, setName] = useState<string>("");
  const [teams, setTeams] = useState<HubTeam[]>([]);
  const [status, setStatus] = useState<string>("");
  const [gameweeks, setGameweeks] = useState<Gameweek[]>([]);
  const [gwNum, setGwNum] = useState(1);
  const [matchups, setMatchups] = useState<
    { id: string; home_team_id: string; away_team_id: string; home_score: number; away_score: number }[]
  >([]);
  const [standings, setStandings] = useState<StandRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const myTeam = useMemo(
    () => teams.find((t) => t.user_id === user?.id),
    [teams, user?.id]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [hubRes, gwRes, stRes] = await Promise.all([
          fetch(apiUrl(`/leagues/${leagueId}/hub`)),
          fetch(apiUrl(`/leagues/${leagueId}/gameweeks`)),
          fetch(apiUrl(`/leagues/${leagueId}/standings`)),
        ]);
        if (!hubRes.ok) throw new Error("League not found");
        const hub = await hubRes.json();
        const gws = gwRes.ok ? await gwRes.json() : [];
        const st = stRes.ok ? await stRes.json() : [];
        if (cancelled) return;
        setName(hub.name);
        setTeams(hub.teams ?? []);
        setStatus(hub.status ?? "");
        setGameweeks(gws);
        setStandings(st);
        if (gws?.length) setGwNum(gws[0].number);
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(apiUrl(`/leagues/${leagueId}/matchups?gameweek=${gwNum}`));
      if (!res.ok || cancelled) return;
      const data = await res.json();
      if (cancelled) return;
      setMatchups(data.matchups ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [leagueId, gwNum]);

  const weekLabel = useMemo(() => {
    const g = gameweeks.find((x) => x.number === gwNum);
    if (!g) return `Week ${gwNum}`;
    const start = g.starts_at ? new Date(g.starts_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "";
    const end = g.ends_at ? new Date(g.ends_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "";
    const range = start && end ? `${start} – ${end}` : "";
    return `Week ${gwNum} of ${gameweeks.length || 5}${range ? ` · ${range}` : ""}`;
  }, [gameweeks, gwNum]);

  const teamById = useMemo(() => {
    const m: Record<string, HubTeam> = {};
    teams.forEach((t) => {
      m[t.id] = t;
    });
    return m;
  }, [teams]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-8">
        <p className="text-sm text-zinc-500">Loading league…</p>
      </div>
    );
  }

  if (err) {
    return (
      <div className="p-8">
        <p className="text-sm text-red-400">{err}</p>
        <Link href="/dashboard" className="mt-4 inline-block text-emerald-400 hover:underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 md:pb-8">
      <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-4 border-b border-white/8 bg-[#0a0a0f]/90 px-4 py-4 backdrop-blur md:px-8">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white md:text-2xl">{name}</h1>
          <p className="mt-0.5 text-sm text-zinc-500">{weekLabel}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="rounded-xl border border-white/8 p-2 text-zinc-400 hover:bg-white/5 hover:text-white"
            aria-label="Notifications"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
            </svg>
          </button>
          <button
            type="button"
            className="rounded-xl border border-white/8 p-2 text-zinc-400 hover:bg-white/5 hover:text-white"
            aria-label="Chat"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </button>
          <div className="flex items-center gap-2 rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-1.5">
            <UserButton appearance={{ elements: { avatarBox: "h-8 w-8" } }} />
            <span className="hidden max-w-[140px] truncate text-sm font-semibold text-white sm:inline">
              {myTeam?.name ?? "Team"}
            </span>
          </div>
        </div>
      </header>

      <main className="space-y-8 px-4 py-6 md:px-8">
        {/* Recent match — placeholder until live API */}
        <section className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-emerald-400">
              Completed
            </span>
            <button type="button" className="text-xs font-semibold text-violet-400 hover:underline">
              View Stats
            </button>
          </div>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-lg font-bold text-white">Real Madrid</p>
              <p className="text-2xl font-black tabular-nums text-white">3 — 1</p>
              <p className="text-lg font-bold text-white">Manchester City</p>
            </div>
            <p className="text-sm text-zinc-400">Real Madrid won by 2 goals</p>
          </div>
          <button
            type="button"
            className="mt-5 flex w-full cursor-default items-center justify-center rounded-2xl border border-violet-500/40 py-3 text-sm font-bold text-violet-300"
          >
            View tournament schedule
          </button>
        </section>

        {/* Matchups */}
        <section>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold tracking-tight text-white">Matchups</h2>
            <select
              value={gwNum}
              onChange={(e) => setGwNum(Number(e.target.value))}
              className="rounded-xl border border-white/8 bg-black/40 px-3 py-2 text-sm font-semibold text-white"
            >
              {(gameweeks.length ? gameweeks : [{ number: 1, id: "x", label: "Week 1" }]).map((g) => (
                <option key={g.number} value={g.number}>
                  Week {g.number}
                </option>
              ))}
            </select>
          </div>
          {matchups.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-zinc-500">
              No matchups for this week yet. Create gameweeks from the API when the league is active.
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {matchups.map((m) => {
                const home = teamById[m.home_team_id];
                const away = teamById[m.away_team_id];
                const hi = teams.findIndex((t) => t.id === m.home_team_id);
                const ai = teams.findIndex((t) => t.id === m.away_team_id);
                return (
                  <div
                    key={m.id}
                    className="rounded-2xl border border-white/8 bg-white/[0.03] p-4"
                  >
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                      <TeamSide team={home} barClass={ACCENT_BAR[hi % ACCENT_BAR.length]} pts={m.home_score} />
                      <span className="text-xs font-black uppercase tracking-widest text-zinc-500">
                        vs
                      </span>
                      <TeamSide team={away} barClass={ACCENT_BAR[ai % ACCENT_BAR.length]} pts={m.away_score} right />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Standings */}
        <section className="rounded-2xl border border-white/8 bg-white/[0.03] overflow-hidden">
          <div className="border-b border-white/8 px-5 py-4">
            <h2 className="text-lg font-bold tracking-tight text-white">Standings</h2>
            <p className="text-xs text-zinc-500">Sorted by wins, then season fantasy points.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/8 text-xs uppercase tracking-wide text-zinc-500">
                  <th className="px-5 py-3">Rank</th>
                  <th className="px-5 py-3">Team</th>
                  <th className="px-5 py-3 text-right">Points</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((row) => (
                  <tr key={row.team_id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="px-5 py-4 font-bold tabular-nums text-white">{row.rank}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span
                          className={`h-10 w-1 rounded-full ${ACCENT_BAR[row.rank % ACCENT_BAR.length]}`}
                        />
                        <div>
                          <p className="font-semibold text-white">{row.name}</p>
                          <p className="text-xs text-zinc-500">
                            @{row.user_id.slice(0, 8)}… ·{" "}
                            <span className="text-emerald-400">{row.wins}-{row.losses}</span>
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right text-lg font-bold tabular-nums text-emerald-400">
                      {row.fantasy_points_season.toLocaleString(undefined, {
                        minimumFractionDigits: 1,
                        maximumFractionDigits: 1,
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {standings.length === 0 && (
              <p className="p-8 text-center text-sm text-zinc-500">Standings populate after matchups are scored.</p>
            )}
          </div>
        </section>

        <Link
          href={`/leagues/${leagueId}/rules`}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/8 bg-white/[0.03] py-4 text-sm font-bold uppercase tracking-wide text-zinc-300 hover:border-white/20"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
          </svg>
          League rules & scoring
        </Link>

        {status === "setup" && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-200">
            League is in setup. Invite managers, then start the draft from the commissioner flow.
          </div>
        )}
      </main>

    </div>
  );
}

function TeamSide({
  team,
  barClass,
  pts,
  right,
}: {
  team?: HubTeam;
  barClass: string;
  pts: number;
  right?: boolean;
}) {
  return (
    <div className={`flex items-center gap-3 ${right ? "flex-row-reverse text-right" : ""}`}>
      <div className="flex h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black/40">
        <span className={`w-1.5 shrink-0 ${barClass}`} />
        <span className="flex-1" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold uppercase tracking-wide text-zinc-500">Rec</p>
        <p className="truncate font-bold text-white">{team?.name ?? "Team"}</p>
        <p className="text-lg font-black tabular-nums text-white">
          {pts.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
          <span className="text-xs font-semibold text-zinc-500">PTS</span>
        </p>
      </div>
    </div>
  );
}
