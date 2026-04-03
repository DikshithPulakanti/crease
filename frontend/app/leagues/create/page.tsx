"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";

export default function CreateLeaguePage() {
  const { user } = useUser();
  const router = useRouter();

  const [leagueName, setLeagueName] = useState("");
  const [teamName, setTeamName] = useState("");
  const [maxTeams, setMaxTeams] = useState(8);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!leagueName || !teamName) {
      setError("Please fill in all fields");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("http://localhost:8000/leagues/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: leagueName,
          max_teams: maxTeams,
          commissioner_user_id: user?.id,
          team_name: teamName,
        }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.detail || "Failed to create league");

      router.push(`/leagues/${data.league_id}?invite=${data.invite_code}`);
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
        <h1 className="text-xl font-bold">Create a League</h1>
      </header>

      <main className="max-w-lg mx-auto px-6 py-12">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 space-y-6">

          {/* League Name */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              League Name
            </label>
            <input
              type="text"
              value={leagueName}
              onChange={(e) => setLeagueName(e.target.value)}
              placeholder="e.g. The UCL Gods"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-gray-500"
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

          {/* Max Teams */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              Number of Teams (must be even)
            </label>
            <select
              value={maxTeams}
              onChange={(e) => setMaxTeams(Number(e.target.value))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-gray-500"
            >
              <option value={4}>4 teams</option>
              <option value={6}>6 teams</option>
              <option value={8}>8 teams</option>
              <option value={10}>10 teams</option>
            </select>
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
            {loading ? "Creating..." : "Create League"}
          </button>
        </div>
      </main>
    </div>
  );
}