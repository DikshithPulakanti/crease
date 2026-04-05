"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { apiUrl } from "@/lib/api";
import { PlayerProfileModal } from "@/app/components/PlayerProfileModal";

interface Player {
  id: string;
  name: string;
  position: string;
  club: string;
  photo_url: string | null;
}

interface RosterRow {
  player_id: string;
  player: Player;
  is_starting: boolean;
  is_captain: boolean;
  is_vice_captain: boolean;
  base_points: number;
  multiplier: number;
  fantasy_points: number;
  stats_breakdown: unknown;
}

type StandingsRow = {
  team_id: string;
  team_name: string;
  owner_username: string;
  wins: number;
  losses: number;
  draws: number;
  total_points: number;
};

const POS_ORDER = ["GK", "DEF", "MID", "ATT"];
const BAR: Record<string, string> = {
  GK: "bg-amber-500",
  DEF: "bg-sky-500",
  MID: "bg-emerald-500",
  ATT: "bg-rose-500",
};

function clubAbbr(club: string): string {
  if (!club?.trim()) return "—";
  const parts = club.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 3).toUpperCase();
  return parts
    .map((p) => p[0])
    .join("")
    .slice(0, 4)
    .toUpperCase();
}

function sortByPosition(a: RosterRow, b: RosterRow) {
  const pa = POS_ORDER.indexOf(a.player.position);
  const pb = POS_ORDER.indexOf(b.player.position);
  if (pa !== pb) return pa - pb;
  return a.player.name.localeCompare(b.player.name);
}

