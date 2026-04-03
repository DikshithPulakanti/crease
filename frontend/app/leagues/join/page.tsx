"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";

export default function JoinLeaguePage() {
  const { user } = useUser();
  const router = useRouter();

  const [leagueId, setLeagueId] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [teamName, setTeamName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 px-6 py-4 flex items-center gap-4">
        <button
          onClick={() => router.push("/dashboard")}
          className="text-gray-400 hover:text-white transition"
        >
          ← Back
        </button>
        <h1 className="text-xl font-bold">Join a League</h1>
      </header>

      <main className="max-w-lg mx-auto px-6 py-12">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 space-y-6">

          {/* League ID */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              League ID
            </label>
            <input
              type="text"
              value={leagueId}
              onChange={(e) => setLeagueId(e.target.value)}
              placeholder="e.g. d6234129-f1bc-41be-9744-8a33745212dd"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-gray-500"
            />
          </div>

          {/* Invite Code */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              Invite Code
            </label>
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              placeholder="e.g. CL-I5YVQO5T"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-gray-500 font-mono"
            />
          </div>

          {/* Team Name */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              Your Team Name
            </label>
            <input
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="e.g. Tuchel's Revenge"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-gray-500"
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-white text-gray-950 font-semibold rounded-lg px-4 py-3 hover:bg-gray-200 transition disabled:opacity-50"
          >
            {loading ? "Joining..." : "Join League"}
          </button>
        </div>
      </main>
    </div>
  );
}