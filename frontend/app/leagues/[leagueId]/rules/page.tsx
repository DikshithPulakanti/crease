"use client";

import { useState } from "react";

type Tab = "general" | "scoring";

export default function RulesPage() {
  const [tab, setTab] = useState<Tab>("general");
  const [scoreTab, setScoreTab] = useState<"general" | "attacking" | "defending" | "goalkeeping">(
    "general"
  );
  const locked = true;

  return (
    <div className="min-h-screen pb-24 md:pb-8">
      <header className="border-b border-white/8 px-4 py-6 md:px-8">
        <h1 className="text-2xl font-bold tracking-tight text-white">League Rules</h1>
        <p className="mt-1 text-sm text-zinc-500">Configure scoring and draft settings</p>
      </header>

      {locked && (
        <div className="mx-4 mt-4 flex items-start gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100 md:mx-8">
          <svg className="mt-0.5 h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
            onClick={() => setTab("general")}
            className={`rounded-xl px-6 py-2 text-sm font-bold ${
              tab === "general" ? "bg-white/10 text-white ring-1 ring-white/20" : "text-zinc-500"
            }`}
          >
            General
          </button>
          <button
            type="button"
            onClick={() => setTab("scoring")}
            className={`rounded-xl px-6 py-2 text-sm font-bold ${
              tab === "scoring" ? "bg-white/10 text-white ring-1 ring-white/20" : "text-zinc-500"
            }`}
          >
            Scoring
          </button>
        </div>

        {tab === "general" && (
          <div className="space-y-6">
            <section className="rounded-2xl border border-white/8 bg-white/[0.03] p-6">
              <div className="mb-6 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-500/20 text-violet-300">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.124l.737-.527c.438-.316.98-.316 1.418 0l.828.586c.438.316.67.84.586 1.37l-.151.953c-.07.424.13.85.49 1.088.36.24.82.293 1.223.124l.896-.349c.52-.203 1.11.08 1.35.59l.394.96c.24.51.02 1.1-.47 1.37l-.833.45c-.37.2-.62.55-.62.95 0 .4.25.75.62.95l.833.45c.49.27.71.86.47 1.37l-.394.96c-.24.51-.83.79-1.35.59l-.896-.349c-.403-.169-.86-.116-1.223.124-.36.238-.56.664-.49 1.088l.151.953c.084.53-.148 1.054-.586 1.37l-.828.586c-.438.316-.98.316-1.418 0l-.737-.527c-.35-.266-.807-.288-1.205-.124-.396.166-.71.506-.78.93l-.149.894c-.09.542-.56.94-1.11.94h-1.093c-.55 0-1.02-.398-1.11-.94l-.149-.894c-.07-.424-.384-.764-.78-.93-.398-.164-.855-.142-1.205.124l-.737.527c-.438.316-.98.316-1.418 0l-.828-.586c-.438-.316-.67-.84-.586-1.37l.151-.953c.07-.424-.13-.85-.49-1.088-.36-.24-.82-.293-1.223-.124l-.896.349c-.52.203-1.11-.08-1.35-.59l-.394-.96c-.24-.51-.02-1.1.47-1.37l.833-.45c.37-.2.62-.55.62-.95 0-.4-.25-.75-.62-.95l-.833-.45c-.49-.27-.71-.86-.47-1.37l.394-.96c.24-.51.83-.79 1.35-.59l.896.349c.403.169.86.116 1.223-.124.36-.238.56-.664.49-1.088l-.151-.953c-.084-.53.148-1.054.586-1.37l.828-.586c.438-.316.98-.316 1.418 0l.737.527c.35.266.807.288 1.205.124.396-.166.71-.506.78-.93l.149-.894z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </span>
                <div>
                  <h2 className="text-lg font-bold text-white">Draft &amp; Roster</h2>
                  <p className="text-sm text-zinc-500">Configure draft settings and roster requirements.</p>
                </div>
              </div>

              <div className="mb-8">
                <p className="mb-3 text-sm font-semibold text-white">Draft Pick Timer</p>
                <div className="flex flex-wrap gap-2">
                  {["30s", "60s", "90s", "120s", "200s"].map((s, i) => (
                    <span
                      key={s}
                      className={`rounded-xl border px-4 py-2 text-sm font-bold ${
                        i === 2
                          ? "border-violet-500 bg-violet-500/10 text-violet-200"
                          : "border-white/10 text-zinc-500"
                      }`}
                    >
                      {s}
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-xs text-zinc-600">
                  Time allowed for each manager to make their pick during the draft.
                </p>
              </div>

              <div>
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-semibold text-white">Roster Configuration</p>
                  <span className="text-xs font-bold text-violet-400">Total: 15 / 15</span>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <RosterRow label="Active Size" value="11" hint="Players in the starting lineup (6–11)." />
                  <RosterRow label="Bench Size" value="4" hint="Reserve players (0–5)." />
                  <RosterRow label="Max International" value="4" hint="Limit for non-domestic players." />
                </div>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <MinRow label="Min GK" value="1" />
                  <MinRow label="Min DEF" value="4" />
                  <MinRow label="Min MID" value="3" />
                  <MinRow label="Min ATT" value="3" />
                </div>
              </div>
            </section>
          </div>
        )}

        {tab === "scoring" && (
          <div>
            <div className="mb-6 flex flex-wrap justify-center gap-2">
              {(
                [
                  ["general", "General"],
                  ["attacking", "Attacking"],
                  ["defending", "Defending"],
                  ["goalkeeping", "Goalkeeping"],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setScoreTab(k)}
                  className={`rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-wide ${
                    scoreTab === k ? "bg-white/10 text-white ring-1 ring-white/20" : "text-zinc-500"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {scoreTab === "general" && (
              <div className="space-y-6">
                <CardSection title="Match Points" subtitle="Points for team selection and match outcomes.">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <NumField label="Starting XI Presence" value="2" hint="Awarded to every player in the starting XI." />
                    <NumField label="Match Winning Team" value="1" hint="Players on the winning side." />
                    <NumField label="Captain" value="2x" hint="Multiplier on captain." />
                    <NumField label="Vice Captain" value="1.5x" hint="Multiplier on vice captain." />
                    <NumField label="Draw" value="0.5" hint="Per player when match is drawn." />
                  </div>
                </CardSection>
                <CardSection title="Playing Time" subtitle="Minutes-based points.">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <NumField label="60+ minutes" value="2" hint="Played full hour or more." />
                    <NumField label="1–59 minutes" value="1" hint="Partial appearance." />
                  </div>
                </CardSection>
                <CardSection title="Discipline" subtitle="Cards and own goals.">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <NumField label="Yellow Card" value="-1" hint="" />
                    <NumField label="Red Card" value="-3" hint="" />
                    <NumField label="Own Goal" value="-2" hint="" />
                  </div>
                </CardSection>
              </div>
            )}

            {scoreTab === "attacking" && (
              <CardSection title="Attacking" subtitle="Goals, assists, and milestones.">
                <div className="grid gap-4 sm:grid-cols-2">
                  <NumField label="Goal" value="6" hint="" />
                  <NumField label="Assist" value="4" hint="" />
                  <NumField label="Shot on Target" value="1" hint="" />
                  <NumField label="Key Pass" value="1" hint="" />
                  <NumField label="Brace bonus" value="4" hint="2 goals in a match." />
                  <NumField label="Hat-trick bonus" value="8" hint="" />
                  <NumField label="Penalty miss" value="-2" hint="" />
                </div>
              </CardSection>
            )}

            {scoreTab === "defending" && (
              <CardSection title="Defending" subtitle="Clean sheets and defensive actions.">
                <div className="grid gap-4 sm:grid-cols-2">
                  <NumField label="Clean Sheet (DEF, 60+ min)" value="5" hint="" />
                  <NumField label="Tackle won (max 3/match)" value="0.5 each" hint="" />
                  <NumField label="Interception (max 3/match)" value="0.5 each" hint="" />
                  <NumField label="Clearance (max 3/match)" value="0.5 each" hint="" />
                  <NumField label="Blocked Shot" value="1" hint="" />
                  <NumField label="Goals conceded (per 2)" value="-1" hint="" />
                </div>
              </CardSection>
            )}

            {scoreTab === "goalkeeping" && (
              <CardSection title="Goalkeeping" subtitle="Saves and clean sheets.">
                <div className="grid gap-4 sm:grid-cols-2">
                  <NumField label="Clean Sheet" value="6" hint="" />
                  <NumField label="Save" value="1" hint="" />
                  <NumField label="Penalty Save" value="5" hint="" />
                  <NumField label="Goals Conceded (per 2)" value="-1" hint="" />
                  <NumField label="High Claim (max 3)" value="1" hint="" />
                </div>
              </CardSection>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CardSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/8 bg-white/[0.03] p-6">
      <h3 className="text-lg font-bold text-white">{title}</h3>
      <p className="mb-4 text-sm text-zinc-500">{subtitle}</p>
      {children}
    </section>
  );
}

function NumField({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div>
      <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</label>
      <div className="mt-1 rounded-xl border border-white/8 bg-black/40 px-3 py-2 text-lg font-bold text-white">
        {value}
      </div>
      {hint ? <p className="mt-1 text-xs text-zinc-600">{hint}</p> : null}
    </div>
  );
}

function RosterRow({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div>
      <p className="text-sm font-semibold text-zinc-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-zinc-600">{hint}</p>
    </div>
  );
}

function MinRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/8 bg-black/30 px-4 py-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="text-xl font-bold text-white">{value}</p>
    </div>
  );
}
