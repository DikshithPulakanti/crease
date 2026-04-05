"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";

export default function JoinLeaguePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#0a0a0f] text-zinc-500">
          Loading…
        </div>
      }
    >
      <JoinLeagueInner />
    </Suspense>
  );
}

function JoinLeagueInner() {
  const { user } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Pre-fill from invite link if present
  const [leagueId, setLeagueId] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [teamName, setTeamName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const league = searchParams.get("league");
    const code = searchParams.get("code");
    if (league) setLeagueId(league);
    if (code) setInviteCode(code);
  }, [searchParams]);

  const fromLink = !!searchParams.get("league");

  async function handleSubmit() {
    if (!leagueId || !inviteCode || !teamName) {
      setError("Please fill in all fields");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`http://localhost:8000/leagues/${leagueId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invite_code: inviteCode,
          user_id: user?.id,
          team_name: teamName,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to join league");

      router.push(`/leagues/${leagueId}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">

      {/* Header */}
      <header className="border-b border-white/5 px-6 py-4 flex items-center gap-4">
        <button onClick={() => router.push("/dashboard")} className="text-gray-400 hover:text-white transition text-sm">
          ← Back
        </button>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
            <span className="text-[10px] font-black text-black">C</span>
          </div>
          <span className="font-bold tracking-tight">Crease</span>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-6 py-16">

        <div className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-3xl mb-6">
          ⚡
        </div>

        <h1 className="text-3xl font-black mb-2">Join a League</h1>
        <p className="text-gray-400 mb-10">
          {fromLink
            ? "You've been invited! Just set your team name and you're in."
            : "Enter the invite link details below to join an existing league."}
        </p>

        <div className="bg-white/3 border border-white/8 rounded-2xl p-8 space-y-5">

          {/* League ID — hidden if from link */}
          {!fromLink && (
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
                League ID
              </label>
              <input
                type="text"
                value={leagueId}
                onChange={e => setLeagueId(e.target.value)}
                placeholder="e.g. d6234129-f1bc-41be..."
                className="w-full bg-white/5 border border-white/8 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/50 transition text-sm"
              />
            </div>
          )}

          {/* Invite Code — hidden if from link */}
          {!fromLink && (
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
                Invite Code
              </label>
              <input
                type="text"
                value={inviteCode}
                onChange={e => setInviteCode(e.target.value)}
                placeholder="e.g. CL-EUQ0SDKJ"
                className="w-full bg-white/5 border border-white/8 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/50 transition text-sm"
              />
            </div>
          )}

          {/* From link confirmation */}
          {fromLink && (
            <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl px-4 py-3 text-sm text-violet-300">
              ✓ Invite link detected — league and code are ready
            </div>
          )}

          {/* Team Name */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
              Your Team Name
            </label>
            <input
              type="text"
              value={teamName}
              onChange={e => setTeamName(e.target.value)}
              placeholder="e.g. Tuchel's Revenge"
              className="w-full bg-white/5 border border-white/8 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/50 transition text-sm"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-violet-500 hover:bg-violet-400 text-white font-bold rounded-xl px-4 py-3 transition disabled:opacity-50"
          >
            {loading ? "Joining..." : "Join League"}
          </button>

        </div>
      </main>
    </div>
  );
}