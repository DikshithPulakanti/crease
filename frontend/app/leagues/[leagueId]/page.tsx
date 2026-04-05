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
  owner_username?: string;
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

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [activityCount, setActivityCount] = useState(0);

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
        const [hubRes, gwRes, stRes, actRes] = await Promise.all([
          fetch(apiUrl(`/leagues/${leagueId}/hub`)),
          fetch(apiUrl(`/leagues/${leagueId}/gameweeks`)),
          fetch(apiUrl(`/leagues/${leagueId}/standings`)),
          fetch(apiUrl(`/leagues/${leagueId}/activity`)),
        ]);
        if (!hubRes.ok) throw new Error("League not found");
        const hub = await hubRes.json();
        const gws = gwRes.ok ? await gwRes.json() : [];
        const st = stRes.ok ? await stRes.json() : [];
        let actLen = 0;
        if (actRes.ok) {
          const act = await actRes.json();
          actLen = Array.isArray(act) ? act.length : 0;
        }
        if (cancelled) return;
        setName(hub.name);
        setTeams(hub.teams ?? []);
        setStatus(hub.status ?? "");
        setGameweeks(gws);
        setStandings(st);
        setActivityCount(actLen);
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
    const start = g.starts_at
      ? new Date(g.starts_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })
      : "";
    const end = g.ends_at
      ? new Date(g.ends_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })
      : "";
    const range = start && end ? `${start} – ${end}` : "";
    return `Week ${gwNum} of ${gameweeks.length || 5}${range ? ` · ${range}` : ""}`;
  }, [gameweeks, gwNum]);

  const weekOptions = useMemo(() => {
    if (gameweeks.length > 0) {
      return gameweeks.map((g) => ({ value: g.number, label: `Week ${g.number}` }));
    }
    return [1, 2, 3, 4, 5].map((n) => ({ value: n, label: `Week ${n}` }));
  }, [gameweeks]);

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
            onClick={() => setNotificationsEnabled((v) => !v)}
            className="relative rounded-xl border border-white/8 p-2 text-zinc-400 hover:bg-white/5 hover:text-white"
            aria-label={notificationsEnabled ? "Disable notifications" : "Enable notifications"}
            aria-pressed={notificationsEnabled}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.75}
                d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
              />
            </svg>
            {!notificationsEnabled && (
              <span
                className="pointer-events-none absolute inset-0 flex items-center justify-center"
                aria-hidden
              >
                <svg className="h-6 w-6 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeWidth={2.5} d="M4 4l16 16" />
                </svg>
              </span>
            )}
            {notificationsEnabled && activityCount > 0 && (
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-[#0a0a0f]" />
            )}
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
        <section className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-emerald-400">
              Completed
            </span>
          </div>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-lg font-bold text-white">Real Madrid</p>
              <p className="text-2xl font-black tabular-nums text-white">3 — 1</p>
              <p className="text-lg font-bold text-white">Manchester City</p>
            </div>
            <p className="text-sm text-zinc-400">Real Madrid won by 2 goals</p>
          </div>
          <a
            href="https://www.uefa.com/uefachampionsleague/matches/"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 py-3 text-center text-sm text-gray-400 transition hover:border-white/20 hover:text-white"
          >
            🏆 View Tournament Schedule
          </a>
        </section>

        <section>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold tracking-tight text-white">Matchups</h2>
            <select
              value={gwNum}
              onChange={(e) => setGwNum(Number(e.target.value))}
              className="rounded-xl border border-white/8 bg-black/40 px-3 py-2 text-sm font-semibold text-white"
            >
              {weekOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
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

        <section className="overflow-hidden rounded-2xl border border-white/8 bg-white/[0.03]">
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
                {standings.map((row) => {
                  const handle = row.owner_username ?? row.user_id;
                  return (
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
                              @{handle} ·{" "}
                              <span className="text-emerald-400">
                                {row.wins}-{row.losses}
                              </span>
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
                  );
                })}
              </tbody>
            </table>
            {standings.length === 0 && (
              <p className="p-8 text-center text-sm text-zinc-500">
                Standings populate after matchups are scored.
              </p>
            )}
          </div>
        </section>

        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
          <p className="text-sm leading-relaxed text-zinc-300">
            Points for goals, assists, clean sheets, saves and more. Captain gets 2×, Vice-Captain 1.5×.
          </p>
          <Link
            href={`/leagues/${leagueId}/rules`}
            className="mt-3 inline-block text-sm font-semibold text-emerald-400 hover:text-emerald-300 hover:underline"
          >
            View Full Rules →
          </Link>
        </div>

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
