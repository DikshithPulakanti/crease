"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";

interface PlayerBreakdown {
  player_id: string;
  player_name: string;
  position: string;
  club: string;
  is_captain: boolean;
  is_vice_captain: boolean;
  base_points: number;
  multiplier: number;
  final_points: number;
  stats_breakdown: Record<string, number>;
}

interface MatchupData {
  id: string;
  home_team_id: string;
  away_team_id: string;
  home_score: number;
  away_score: number;
  result: string | null;
  home_players: PlayerBreakdown[];
  away_players: PlayerBreakdown[];
}

interface Team {
  id: string;
  name: string;
  user_id: string;
  standings_points: number;
}

interface Gameweek {
  id: string;
  number: number;
  label: string;
  status: string;
}

const POSITION_COLORS: Record<string, string> = {
  GK: "bg-yellow-500 text-yellow-950",
  DEF: "bg-blue-500 text-blue-950",
  MID: "bg-green-500 text-green-950",
  ATT: "bg-red-500 text-red-950",
};

export default function MatchupPage() {
  const params = useParams();
  const leagueId = params.leagueId as string;
  const { user } = useUser();

  const [teams, setTeams] = useState<Team[]>([]);
  const [gameweeks, setGameweeks] = useState<Gameweek[]>([]);
  const [selectedGameweek, setSelectedGameweek] = useState<string>("");
  const [matchup, setMatchup] = useState<MatchupData | null>(null);
  const [myTeamId, setMyTeamId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMatchup, setLoadingMatchup] = useState(false);

  useEffect(() => {
    if (user?.id) fetchInitialData();
  }, [leagueId, user?.id]);

  useEffect(() => {
    if (selectedGameweek && myTeamId) fetchMatchup();
  }, [selectedGameweek, myTeamId]);

  async function fetchInitialData() {
    try {
      const [hubRes, gwRes] = await Promise.all([
        fetch("http://localhost:8000/leagues/" + leagueId + "/hub"),
        fetch("http://localhost:8000/leagues/" + leagueId + "/gameweeks"),
      ]);
      const hubData = await hubRes.json();
      const gwData = await gwRes.json();

      setTeams(hubData.teams ?? []);

      const me = hubData.teams?.find((t: Team) => t.user_id === user?.id);
      if (me) setMyTeamId(me.id);

      const gws = Array.isArray(gwData) ? gwData : [];
      setGameweeks(gws);

      if (gws.length > 0) {
        const active = gws.find((g: Gameweek) => g.status === "scoring" || g.status === "complete");
        setSelectedGameweek(active?.id ?? gws[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchMatchup() {
    if (!myTeamId || !selectedGameweek) return;
    setLoadingMatchup(true);
    try {
      const res = await fetch(
        "http://localhost:8000/leagues/" + leagueId + "/matchup/" + selectedGameweek + "/" + myTeamId
      );
      const data = await res.json();
      setMatchup(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMatchup(false);
    }
  }

  const teamName = (id: string) => teams.find((t) => t.id === id)?.name ?? "Unknown";
  const isHome = matchup?.home_team_id === myTeamId;
  const myScore = isHome ? matchup?.home_score : matchup?.away_score;
  const oppScore = isHome ? matchup?.away_score : matchup?.home_score;
  const oppTeamId = isHome ? matchup?.away_team_id : matchup?.home_team_id;
  const myPlayers = isHome ? matchup?.home_players : matchup?.away_players;
  const oppPlayers = isHome ? matchup?.away_players : matchup?.home_players;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <p className="text-gray-400">Loading matchup...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 px-6 py-4 flex items-center gap-4">
        <a href={"/leagues/" + leagueId} className="text-gray-400 hover:text-white transition">
          ← League Hub
        </a>
        <h1 className="text-xl font-bold">⚽ Matchup</h1>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">

        {/* Gameweek selector */}
        {gameweeks.length > 0 && (
          <div className="flex gap-2 mb-8 flex-wrap">
            {gameweeks.map((gw) => (
              <button
                key={gw.id}
                onClick={() => setSelectedGameweek(gw.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  selectedGameweek === gw.id
                    ? "bg-white text-gray-950"
                    : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                }`}
              >
                {gw.label}
              </button>
            ))}
          </div>
        )}

        {/* No gameweeks yet */}
        {gameweeks.length === 0 && (
          <div className="text-center py-16">
            <p className="text-4xl mb-4">📅</p>
            <p className="text-gray-400">No gameweeks set up yet.</p>
            <p className="text-gray-600 text-sm mt-1">
              Gameweeks will appear here once the commissioner sets them up.
            </p>
          </div>
        )}

        {/* Matchup Scoreboard */}
        {matchup && !loadingMatchup && (
          <>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-8">
              <div className="grid grid-cols-3 items-center text-center">
                {/* My team */}
                <div>
                  <p className="text-lg font-bold">{myTeamId ? teamName(myTeamId) : "My Team"}</p>
                  <p className="text-xs text-gray-400 mt-1">You</p>
                </div>

                {/* Score */}
                <div>
                  <div className="flex items-center justify-center gap-4">
                    <span className={`text-4xl font-bold ${
                      (myScore ?? 0) > (oppScore ?? 0) ? "text-green-400" :
                      (myScore ?? 0) < (oppScore ?? 0) ? "text-red-400" :
                      "text-white"
                    }`}>
                      {myScore ?? 0}
                    </span>
                    <span className="text-gray-600 text-2xl">—</span>
                    <span className={`text-4xl font-bold ${
                      (oppScore ?? 0) > (myScore ?? 0) ? "text-green-400" :
                      (oppScore ?? 0) < (myScore ?? 0) ? "text-red-400" :
                      "text-white"
                    }`}>
                      {oppScore ?? 0}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    {matchup.result === null ? "In progress" :
                     matchup.result === "draw" ? "Draw" :
                     (isHome && matchup.result === "home") || (!isHome && matchup.result === "away")
                       ? "You won" : "You lost"}
                  </p>
                </div>

                {/* Opponent */}
                <div>
                  <p className="text-lg font-bold">{oppTeamId ? teamName(oppTeamId) : "Opponent"}</p>
                  <p className="text-xs text-gray-400 mt-1">Opponent</p>
                </div>
              </div>
            </div>

            {/* Player Breakdowns */}
            <div className="grid grid-cols-2 gap-6">
              {/* My players */}
              <div>
                <h3 className="font-semibold mb-3 text-sm text-gray-400">
                  {myTeamId ? teamName(myTeamId) : "My Team"}
                </h3>
                <div className="space-y-2">
                  {(myPlayers ?? []).map((p) => (
                    <PlayerScoreRow key={p.player_id} player={p} />
                  ))}
                </div>
              </div>

              {/* Opponent players */}
              <div>
                <h3 className="font-semibold mb-3 text-sm text-gray-400">
                  {oppTeamId ? teamName(oppTeamId) : "Opponent"}
                </h3>
                <div className="space-y-2">
                  {(oppPlayers ?? []).map((p) => (
                    <PlayerScoreRow key={p.player_id} player={p} />
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {loadingMatchup && (
          <div className="text-center py-16">
            <p className="text-gray-400">Loading matchup data...</p>
          </div>
        )}

        {!matchup && !loadingMatchup && selectedGameweek && (
          <div className="text-center py-16">
            <p className="text-4xl mb-4">⚽</p>
            <p className="text-gray-400">No matchup found for this gameweek.</p>
            <p className="text-gray-600 text-sm mt-1">
              Matchups are generated when the gameweek starts.
            </p>
          </div>
        )}

        {/* Standings */}
        <div className="mt-10">
          <h2 className="text-lg font-bold mb-4">Standings</h2>
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium">Team</th>
                  <th className="text-right px-4 py-3 text-xs text-gray-400 font-medium">Points</th>
                </tr>
              </thead>
              <tbody>
                {[...teams]
                  .sort((a, b) => (b.standings_points ?? 0) - (a.standings_points ?? 0))
                  .map((team, i) => (
                    <tr
                      key={team.id}
                      className={`border-b border-gray-800 last:border-0 ${
                        team.id === myTeamId ? "bg-gray-800" : ""
                      }`}
                    >
                      <td className="px-4 py-3 text-sm">
                        <span className="text-gray-500 mr-3">{i + 1}</span>
                        {team.name}
                        {team.id === myTeamId && (
                          <span className="ml-2 text-xs text-gray-500">(You)</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-bold">
                        {team.standings_points ?? 0}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

function PlayerScoreRow({ player }: { player: PlayerBreakdown }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden cursor-pointer"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
            { GK: "bg-yellow-500 text-yellow-950",
              DEF: "bg-blue-500 text-blue-950",
              MID: "bg-green-500 text-green-950",
              ATT: "bg-red-500 text-red-950" }[player.position] ?? "bg-gray-700 text-gray-300"
          }`}>
            {player.position}
          </span>
          <span className="text-sm font-medium">{player.player_name}</span>
          {player.is_captain && (
            <span className="text-xs bg-yellow-500 text-yellow-950 font-bold px-1.5 py-0.5 rounded">C</span>
          )}
          {player.is_vice_captain && (
            <span className="text-xs bg-blue-500 text-blue-950 font-bold px-1.5 py-0.5 rounded">VC</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {player.multiplier > 1 && (
            <span className="text-xs text-gray-500">{player.multiplier}×</span>
          )}
          <span className="text-sm font-bold text-white">{player.final_points}</span>
        </div>
      </div>

      {/* Expanded stats breakdown */}
      {expanded && Object.keys(player.stats_breakdown).length > 0 && (
        <div className="border-t border-gray-800 px-3 py-2 bg-gray-950">
          {Object.entries(player.stats_breakdown).map(([key, val]) => (
            <div key={key} className="flex justify-between text-xs py-0.5">
              <span className="text-gray-400 capitalize">{key.replace(/_/g, " ")}</span>
              <span className={val > 0 ? "text-green-400" : "text-red-400"}>
                {val > 0 ? "+" : ""}{val}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}