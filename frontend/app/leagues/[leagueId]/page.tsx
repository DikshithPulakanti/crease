"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";

interface Team {
  id: string;
  name: string;
  user_id: string;
  draft_position: number | null;
}

interface LeagueData {
  league_id: string;
  name: string;
  status: string;
  invite_code: string;
  max_teams: number;
  teams: Team[];
}

export default function LeagueHubPage() {
  const params = useParams();
  const leagueId = params.leagueId as string;
  const searchParams = useSearchParams();
  const inviteCode = searchParams.get("invite");
  const { user } = useUser();

  const [league, setLeague] = useState<LeagueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchLeague();
  }, [leagueId]);

  async function fetchLeague() {
    try {
      const res = await fetch("http://localhost:8000/leagues/" + leagueId + "/hub");
      const data = await res.json();
      setLeague(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function startDraft() {
    try {
      const res = await fetch(
        "http://localhost:8000/leagues/" + leagueId + "/start-draft",
        { method: "POST" }
      );
      if (res.ok) {
        window.location.href = "/leagues/" + leagueId + "/draft";
      }
    } catch (err) {
      console.error(err);
    }
  }

  function copyInviteCode() {
    const code = inviteCode || league?.invite_code;
    if (code) {
      navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <p className="text-gray-400">Loading league...</p>
      </div>
    );
  }

  const draftHref = "/leagues/" + leagueId + "/draft";

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <a href="/dashboard" className="text-gray-400 hover:text-white transition">
            Back
          </a>
          <h1 className="text-xl font-bold">Crease</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold">{league?.name ?? "League"}</h2>
            <p className="text-gray-400 mt-1">
              {league?.teams?.length ?? 0} of {league?.max_teams ?? "?"} teams joined
            </p>
          </div>
          <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-800 text-gray-300">
            {league?.status ?? "setup"}
          </span>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
          <p className="text-sm text-gray-400 mb-2">Invite Code</p>
          <div className="flex items-center gap-4">
            <span className="text-2xl font-mono font-bold tracking-widest">
              {inviteCode || league?.invite_code}
            </span>
            <button
              onClick={copyInviteCode}
              className="bg-gray-800 hover:bg-gray-700 text-sm px-4 py-2 rounded-lg transition"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
          <h3 className="font-semibold mb-4">
            Teams ({league?.teams?.length ?? 0})
          </h3>
          {!league?.teams?.length ? (
            <p className="text-gray-400 text-sm">No teams yet.</p>
          ) : (
            <div className="space-y-3">
              {league.teams.map((team) => (
                <div
                  key={team.id}
                  className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0"
                >
                  <div>
                    <p className="font-medium">{team.name}</p>
                    <p className="text-xs text-gray-500">
                      {team.user_id === user?.id ? "You" : "Member"}
                    </p>
                  </div>
                  {team.draft_position && (
                    <span className="text-sm text-gray-400">
                      Pick {team.draft_position}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {league?.status === "setup" && (
          <button
            onClick={startDraft}
            className="w-full bg-white text-gray-950 font-semibold rounded-xl px-6 py-4 hover:bg-gray-200 transition text-lg"
          >
            Start Draft
          </button>
        )}

        {league?.status === "drafting" && (
          <a
            href={draftHref}
            className="block w-full bg-yellow-500 text-gray-950 font-semibold rounded-xl px-6 py-4 hover:bg-yellow-400 transition text-lg text-center"
          >
            Enter Draft Room
          </a>
        )}
      </main>
    </div>
  );
}