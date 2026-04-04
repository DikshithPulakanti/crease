"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";

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

const POSITION_COLORS: Record<string, string> = {
  GK: "bg-yellow-500 text-yellow-950",
  DEF: "bg-blue-500 text-blue-950",
  MID: "bg-green-500 text-green-950",
  ATT: "bg-red-500 text-red-950",
};

export default function FreeAgentsPage() {
  const params = useParams();
  const leagueId = params.leagueId as string;
  const { user } = useUser();

  const [freeAgents, setFreeAgents] = useState<Player[]>([]);
  const [mySquad, setMySquad] = useState<SquadPlayer[]>([]);
  const [myTeamId, setMyTeamId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [posFilter, setPosFilter] = useState("ALL");

  // Claim state
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [playerToDrop, setPlayerToDrop] = useState<string>("");
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);

  useEffect(() => {
    if (user?.id) fetchData();
  }, [leagueId, user?.id]);

  async function fetchData() {
    try {
      const [hubRes, faRes] = await Promise.all([
        fetch("http://localhost:8000/leagues/" + leagueId + "/hub"),
        fetch("http://localhost:8000/leagues/" + leagueId + "/free-agents"),
      ]);
      const hubData = await hubRes.json();
      const faData = await faRes.json();

      setFreeAgents(faData);

      const myTeam = hubData.teams?.find((t: any) => t.user_id === user?.id);
      if (myTeam) {
        setMyTeamId(myTeam.id);
        const squadRes = await fetch(
          "http://localhost:8000/teams/" + myTeam.id + "/squad"
        );
        const squadData = await squadRes.json();
        setMySquad(squadData);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function claimPlayer() {
    if (!myTeamId || !selectedPlayer) return;
    if (mySquad.length >= 15 && !playerToDrop) {
      alert("Your squad is full. Select a player to drop.");
      return;
    }

    setClaiming(true);
    try {
      const res = await fetch(
        "http://localhost:8000/teams/" + myTeamId + "/free-agent",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            league_id: leagueId,
            player_in_id: selectedPlayer.id,
            player_out_id: playerToDrop || "",
          }),
        }
      );

      if (res.ok) {
        setClaimed(true);
        setSelectedPlayer(null);
        setPlayerToDrop("");
        setTimeout(() => setClaimed(false), 3000);
        fetchData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setClaiming(false);
    }
  }

  const filtered = freeAgents.filter((p) => {
    const matchSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.club.toLowerCase().includes(search.toLowerCase());
    const matchPos = posFilter === "ALL" || p.position === posFilter;
    return matchSearch && matchPos;
  });

  const squadFull = mySquad.length >= 15;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <p className="text-gray-400">Loading free agents...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 px-6 py-4 flex items-center gap-4">
        <a
          href={"/leagues/" + leagueId}
          className="text-gray-400 hover:text-white transition"
        >
          ← League Hub
        </a>
        <h1 className="text-xl font-bold">⚽ Free Agents</h1>
        <span className="text-sm text-gray-400">
          {freeAgents.length} available
        </span>
      </header>

      <div className="flex h-[calc(100vh-65px)]">
        {/* Free Agent Pool */}
        <div className="flex-1 flex flex-col border-r border-gray-800">
          {/* Search + Filter */}
          <div className="p-4 border-b border-gray-800 flex gap-3">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search players..."
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none"
            />
            <div className="flex gap-1">
              {["ALL", "GK", "DEF", "MID", "ATT"].map((pos) => (
                <button
                  key={pos}
                  onClick={() => setPosFilter(pos)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition ${
                    posFilter === pos
                      ? "bg-white text-gray-950"
                      : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                  }`}
                >
                  {pos}
                </button>
              ))}
            </div>
          </div>

          {/* Player List */}
          <div className="flex-1 overflow-y-auto">
            {filtered.map((player) => (
              <div
                key={player.id}
                onClick={() => setSelectedPlayer(player)}
                className={`flex items-center justify-between px-4 py-3 border-b border-gray-800 cursor-pointer transition ${
                  selectedPlayer?.id === player.id
                    ? "bg-gray-800"
                    : "hover:bg-gray-900"
                }`}
              >
                <div className="flex items-center gap-3">
                  {player.photo_url && (
                    <img
                      src={player.photo_url}
                      alt={player.name}
                      className="w-8 h-8 rounded-full object-cover bg-gray-700"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  )}
                  <span
                    className={`text-xs px-2 py-0.5 rounded font-medium ${POSITION_COLORS[player.position]}`}
                  >
                    {player.position}
                  </span>
                  <div>
                    <p className="text-sm font-medium">{player.name}</p>
                    <p className="text-xs text-gray-500">{player.club}</p>
                  </div>
                </div>
                <span className="text-xs text-gray-500">
                  {selectedPlayer?.id === player.id ? "Selected" : "Click to select"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Claim Panel */}
        <div className="w-80 flex flex-col p-6 gap-4">
          <h2 className="font-bold text-lg">Claim Player</h2>

          {/* Selected player */}
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
            <p className="text-xs text-gray-400 mb-2">Adding</p>
            {selectedPlayer ? (
              <div className="flex items-center gap-3">
                {selectedPlayer.photo_url && (
                  <img
                    src={selectedPlayer.photo_url}
                    alt={selectedPlayer.name}
                    className="w-10 h-10 rounded-full object-cover bg-gray-700"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                )}
                <div>
                  <p className="font-semibold text-sm">{selectedPlayer.name}</p>
                  <p className="text-xs text-gray-400">{selectedPlayer.club}</p>
                </div>
              </div>
            ) : (
              <p className="text-gray-500 text-sm">
                Select a player from the list
              </p>
            )}
          </div>

          {/* Drop player */}
          {squadFull && (
            <div>
              <p className="text-xs text-gray-400 mb-2">
                Drop (squad is full — must drop one)
              </p>
              <select
                value={playerToDrop}
                onChange={(e) => setPlayerToDrop(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
              >
                <option value="">Select player to drop...</option>
                {mySquad.map((s) => (
                  <option key={s.player_id} value={s.player_id}>
                    {s.player.name} ({s.player.position})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* My squad size */}
          <p className="text-xs text-gray-500">
            My squad: {mySquad.length}/15
          </p>

          {/* Claim button */}
          <button
            onClick={claimPlayer}
            disabled={
              !selectedPlayer ||
              claiming ||
              (squadFull && !playerToDrop)
            }
            className="w-full bg-white text-gray-950 font-semibold rounded-xl px-4 py-3 hover:bg-gray-200 transition disabled:opacity-40"
          >
            {claimed
              ? "Claimed!"
              : claiming
              ? "Claiming..."
              : "Claim Player"}
          </button>
        </div>
      </div>
    </div>
  );
}