export default function TeamPage() {
  const params = useParams();
  const leagueId = params.leagueId as string;
  const { user } = useUser();

  const [startingIds, setStartingIds] = useState<Set<string>>(new Set());
  const [captain, setCaptain] = useState<string | null>(null);
  const [vice, setVice] = useState<string | null>(null);
  const [myTeamId, setMyTeamId] = useState<string | null>(null);
  const [teamName, setTeamName] = useState("");
  const [week, setWeek] = useState(1);
  const [gws, setGws] = useState<{ number: number; locks_at: string | null }[]>([]);
  const [modalId, setModalId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rosterPlayers, setRosterPlayers] = useState<RosterRow[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [standingsRow, setStandingsRow] = useState<StandingsRow | null>(null);
  const [saveToast, setSaveToast] = useState<string | null>(null);

  const applyRosterPayload = useCallback((rows: RosterRow[]) => {
    setRosterPlayers(rows);
    const starters = new Set(rows.filter((r) => r.is_starting).map((r) => r.player_id));
    setStartingIds(starters);
    setCaptain(rows.find((r) => r.is_captain)?.player_id ?? null);
    setVice(rows.find((r) => r.is_vice_captain)?.player_id ?? null);
  }, []);

  const refreshRoster = useCallback(async () => {
    if (!myTeamId) return;
    const res = await fetch(apiUrl(`/teams/${myTeamId}/roster?gameweek=${week}`));
    if (!res.ok) {
      applyRosterPayload([]);
      return;
    }
    const data = await res.json();
    const rows: RosterRow[] = Array.isArray(data.players) ? data.players : [];
    applyRosterPayload(rows);
  }, [myTeamId, week, applyRosterPayload]);

  useEffect(() => {
    if (!myTeamId) return;
    let cancelled = false;
    setRosterLoading(true);
    (async () => {
      try {
        const res = await fetch(apiUrl(`/teams/${myTeamId}/roster?gameweek=${week}`));
        if (cancelled) return;
        if (!res.ok) {
          applyRosterPayload([]);
          return;
        }
        const data = await res.json();
        const rows: RosterRow[] = Array.isArray(data.players) ? data.players : [];
        applyRosterPayload(rows);
      } finally {
        if (!cancelled) setRosterLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [myTeamId, week, applyRosterPayload]);

  useEffect(() => {
    if (!user?.id) return;
    let c = false;
    (async () => {
      try {
        const [hubRes, gwRes] = await Promise.all([
          fetch(apiUrl(`/leagues/${leagueId}/hub`)),
          fetch(apiUrl(`/leagues/${leagueId}/gameweeks`)),
        ]);
        const hub = await hubRes.json();
        const gwList = gwRes.ok ? await gwRes.json() : [];
        const mine = hub.teams?.find((t: { user_id: string }) => t.user_id === user.id);
        if (!mine) return;
        if (!c) {
          setMyTeamId(mine.id);
          setTeamName(mine.name);
          setGws(gwList);
          if (gwList.length) setWeek(gwList[0].number);
        }
      } finally {
        if (!c) setLoading(false);
      }
    })();
    return () => {
      c = true;
    };
  }, [leagueId, user?.id]);

  useEffect(() => {
    if (!leagueId || !myTeamId) return;
    let c = false;
    (async () => {
      const res = await fetch(apiUrl(`/leagues/${leagueId}/standings?gameweek=${week}`));
      if (!res.ok || c) return;
      const rows: StandingsRow[] = await res.json();
      if (c) return;
      const me = rows.find((r) => r.team_id === myTeamId);
      setStandingsRow(me ?? null);
    })();
    return () => {
      c = true;
    };
  }, [leagueId, week, myTeamId]);

  useEffect(() => {
    if (!saveToast) return;
    const t = setTimeout(() => setSaveToast(null), 3500);
    return () => clearTimeout(t);
  }, [saveToast]);

  useEffect(() => {
    setCaptain((c) => (c && startingIds.has(c) ? c : null));
    setVice((v) => (v && startingIds.has(v) ? v : null));
  }, [startingIds]);

  const starters = useMemo(
    () => rosterPlayers.filter((r) => startingIds.has(r.player_id)).sort(sortByPosition),
    [rosterPlayers, startingIds]
  );

  const bench = useMemo(
    () => rosterPlayers.filter((r) => !startingIds.has(r.player_id)).sort(sortByPosition),
    [rosterPlayers, startingIds]
  );

  const lockInfo = useMemo(() => {
    const g = gws.find((x) => x.number === week);
    if (!g?.locks_at) return null;
    const t = new Date(g.locks_at).getTime();
    if (t > Date.now()) return null;
    return g.locks_at;
  }, [gws, week]);

  const isLocked = Boolean(lockInfo);
  const lineupReady = rosterPlayers.length > 0 && !rosterLoading;
  const selectPlaceholder = rosterLoading ? "Select a week first" : "Select…";
  const captainPlaceholder =
    rosterLoading ? "Select a week first" : starters.length === 0 ? "Set your starting 11 first" : selectPlaceholder;
  const vicePlaceholder =
    rosterLoading ? "Select a week first" : starters.length === 0 ? "Set your starting 11 first" : selectPlaceholder;

  const recLabel = standingsRow
    ? `${standingsRow.wins}-${standingsRow.losses}`
    : "0-0";
  const ptsLabel = standingsRow
    ? standingsRow.total_points.toLocaleString(undefined, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })
    : "0.0";

  const ownerHandle = standingsRow?.owner_username ?? "—";

  async function saveSelection() {
    if (!myTeamId || startingIds.size !== 11 || !captain || !vice || isLocked) return;
    setSaving(true);
    try {
      const res = await fetch(apiUrl(`/teams/${myTeamId}/selection`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameweek: week,
          player_ids: Array.from(startingIds),
          captain_id: captain,
          vice_captain_id: vice,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg = Array.isArray(err.detail)
          ? err.detail.map((d: { msg?: string }) => d.msg ?? "").filter(Boolean).join(", ")
          : typeof err.detail === "string"
            ? err.detail
            : "Could not save lineup";
        window.alert(msg);
        return;
      }
      setSaveToast("Lineup saved");
      await refreshRoster();
    } finally {
      setSaving(false);
    }
  }

  function toggleStart(id: string) {
    if (isLocked) return;
    setStartingIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) {
        n.delete(id);
        if (captain === id) setCaptain(null);
        if (vice === id) setVice(null);
      } else if (n.size < 11) n.add(id);
      return n;
    });
  }

  function setCaptainId(id: string | null) {
    setCaptain(id);
    if (id && vice === id) setVice(null);
  }

  function setViceId(id: string | null) {
    setVice(id);
    if (id && captain === id) setCaptain(null);
  }

  const nextWeek = gws.find((g) => g.number === week + 1);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-zinc-500">Loading squad…</p>
      </div>
    );
  }

  const showEmptyStarting = lineupReady && startingIds.size === 0;

  const canSave =
    !isLocked &&
    startingIds.size === 11 &&
    captain &&
    vice &&
    !saving;

  return (
    <div className="min-h-screen pb-24 md:pb-8">
      {saveToast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-2xl border border-emerald-500/40 bg-emerald-950/95 px-5 py-3 text-sm font-semibold text-emerald-100 shadow-lg">
          {saveToast}
        </div>
      )}

      <header className="border-b border-white/8 px-4 py-6 md:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">{teamName}</h1>
            <p className="text-sm text-zinc-500">@{ownerHandle}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-bold text-zinc-300">
                REC {recLabel}
              </span>
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-300">
                PTS {ptsLabel}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={saveSelection}
            disabled={!canSave}
            className="rounded-2xl bg-white px-5 py-2.5 text-sm font-bold text-black hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save lineup"}
          </button>
        </div>

        <div className="mt-6 flex flex-wrap gap-2 overflow-x-auto pb-1">
          {(gws.length
            ? gws
            : [1, 2, 3, 4, 5].map((n) => ({ number: n, locks_at: null as string | null }))
          ).map((g) => (
            <button
              key={g.number}
              type="button"
              onClick={() => setWeek(g.number)}
              className={`shrink-0 rounded-xl border px-4 py-2 text-xs font-bold ${
                week === g.number
                  ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300"
                  : "border-white/8 bg-white/[0.03] text-zinc-400"
              }`}
            >
              Week {g.number}
            </button>
          ))}
        </div>
      </header>

      {lockInfo && (
        <div className="mx-4 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100 md:mx-8">
          <p>
            Week {week} is locked since {new Date(lockInfo).toLocaleDateString()}. Roster changes are not
            available.
          </p>
          {nextWeek ? (
            <button
              type="button"
              onClick={() => setWeek(nextWeek.number)}
              className="rounded-xl bg-white/10 px-4 py-2 text-xs font-bold text-white hover:bg-white/15"
            >
              Edit Week {nextWeek.number}
            </button>
          ) : null}
        </div>
      )}

      <main className="space-y-8 px-4 py-6 md:px-8">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wide text-white">
              Starting lineup ({starters.length}/11)
            </h2>
          </div>
          {rosterLoading ? (
            <p className="rounded-2xl border border-white/8 bg-white/[0.02] p-8 text-center text-sm text-zinc-500">
              Loading roster…
            </p>
          ) : showEmptyStarting ? (
            <p className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-zinc-500">
              No lineup set for this week
            </p>
          ) : (
            <div className="space-y-2">
              {starters.map((r) => (
                <PlayerRow
                  key={r.player_id}
                  row={r}
                  onSwap={() => toggleStart(r.player_id)}
                  onOpen={() => setModalId(r.player_id)}
                  captain={captain}
                  vice={vice}
                  locked={isLocked}
                />
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-white">
            Bench — Reserves ({bench.length}/4)
          </h2>
          {rosterLoading ? (
            <p className="rounded-2xl border border-white/8 bg-white/[0.02] p-8 text-center text-sm text-zinc-500">
              Loading roster…
            </p>
          ) : rosterPlayers.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-zinc-500">
              No players in your squad yet.
            </p>
          ) : (
            <div className="space-y-2">
              {bench.map((r) => (
                <PlayerRow
                  key={r.player_id}
                  row={r}
                  onSwap={() => toggleStart(r.player_id)}
                  onOpen={() => setModalId(r.player_id)}
                  captain={captain}
                  vice={vice}
                  locked={isLocked}
                />
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
          <h3 className="mb-3 text-sm font-bold text-white">League Roster Key</h3>
          <div className="grid grid-cols-2 gap-3 text-center text-xs sm:grid-cols-3">
            <KeyCell label="Min GK" value="1" />
            <KeyCell label="Min DEF" value="4" />
            <KeyCell label="Min MID" value="3" />
            <KeyCell label="Min ATT" value="3" />
            <KeyCell label="Bench" value="4" />
          </div>
        </section>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-bold text-amber-400">Captain (2×)</p>
            <select
              value={captain ?? ""}
              onChange={(e) => setCaptainId(e.target.value || null)}
              disabled={isLocked}
              className="w-full rounded-xl border border-white/8 bg-black/40 px-3 py-2 text-sm text-white disabled:opacity-50"
            >
              <option value="">{captainPlaceholder}</option>
              {starters.map((r) => (
                <option key={r.player_id} value={r.player_id} disabled={r.player_id === vice}>
                  {r.player.name} ({r.player.position})
                </option>
              ))}
            </select>
          </div>
          <div>
            <p className="mb-2 text-xs font-bold text-sky-400">Vice captain (1.5×)</p>
            <select
              value={vice ?? ""}
              onChange={(e) => setViceId(e.target.value || null)}
              disabled={isLocked}
              className="w-full rounded-xl border border-white/8 bg-black/40 px-3 py-2 text-sm text-white disabled:opacity-50"
            >
              <option value="">{vicePlaceholder}</option>
              {starters
                .filter((r) => r.player_id !== captain)
                .map((r) => (
                  <option key={r.player_id} value={r.player_id}>
                    {r.player.name} ({r.player.position})
                  </option>
                ))}
            </select>
          </div>
        </div>
      </main>

      <PlayerProfileModal
        leagueId={leagueId}
        playerId={modalId}
        owningTeamName={teamName}
        onClose={() => setModalId(null)}
      />
    </div>
  );
}

function KeyCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/8 bg-black/30 py-3">
      <p className="text-zinc-500">{label}</p>
      <p className="text-lg font-bold text-white">{value}</p>
    </div>
  );
}

function PlayerRow({
  row,
  onSwap,
  onOpen,
  captain,
  vice,
  locked,
}: {
  row: RosterRow;
  onSwap: () => void;
  onOpen: () => void;
  captain: string | null;
  vice: string | null;
  locked: boolean;
}) {
  const p = row.player;
  const pts = row.fantasy_points;
  return (
    <div className="flex w-full items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-2">
      <span className={`w-1 self-stretch rounded-full ${BAR[p.position] ?? "bg-zinc-600"}`} />
      <span className="w-9 shrink-0 text-center text-[10px] font-bold uppercase text-zinc-400">
        {p.position}
      </span>
      <button
        type="button"
        onClick={onOpen}
        className="min-w-0 flex-1 text-left transition hover:opacity-90"
      >
        <div className="flex items-center gap-2">
          <span className="truncate font-semibold text-white">{p.name}</span>
          {captain === row.player_id && (
            <span className="shrink-0 rounded bg-amber-500/30 px-1.5 text-[10px] font-bold text-amber-200">
              C
            </span>
          )}
          {vice === row.player_id && (
            <span className="shrink-0 rounded bg-sky-500/30 px-1.5 text-[10px] font-bold text-sky-200">
              VC
            </span>
          )}
        </div>
        <span className="mt-1 inline-block rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
          {clubAbbr(p.club)}
        </span>
      </button>
      <span className="shrink-0 text-sm font-bold tabular-nums text-emerald-400">
        {pts.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
      </span>
      <button
        type="button"
        disabled={locked}
        onClick={(e) => {
          e.stopPropagation();
          onSwap();
        }}
        className="shrink-0 text-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Swap with bench"
      >
        ⇄
      </button>
    </div>
  );
}
