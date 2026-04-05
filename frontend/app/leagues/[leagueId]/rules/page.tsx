"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { apiUrl } from "@/lib/api";

type TopTab = "general" | "scoring";
type ScoreTab = "goalkeeping" | "defending" | "midfield" | "attacking";

export default function RulesPage() {
  const params = useParams();
  const leagueId = params.leagueId as string;
  const [top, setTop] = useState<TopTab>("general");
  const [scoreTab, setScoreTab] = useState<ScoreTab>("goalkeeping");
  const [leagueStatus, setLeagueStatus] = useState<string | null>(null);

  useEffect(() => {
    let c = false;
    fetch(apiUrl(`/leagues/${leagueId}/hub`))
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!c && d?.status != null) setLeagueStatus(d.status);
      })
      .catch(() => {});
    return () => {
      c = true;
    };
  }, [leagueId]);

  const draftStarted = leagueStatus != null && leagueStatus !== "setup";

  return (
    <div className="min-h-screen pb-24 md:pb-8">
      <header className="border-b border-white/8 px-4 py-6 md:px-8">
        <h1 className="text-2xl font-bold tracking-tight text-white">League Rules</h1>
        <p className="mt-1 text-sm text-zinc-500">Configure scoring and draft settings</p>
      </header>

      {draftStarted && (
        <div className="mx-4 mt-4 flex items-start gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100 md:mx-8">
          <svg className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <p>
            League rules are locked. Scoring and draft configuration cannot be changed once the draft has
            started.
          </p>
        </div>
      )}

      <div className="px-4 py-6 md:px-8">
        <div className="mb-8 flex flex-wrap justify-center gap-2 rounded-2xl border border-white/8 bg-white/[0.03] p-1">
          <button
            type="button"
            onClick={() => setTop("general")}
            className={`rounded-xl px-6 py-2 text-sm font-bold ${
              top === "general" ? "bg-white/10 text-white ring-1 ring-white/20" : "text-zinc-500"
            }`}
          >
            General
          </button>
          <button
            type="button"
            onClick={() => setTop("scoring")}
            className={`rounded-xl px-6 py-2 text-sm font-bold ${
              top === "scoring" ? "bg-white/10 text-white ring-1 ring-white/20" : "text-zinc-500"
            }`}
          >
            Scoring
          </button>
        </div>

        {top === "general" && <GeneralTab draftStarted={draftStarted} />}
        {top === "scoring" && (
          <div>
            <div className="mb-6 flex flex-wrap justify-center gap-2">
              {(
                [
                  ["goalkeeping", "Goalkeeping"],
                  ["defending", "Defending"],
                  ["midfield", "Midfield"],
                  ["attacking", "Attacking"],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setScoreTab(k)}
                  className={`rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-wide ${
                    scoreTab === k ? "bg-violet-500/20 text-violet-200 ring-1 ring-violet-500/40" : "text-zinc-500"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {scoreTab === "goalkeeping" && <GoalkeepingTab />}
            {scoreTab === "defending" && <DefendingTab />}
            {scoreTab === "midfield" && <MidfieldTab />}
            {scoreTab === "attacking" && <AttackingTab />}
          </div>
        )}

        <p className="mt-10 text-center text-sm text-zinc-600">
          <Link href={`/leagues/${leagueId}`} className="text-emerald-400 hover:underline">
            ← Back to league hub
          </Link>
        </p>
      </div>
    </div>
  );
}

function GeneralTab({ draftStarted }: { draftStarted: boolean }) {
  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-white/8 bg-white/[0.03] p-6">
        <h2 className="text-lg font-bold text-white">Draft &amp; Roster</h2>
        <p className="mb-4 text-sm text-zinc-500">Read-only after the draft starts.</p>
        <p className="mb-3 text-sm font-semibold text-zinc-400">Draft Pick Timer</p>
        <div className="flex flex-wrap gap-2 opacity-100">
          {["30s", "60s", "90s", "120s", "200s"].map((s, i) => (
            <span
              key={s}
              className={`rounded-xl border px-4 py-2 text-sm font-bold ${
                i === 2 ? "border-violet-500 bg-violet-500/10 text-violet-200" : "border-white/10 text-zinc-500"
              } ${draftStarted ? "cursor-not-allowed" : ""}`}
            >
              {s}
            </span>
          ))}
        </div>
        <p className="mt-6 text-sm text-white">
          <span className="text-zinc-500">Squad size:</span> 15 players (11 starters + 4 bench)
        </p>
        <p className="mt-2 text-sm text-white">
          <span className="text-zinc-500">Position minimums:</span> Min 1 GK, Min 4 DEF, Min 3 MID, Min 3 ATT
        </p>
      </section>

      <section className="rounded-2xl border border-white/8 bg-white/[0.03] p-6">
        <h2 className="mb-2 text-lg font-bold text-white">Match Points (all positions)</h2>
        <RulesTable
          rows={[
            ["90 minutes played", "+2"],
            ["60–89 minutes played", "+1"],
            ["Man of the Match", "+6"],
            ["Hat-trick bonus", "+10"],
            ["Brace bonus (2 goals)", "+4"],
            ["Goal + Assist same game", "+4 bonus"],
            ["Own goal", "-4"],
            ["Penalty missed", "-3"],
            ["Yellow card", "-2"],
            ["Red card", "-6"],
            ["Captain multiplier", "2× final points"],
            ["Vice-Captain multiplier", "1.5× final points"],
            ["Match Winning Team", "+1"],
            ["Draw", "+0.5"],
          ]}
        />
      </section>
    </div>
  );
}

function GoalkeepingTab() {
  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-white/8 bg-white/[0.03] p-6">
        <h3 className="mb-4 text-base font-bold text-white">Standard Events</h3>
        <RulesTable
          rows={[
            ["Save", "+2"],
            ["Save from inside the box", "+3"],
            ["Penalty save", "+8"],
            ["Clean sheet (60+ min)", "+6"],
            ["Goals prevented (xG faced − goals conceded, per 0.5)", "+2"],
            ["High claim won", "+2"],
            ["Sweeper keeper action", "+2"],
            ["Accurate long distribution (60%+ pass accuracy)", "+2"],
            ["Goal conceded", "-2"],
            ["Error leading to goal", "-5"],
            ["Yellow card", "-2"],
            ["Red card", "-6"],
          ]}
        />
      </section>
      <section className="rounded-2xl border border-white/8 bg-white/[0.03] p-6">
        <h3 className="mb-4 text-base font-bold text-white">Out-of-Position Rarity Bonuses</h3>
        <RarityTable
          rows={[
            ["Goal scored", "+20", "GKs score maybe once a season globally"],
            ["Assist", "+12", "Deliberate assist from a GK is extraordinary"],
            ["Aerial duel won (open play)", "+3", "Not their domain"],
          ]}
        />
      </section>
    </div>
  );
}

function DefendingTab() {
  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-white/8 bg-white/[0.03] p-6">
        <h3 className="mb-4 text-base font-bold text-white">Standard Events</h3>
        <RulesTable
          rows={[
            ["Tackle won", "+2"],
            ["Interception", "+2"],
            ["Clearance", "+1"],
            ["Blocked shot", "+3"],
            ["Aerial duel won", "+1.5"],
            ["Ground duel won", "+1"],
            ["Clean sheet (60+ min)", "+5"],
            ["Progressive carry (10m+)", "+1"],
            ["Accurate long ball", "+0.5"],
            ["Goal conceded", "-1.5"],
            ["Error leading to goal", "-5"],
            ["Dribbled past", "-1.5"],
            ["Yellow card", "-2"],
            ["Red card", "-6"],
          ]}
        />
      </section>
      <section className="rounded-2xl border border-white/8 bg-white/[0.03] p-6">
        <h3 className="mb-4 text-base font-bold text-white">Out-of-Position Rarity Bonuses</h3>
        <RarityTable
          rows={[
            ["Goal scored", "+10", "Defenders rarely score — when they do it's huge"],
            ["Assist", "+8", "Attacking contribution from a CB is exceptional"],
            ["Dribble completed in final third", "+3", "A CB driving into the box is rare and impactful"],
            ["Shot on target", "+2", "Defenders rarely shoot, so it means they pushed forward"],
          ]}
        />
      </section>
    </div>
  );
}

function MidfieldTab() {
  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-white/8 bg-white/[0.03] p-6">
        <h3 className="mb-4 text-base font-bold text-white">Standard Events</h3>
        <RulesTable
          rows={[
            ["Goal", "+6"],
            ["Assist", "+5"],
            ["Key pass", "+2.5"],
            ["Chance created", "+2"],
            ["xA per 0.3", "+1"],
            ["Progressive pass (10m+)", "+0.5"],
            ["Dribble completed", "+1.5"],
            ["Recovery", "+1"],
            ["Tackle won", "+1.5"],
            ["Interception", "+1.5"],
            ["Tackle won in attacking third", "+1"],
            ["Possession lost (every 5)", "-1"],
            ["Yellow card", "-2"],
            ["Red card", "-6"],
          ]}
        />
      </section>
      <section className="rounded-2xl border border-white/8 bg-white/[0.03] p-6">
        <h3 className="mb-4 text-base font-bold text-white">Out-of-Position Rarity Bonuses</h3>
        <RarityTable
          rows={[
            ["Goal from outside the box", "+4 extra", "Long range goals from mids are special"],
            ["Clean sheet bonus", "+2", "Reward disciplined defensive midfielders"],
            ["Aerial duel won (own box)", "+2", "A mid defending like a CB in a corner is extra effort"],
          ]}
        />
      </section>
    </div>
  );
}

function AttackingTab() {
  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-white/8 bg-white/[0.03] p-6">
        <h3 className="mb-4 text-base font-bold text-white">Standard Events</h3>
        <RulesTable
          rows={[
            ["Goal", "+7"],
            ["Assist", "+5"],
            ["Shot on target", "+1.5"],
            ["xG per 0.3", "+1"],
            ["Dribble completed", "+2"],
            ["Big chance created", "+3"],
            ["Tackle won in attacking third", "+1"],
            ["Shot off target", "-0.5"],
            ["Big chance missed", "-3"],
            ["Offside (per instance)", "-0.5"],
            ["Yellow card", "-2"],
            ["Red card", "-6"],
          ]}
        />
      </section>
      <section className="rounded-2xl border border-white/8 bg-white/[0.03] p-6">
        <h3 className="mb-4 text-base font-bold text-white">Out-of-Position Rarity Bonuses</h3>
        <RarityTable
          rows={[
            ["Aerial duel won (own half / defensive)", "+4", "A striker coming back to defend a corner"],
            ["Tackle won (own half)", "+3", "Attacker tracking back and winning a tackle"],
            ["Clearance (own box)", "+4", "A striker clearing off the line is memorable"],
            ["Interception (defensive third)", "+3", "Pure work rate, completely out of role"],
          ]}
        />
      </section>
    </div>
  );
}

function RulesTable({ rows }: { rows: [string, string][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-zinc-500">
            <th className="py-2 pr-4 font-semibold">Event</th>
            <th className="py-2 text-right font-semibold">Points</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([ev, pts]) => (
            <tr key={ev} className="border-b border-white/5">
              <td className="py-2.5 pr-4 text-zinc-300">{ev}</td>
              <td className="py-2.5 text-right font-mono font-semibold tabular-nums text-emerald-300">
                {pts}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RarityTable({ rows }: { rows: [string, string, string][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-zinc-500">
            <th className="py-2 pr-4 font-semibold">Rare Event</th>
            <th className="py-2 pr-4 font-semibold">Points</th>
            <th className="py-2 font-semibold">Why</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([ev, pts, why]) => (
            <tr key={ev} className="border-b border-white/5">
              <td className="py-2.5 pr-4 text-zinc-300">{ev}</td>
              <td className="py-2.5 pr-4 font-mono font-semibold text-violet-300">{pts}</td>
              <td className="py-2.5 text-zinc-500">{why}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
