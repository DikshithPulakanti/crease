"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { apiUrl } from "@/lib/api";

type Player = {
  id: string;
  name: string;
  position: string;
  club: string;
  photo_url: string | null;
};

type Team = { id: string; name: string; user_id: string };

type SquadPlayer = { player_id: string; player: Player };

type TradeRow = {
  id: string;
  proposer_team_id: string;
  receiver_team_id: string;
  proposer_player_id: string;
  receiver_player_id: string;
  proposer_player_name: string;
  receiver_player_name: string;
  status: string;
  created_at: string;
};

const BAR = ["bg-emerald-500", "bg-violet-500", "bg-amber-500", "bg-sky-500"];

export default function TradesPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const leagueId = params.leagueId as string;
  const { user } = useUser();

  const prefillPlayer = searchParams.get("player");
  const prefillTeam = searchParams.get("team");
  const prefilled = useRef(false);

  const [tab, setTab] = useState<"new" | "inbox" | "history">("new");
  const [inboxSub, setInboxSub] = useState<"received" | "sent">("received");

  const [myTeam, setMyTeam] = useState<Team | null>(null);
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [mySquad, setMySquad] = useState<SquadPlayer[]>([]);
  const [otherSquads, setOtherSquads] = useState<Record<string, SquadPlayer[]>>({});
  const [leagueTrades, setLeagueTrades] = useState<TradeRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [opp, setOpp] = useState<Team | null>(null);
  const [mine, setMine] = useState<Set<string>>(new Set());
  const [theirs, setTheirs] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);

  async function refresh() {
    const hubRes = await fetch(apiUrl(`/leagues/${leagueId}/hub`));
    const hubData = await hubRes.json();
    const me = hubData.teams?.find((t: Team) => t.user_id === user?.id) ?? null;
    setMyTeam(me);
    setAllTeams(hubData.teams ?? []);
    if (me) {
      const [squadRes, trRes] = await Promise.all([
        fetch(apiUrl(`/teams/${me.id}/squad`)),
        fetch(apiUrl(`/leagues/${leagueId}/trades`)),
      ]);
      const squadData = await squadRes.json();
      const tr = await trRes.json();
      setMySquad(squadData);
      setLeagueTrades(tr);
      const others = hubData.teams?.filter((t: Team) => t.id !== me.id) ?? [];
      const squads: Record<string, SquadPlayer[]> = {};
      await Promise.all(
        others.map(async (t: Team) => {
          const r = await fetch(apiUrl(`/teams/${t.id}/squad`));
          squads[t.id] = await r.json();
        })
      );
      setOtherSquads(squads);
    }
  }

  useEffect(() => {
    if (!user?.id) return;
    let c = false;
    (async () => {
      try {
        await refresh();
      } finally {
        if (!c) setLoading(false);
      }
    })();
    return () => {
      c = true;
    };
  }, [leagueId, user?.id]);

  useEffect(() => {
    if (prefilled.current || !prefillPlayer || !prefillTeam) return;
    if (allTeams.length === 0 || Object.keys(otherSquads).length === 0) return;
    const targetTeam = allTeams.find((t) => t.id === prefillTeam);
    if (!targetTeam) return;
    prefilled.current = true;
    setTab("new");
    setOpp(targetTeam);
    setTheirs(new Set([prefillPlayer]));
  }, [allTeams, otherSquads, prefillPlayer, prefillTeam]);

  const toggle = (set: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) => {
    set((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  async function sendProposal() {
    if (!myTeam || !opp || mine.size === 0 || theirs.size === 0 || mine.size !== theirs.size) return;
    setSending(true);
    try {
      const proposer_player_ids = Array.from(mine);
      const receiver_player_ids = Array.from(theirs);
      const res = await fetch(apiUrl(`/leagues/${leagueId}/trades`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proposer_team_id: myTeam.id,
          receiver_team_id: opp.id,
          proposer_player_ids,
          receiver_player_ids,
        }),
      });
      if (res.ok) {
        setMine(new Set());
        setTheirs(new Set());
        await refresh();
      }
    } finally {
      setSending(false);
    }
  }

  async function tradeAction(tradeId: string, action: string) {
    if (!myTeam) return;
    await fetch(apiUrl(`/teams/${myTeam.id}/trades/${tradeId}/action`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    await refresh();
  }

  const incoming = useMemo(
    () =>
      leagueTrades.filter(
        (t) => t.receiver_team_id === myTeam?.id && t.status === "pending"
      ),
    [leagueTrades, myTeam?.id]
  );

  const outgoing = useMemo(
    () =>
      leagueTrades.filter(
        (t) => t.proposer_team_id === myTeam?.id && t.status === "pending"
      ),
    [leagueTrades, myTeam?.id]
  );

  const history = useMemo(
    () => leagueTrades.filter((t) => t.status !== "pending"),
    [leagueTrades]
  );

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-zinc-500">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-28 md:pb-8">
      <header className="border-b border-white/8 px-4 py-6 md:px-8">
        <h1 className="text-2xl font-bold tracking-tight text-white">Trades</h1>
      </header>

      <div className="px-4 py-4 md:px-8">
        <div className="flex flex-wrap justify-center gap-2 rounded-2xl border border-white/8 bg-white/[0.03] p-1">
          {(
            [
              ["new", "+ New"],
              ["inbox", "Inbox"],
              ["history", "History"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={`rounded-xl px-6 py-2 text-sm font-bold ${
                tab === k ? "bg-white/10 text-white ring-1 ring-white/25" : "text-zinc-500"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === "new" && myTeam && (
        <div className="grid gap-4 px-4 pb-32 md:grid-cols-2 md:px-8">
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
            <div className="mb-4">
              <h2 className="text-sm font-bold uppercase tracking-wide text-emerald-400">You Send</h2>
              <p className="text-xs text-zinc-500">{mine.size} selected</p>
            </div>
            <ul className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
              {mySquad.map((s, i) => (
                <li key={s.player_id}>
                  <button
                    type="button"
                    onClick={() => toggle(setMine, s.player_id)}
                    className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-2 text-left transition ${
                      mine.has(s.player_id)
                        ? "border-emerald-500/60 bg-emerald-500/10"
                        : "border-white/8 bg-black/20 hover:border-white/15"
                    }`}
                  >
                    <span className={`w-1 self-stretch rounded-full ${BAR[i % BAR.length]}`} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-white">{s.player.name}</p>
                      <p className="text-xs text-zinc-500">
                        <span className="rounded bg-white/10 px-1.5 py-0.5">{s.player.club}</span>{" "}
                        <span className="rounded bg-white/5 px-1.5 py-0.5">{s.player.position}</span>
                      </p>
                    </div>
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 ${
                        mine.has(s.player_id)
                          ? "border-emerald-400 bg-emerald-500/30"
                          : "border-zinc-600"
                      }`}
                    >
                      {mine.has(s.player_id) ? "✓" : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
            <div className="mb-4">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-violet-300">
                Select team
              </label>
              <select
                value={opp?.id ?? ""}
                onChange={(e) => {
                  const t = allTeams.find((x) => x.id === e.target.value);
                  setOpp(t ?? null);
                  setTheirs(new Set());
                }}
                className="w-full rounded-2xl border border-violet-500/40 bg-black/40 px-4 py-3 text-sm font-semibold text-white"
              >
                <option value="">Select team</option>
                {allTeams
                  .filter((t) => t.id !== myTeam.id)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
              </select>
            </div>
            {opp && (
              <>
                <p className="mb-2 text-xs text-zinc-500">{theirs.size} selected</p>
                <ul className="max-h-[380px] space-y-2 overflow-y-auto pr-1">
                  {(otherSquads[opp.id] ?? []).map((s, i) => (
                    <li key={s.player_id}>
                      <button
                        type="button"
                        onClick={() => toggle(setTheirs, s.player_id)}
                        className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-2 text-left transition ${
                          theirs.has(s.player_id)
                            ? "border-violet-500/60 bg-violet-500/10"
                            : "border-white/8 bg-black/20 hover:border-white/15"
                        }`}
                      >
                        <span className={`w-1 self-stretch rounded-full ${BAR[i % BAR.length]}`} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-white">{s.player.name}</p>
                          <p className="text-xs text-zinc-500">
                            <span className="rounded bg-white/10 px-1.5 py-0.5">{s.player.club}</span>{" "}
                            <span className="rounded bg-white/5 px-1.5 py-0.5">{s.player.position}</span>
                          </p>
                        </div>
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 ${
                            theirs.has(s.player_id)
                              ? "border-violet-400 bg-violet-500/30"
                              : "border-zinc-600"
                          }`}
                        >
                          {theirs.has(s.player_id) ? "✓" : ""}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      )}

      {tab === "inbox" && (
        <div className="px-4 md:px-8">
          <div className="mb-4 flex gap-2">
            <button
              type="button"
              onClick={() => setInboxSub("received")}
              className={`rounded-xl px-4 py-2 text-sm font-bold ${
                inboxSub === "received" ? "bg-white/10 text-white" : "text-zinc-500"
              }`}
            >
              Received
            </button>
            <button
              type="button"
              onClick={() => setInboxSub("sent")}
              className={`rounded-xl px-4 py-2 text-sm font-bold ${
                inboxSub === "sent" ? "bg-white/10 text-white" : "text-zinc-500"
              }`}
            >
              Sent
            </button>
          </div>
          {inboxSub === "received" && incoming.length === 0 && (
            <div className="rounded-2xl border border-dashed border-white/10 py-16 text-center">
              <p className="text-sm text-zinc-500">No incoming trade requests.</p>
            </div>
          )}
          {inboxSub === "received" &&
            incoming.map((t) => (
              <div
                key={t.id}
                className="mb-4 rounded-2xl border border-white/8 bg-white/[0.03] p-5"
              >
                <p className="mb-2 text-sm text-zinc-400">
                  From <span className="font-semibold text-white">{teamName(allTeams, t.proposer_team_id)}</span>
                </p>
                <div className="mb-4 grid grid-cols-2 gap-3 text-center text-sm">
                  <div className="rounded-xl bg-black/30 p-3">
                    <p className="text-xs text-zinc-500">Sends</p>
                    <p className="font-semibold text-white">{t.proposer_player_name}</p>
                  </div>
                  <div className="rounded-xl bg-black/30 p-3">
                    <p className="text-xs text-zinc-500">For</p>
                    <p className="font-semibold text-white">{t.receiver_player_name}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => tradeAction(t.id, "accept")}
                    className="flex-1 rounded-xl bg-emerald-600 py-2 text-sm font-bold text-white hover:bg-emerald-500"
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    onClick={() => tradeAction(t.id, "reject")}
                    className="flex-1 rounded-xl border border-red-500/40 py-2 text-sm font-bold text-red-300 hover:bg-red-500/10"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          {inboxSub === "sent" && outgoing.length === 0 && (
            <p className="text-center text-sm text-zinc-500">No outgoing pending trades.</p>
          )}
          {inboxSub === "sent" &&
            outgoing.map((t) => (
              <div key={t.id} className="mb-4 rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-sm">
                <p className="text-zinc-400">
                  To {teamName(allTeams, t.receiver_team_id)} — pending
                </p>
                <p className="mt-2 text-white">
                  {t.proposer_player_name} ⇄ {t.receiver_player_name}
                </p>
              </div>
            ))}
        </div>
      )}

      {tab === "history" && (
        <div className="space-y-4 px-4 md:px-8">
          {history.length === 0 && (
            <p className="text-center text-sm text-zinc-500">No completed trades yet.</p>
          )}
          {history.map((t) => (
            <div key={t.id} className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
              <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                <p className="font-bold text-white">
                  {teamName(allTeams, t.proposer_team_id)} ⇄ {teamName(allTeams, t.receiver_team_id)}
                </p>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                    t.status === "accepted"
                      ? "bg-emerald-500/20 text-emerald-300"
                      : "bg-red-500/20 text-red-300"
                  }`}
                >
                  {t.status}
                </span>
              </div>
              <p className="mb-4 text-xs text-zinc-500">
                {new Date(t.created_at).toLocaleString()}
              </p>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs uppercase text-zinc-500">Sends</p>
                  <p className="font-semibold text-white">{t.proposer_player_name}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-zinc-500">Sends</p>
                  <p className="font-semibold text-white">{t.receiver_player_name}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "new" && myTeam && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/8 bg-[#0a0a0f]/95 px-4 py-4 backdrop-blur md:bottom-0 md:left-[72px] lg:left-56">
          <div className="mx-auto flex max-w-4xl items-center gap-4">
            <span className="text-sm font-bold text-emerald-400">{mine.size} out</span>
            <span className="text-zinc-600">⇄</span>
            <span className="text-sm font-bold text-violet-400">{theirs.size} in</span>
            <button
              type="button"
              disabled={
                sending ||
                !opp ||
                mine.size === 0 ||
                theirs.size === 0 ||
                mine.size !== theirs.size
              }
              onClick={sendProposal}
              className="ml-auto flex flex-1 items-center justify-center gap-2 rounded-2xl bg-violet-600 py-3 text-sm font-bold text-white shadow-lg shadow-violet-900/30 disabled:cursor-not-allowed disabled:opacity-40 md:max-w-md"
            >
              Send Trade Proposal <span aria-hidden>✈</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function teamName(teams: Team[], id: string) {
  return teams.find((t) => t.id === id)?.name ?? "Team";
}
