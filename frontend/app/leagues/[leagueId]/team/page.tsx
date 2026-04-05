"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
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

interface SquadPlayer {
  player_id: string;
  player: Player;
}

const POS_ORDER = ["GK", "DEF", "MID", "ATT"];
const BAR: Record<string, string> = {
  GK: "bg-amber-500",
  DEF: "bg-sky-500",
  MID: "bg-emerald-500",
  ATT: "bg-rose-500",
};

export default function TeamPage() {
  const params = useParams();
  const leagueId = params.leagueId as string;
  const { user } = useUser();

  const [squad, setSquad] = useState<SquadPlayer[]>([]);
  const [starting, setStarting] = useState<Set<string>>(new Set());
  const [captain, setCaptain] = useState<string | null>(null);
  const [vice, setVice] = useState<string | null>(null);
  const [myTeamId, setMyTeamId] = useState<string | null>(null);
  const [teamName, setTeamName] = useState("");
  const [week, setWeek] = useState(1);
  const [gws, setGws] = useState<{ number: number; locks_at: string | null }[]>([]);
  const [modalId, setModalId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
        const squadRes = await fetch(apiUrl(`/teams/${mine.id}/squad`));
        const sq = await squadRes.json();
        if (!c) {
          setSquad(sq);
          const starters = new Set<string>();
          sq.forEach((s: SquadPlayer) => starters.add(s.player_id));
          const first11 = sq.slice(0, 11).map((s: SquadPlayer) => s.player_id);
          setStarting(new Set(first11));
        }
      } finally {
        if (!c) setLoading(false);
      }
    })();
    return () => {
      c = true;
    };
  }, [leagueId, user?.id]);

  const sorted = useMemo(
    () =>
      [...squad].sort(
        (a, b) => POS_ORDER.indexOf(a.player.position) - POS_ORDER.indexOf(b.player.position)
      ),
    [squad]
  );

  const starters = sorted.filter((s) => starting.has(s.player_id));
  const bench = sorted.filter((s) => !starting.has(s.player_id));

  const lockInfo = useMemo(() => {
    const g = gws.find((x) => x.number === week);
    if (!g?.locks_at) return null;
    const t = new Date(g.locks_at).getTime();
    if (t > Date.now()) return null;
    return g.locks_at;
  }, [gws, week]);

  async function saveSelection() {
    if (!myTeamId || starting.size !== 11 || !captain || !vice) return;
    setSaving(true);
    try {
      await fetch(apiUrl(`/teams/${myTeamId}/selection`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          starting_11: Array.from(starting),
          captain_id: captain,
          vice_captain_id: vice,
        }),
      });
    } finally {
      setSaving(false);
    }
  }

  function toggleStart(id: string) {
    setStarting((prev) => {
      const n = new Set(prev);
      if (n.has(id)) {
        n.delete(id);
        if (captain === id) setCaptain(null);
        if (vice === id) setVice(null);
      } else if (n.size < 11) n.add(id);
      return n;
    });
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-zinc-500">Loading squad…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 md:pb-8">
      <header className="border-b border-white/8 px-4 py-6 md:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">{teamName}</h1>
            <p className="text-sm text-zinc-500">@{user?.username ?? user?.id?.slice(0, 8) ?? "you"}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-bold text-zinc-300">
                REC 0-0
              </span>
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-300">
                PTS 0.0
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={saveSelection}
            disabled={saving}
            className="rounded-2xl bg-white px-5 py-2.5 text-sm font-bold text-black hover:bg-zinc-200 disabled:opacity-50"
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
          <button type="button" className="rounded-xl bg-white/10 px-4 py-2 text-xs font-bold text-white">
            Edit Week {week + 1}
          </button>
        </div>
      )}

      <main className="space-y-8 px-4 py-6 md:px-8">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wide text-white">
              Starting lineup ({starters.length}/11)
            </h2>
            <span className="rounded-full border border-violet-500/40 px-2 py-0.5 text-xs font-bold text-violet-300">
              INT 0/4
            </span>
          </div>
          <div className="space-y-2">
            {starters.map((s) => (
              <PlayerRow
                key={s.player_id}
                s={s}
                onSwap={() => toggleStart(s.player_id)}
                onOpen={() => setModalId(s.player_id)}
                captain={captain}
                vice={vice}
                bench={false}
              />
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-white">
            Bench — Reserves ({bench.length}/4)
          </h2>
          <div className="space-y-2">
            {bench.map((s) => (
              <PlayerRow
                key={s.player_id}
                s={s}
                onSwap={() => toggleStart(s.player_id)}
                onOpen={() => setModalId(s.player_id)}
                captain={captain}
                vice={vice}
                bench
              />
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
          <h3 className="mb-3 text-sm font-bold text-white">League Roster Key</h3>
          <div className="grid grid-cols-3 gap-3 text-center text-xs">
            <KeyCell label="Min GK" value="1" />
            <KeyCell label="Min DEF" value="4" />
            <KeyCell label="Min MID" value="3" />
            <KeyCell label="Min ATT" value="3" />
            <KeyCell label="Flex" value="4" />
            <KeyCell label="Bench" value="4" />
          </div>
        </section>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-bold text-amber-400">Captain (2×)</p>
            <select
              value={captain ?? ""}
              onChange={(e) => setCaptain(e.target.value || null)}
              className="w-full rounded-xl border border-white/8 bg-black/40 px-3 py-2 text-sm text-white"
            >
              <option value="">Select…</option>
              {sorted
                .filter((s) => starting.has(s.player_id))
                .map((s) => (
                  <option key={s.player_id} value={s.player_id}>
                    {s.player.name}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <p className="mb-2 text-xs font-bold text-sky-400">Vice captain (1.5×)</p>
            <select
              value={vice ?? ""}
              onChange={(e) => setVice(e.target.value || null)}
              className="w-full rounded-xl border border-white/8 bg-black/40 px-3 py-2 text-sm text-white"
            >
              <option value="">Select…</option>
              {sorted
                .filter((s) => starting.has(s.player_id) && s.player_id !== captain)
                .map((s) => (
                  <option key={s.player_id} value={s.player_id}>
                    {s.player.name}
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
  s,
  onSwap,
  onOpen,
  captain,
  vice,
  bench,
}: {
  s: SquadPlayer;
  onSwap: () => void;
  onOpen: () => void;
  captain: string | null;
  vice: string | null;
  bench: boolean;
}) {
  const p = s.player;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-2 text-left transition hover:border-white/15"
    >
      <span className={`w-1 self-stretch rounded-full ${BAR[p.position] ?? "bg-zinc-600"}`} />
      <span className="w-8 shrink-0 text-center text-[10px] font-bold uppercase text-zinc-500">
        {bench ? "BNCH" : p.position}
      </span>
      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-zinc-800">
        {p.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.photo_url} alt="" className="h-full w-full object-cover" />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-semibold text-white">{p.name}</span>
          {captain === s.player_id && (
            <span className="shrink-0 rounded bg-amber-500/30 px-1.5 text-[10px] font-bold text-amber-200">
              C
            </span>
          )}
          {vice === s.player_id && (
            <span className="shrink-0 rounded bg-sky-500/30 px-1.5 text-[10px] font-bold text-sky-200">
              VC
            </span>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap gap-1 text-[10px] text-zinc-500">
          <span className="rounded bg-white/5 px-1.5 py-0.5">{p.club}</span>
          <span className="text-amber-200/80">VS TBD</span>
        </div>
      </div>
      <span className="text-sm font-bold tabular-nums text-violet-400">—</span>
      <span
        role="button"
        tabIndex={0}
        onClick={(e) => {
          e.stopPropagation();
          onSwap();
        }}
        onKeyDown={(e) => e.stopPropagation()}
        className="text-zinc-500 hover:text-white"
      >
        ⇄
      </span>
    </button>
  );
}
