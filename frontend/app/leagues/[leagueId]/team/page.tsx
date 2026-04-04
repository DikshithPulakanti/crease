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

const POSITION_ORDER = ["GK", "DEF", "MID", "ATT"];

export default function TeamPage() {
  const params = useParams();
  const leagueId = params.leagueId as string;
  const { user } = useUser();

  const [squad, setSquad] = useState<SquadPlayer[]>([]);
  const [starting11, setStarting11] = useState<Set<string>>(new Set());
  const [captain, setCaptain] = useState<string | null>(null);
  const [viceCaptain, setViceCaptain] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [myTeamId, setMyTeamId] = useState<string | null>(null);

  useEffect(() => {
    if (user?.id) fetchSquad();
  }, [leagueId, user?.id]);

  async function fetchSquad() {
    try {
      const hubRes = await fetch(
        "http://localhost:8000/leagues/" + leagueId + "/hub"
      );
      const hubData = await hubRes.json();
      const myTeam = hubData.teams?.find((t: any) => t.user_id === user?.id);
      if (!myTeam) return;
      setMyTeamId(myTeam.id);

      const squadRes = await fetch(
        "http://localhost:8000/teams/" + myTeam.id + "/squad"
      );
      const squadData = await squadRes.json();
      setSquad(squadData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function toggleStarting(playerId: string) {
    setStarting11((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) {
        next.delete(playerId);
        if (captain === playerId) setCaptain(null);
        if (viceCaptain === playerId) setViceCaptain(null);
      } else {
        if (next.size >= 11) return prev;
        next.add(playerId);
      }
      return next;
    });
  }

  function setCaptainOrVC(playerId: string) {
    if (!starting11.has(playerId)) return;
    if (captain === playerId) {
      setCaptain(null);
    } else if (viceCaptain === playerId) {
      setViceCaptain(null);
    } else if (!captain) {
      setCaptain(playerId);
    } else if (!viceCaptain) {
      setViceCaptain(playerId);
    } else {
      setCaptain(playerId);
    }
  }

  async function saveSelection() {
    if (starting11.size !== 11) {
      alert("Please select exactly 11 players");
      return;
    }
    if (!captain) {
      alert("Please select a captain");
      return;
    }
    if (!viceCaptain) {
      alert("Please select a vice captain");
      return;
    }

    setSaving(true);
    try {
      await fetch("http://localhost:8000/teams/" + myTeamId + "/selection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          starting_11: Array.from(starting11),
          captain_id: captain,
          vice_captain_id: viceCaptain,
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  const sortedSquad = [...squad].sort((a, b) => {
    return (
      POSITION_ORDER.indexOf(a.player.position) -
      POSITION_ORDER.indexOf(b.player.position)
    );
  });

  const startingPlayers = sortedSquad.filter((s) =>
    starting11.has(s.player_id)
  );
  const benchPlayers = sortedSquad.filter(
    (s) => !starting11.has(s.player_id)
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <p className="text-gray-400">Loading squad...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <a
            href={"/leagues/" + leagueId}
            className="text-gray-400 hover:text-white transition"
          >
            ← League Hub
          </a>
          <h1 className="text-xl font-bold">⚽ My Team</h1>
        </div>
        <button
          onClick={saveSelection}
          disabled={saving}
          className={`px-5 py-2 rounded-lg font-semibold text-sm transition ${
            saved
              ? "bg-green-600 text-white"
              : "bg-white text-gray-950 hover:bg-gray-200"
          } disabled:opacity-50`}
        >
          {saved ? "Saved!" : saving ? "Saving..." : "Save Selection"}
        </button>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Captain & Vice Captain selectors */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-yellow-400 text-lg">♛</span>
              <span className="text-yellow-400 font-bold text-sm">CAPTAIN</span>
              <span className="text-gray-500 text-xs">(2× pts)</span>
            </div>
            <select
              value={captain ?? ""}
              onChange={(e) => setCaptain(e.target.value || null)}
              className="w-full bg-yellow-950 border border-yellow-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-yellow-500"
            >
              <option value="">Select captain...</option>
              {sortedSquad
                .filter((s) => starting11.has(s.player_id))
                .map((s) => (
                  <option key={s.player_id} value={s.player_id}>
                    {s.player.name}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-blue-400 text-lg">🛡</span>
              <span className="text-blue-400 font-bold text-sm">VICE CAPTAIN</span>
              <span className="text-gray-500 text-xs">(1.5× pts)</span>
            </div>
            <select
              value={viceCaptain ?? ""}
              onChange={(e) => setViceCaptain(e.target.value || null)}
              className="w-full bg-blue-950 border border-blue-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="">Select vice captain...</option>
              {sortedSquad
                .filter((s) => starting11.has(s.player_id) && s.player_id !== captain)
                .map((s) => (
                  <option key={s.player_id} value={s.player_id}>
                    {s.player.name}
                  </option>
                ))}
            </select>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6 text-sm text-gray-400">
          <p>Click <span className="text-white font-semibold">Add</span> to move players to your starting 11. Starting: <span className="text-white">{starting11.size}/11</span></p>
        </div>

        {/* Starting 11 */}
        <h2 className="text-lg font-semibold mb-3">
          Starting 11 ({startingPlayers.length}/11)
        </h2>
        <div className="space-y-2 mb-8">
          {startingPlayers.length === 0 ? (
            <p className="text-gray-500 text-sm">
              Click players from your squad below to add them to your starting 11.
            </p>
          ) : (
            startingPlayers.map((s) => (
              <PlayerRow
                key={s.player_id}
                player={s.player}
                isStarting={true}
                isCaptain={captain === s.player_id}
                isViceCaptain={viceCaptain === s.player_id}
                onToggle={() => toggleStarting(s.player_id)}
              />
            ))
          )}
        </div>

        {/* Bench */}
        <h2 className="text-lg font-semibold mb-3">
          Bench ({benchPlayers.length})
        </h2>
        <div className="space-y-2">
          {          benchPlayers.map((s) => (
            <PlayerRow
              key={s.player_id}
              player={s.player}
              isStarting={false}
              isCaptain={false}
              isViceCaptain={false}
              onToggle={() => toggleStarting(s.player_id)}
            />
          ))}
        </div>
      </main>
    </div>
  );
}

function PlayerRow({
  player,
  isStarting,
  isCaptain,
  isViceCaptain,
  onToggle,
}: {
  player: Player;
  isStarting: boolean;
  isCaptain: boolean;
  isViceCaptain: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={`flex items-center justify-between px-4 py-3 rounded-xl border transition ${
        isStarting
          ? "bg-gray-900 border-gray-600"
          : "bg-gray-950 border-gray-800 opacity-70"
      }`}
    >
      <div className="flex items-center gap-3">
        {player.photo_url && (
          <img
            src={player.photo_url}
            alt={player.name}
            className="w-9 h-9 rounded-full object-cover bg-gray-700"
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
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">{player.name}</p>
            {isCaptain && (
              <span className="text-xs bg-yellow-500 text-yellow-950 font-bold px-1.5 py-0.5 rounded">C</span>
            )}
            {isViceCaptain && (
              <span className="text-xs bg-blue-500 text-blue-950 font-bold px-1.5 py-0.5 rounded">VC</span>
            )}
          </div>
          <p className="text-xs text-gray-500">{player.club}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onToggle}
          className={`text-xs px-3 py-1.5 rounded-lg font-medium transition ${
            isStarting
              ? "bg-red-900 text-red-300 hover:bg-red-800"
              : "bg-gray-800 text-gray-300 hover:bg-gray-700"
          }`}
        >
          {isStarting ? "Remove" : "Add"}
        </button>
      </div>
    </div>
  );
}