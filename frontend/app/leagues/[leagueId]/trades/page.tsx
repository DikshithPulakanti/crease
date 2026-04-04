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

interface Team {
  id: string;
  name: string;
  user_id: string;
}

interface SquadPlayer {
  player_id: string;
  player: Player;
}

interface Trade {
  id: string;
  proposer_team_id: string;
  receiver_team_id: string;
  proposer_player_id: string;
  receiver_player_id: string;
  status: string;
  expires_at: string;
}

const POSITION_COLORS: Record<string, string> = {
  GK: "bg-yellow-500 text-yellow-950",
  DEF: "bg-blue-500 text-blue-950",
  MID: "bg-green-500 text-green-950",
  ATT: "bg-red-500 text-red-950",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-900 text-yellow-300",
  accepted: "bg-green-900 text-green-300",
  rejected: "bg-red-900 text-red-300",
  countered: "bg-blue-900 text-blue-300",
  expired: "bg-gray-800 text-gray-400",
};

export default function TradesPage() {
  const params = useParams();
  const leagueId = params.leagueId as string;
  const { user } = useUser();

  const [myTeam, setMyTeam] = useState<Team | null>(null);
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [mySquad, setMySquad] = useState<SquadPlayer[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [allPlayers, setAllPlayers] = useState<Record<string, Player>>({});
  const [allSquads, setAllSquads] = useState<Record<string, SquadPlayer[]>>({});
  const [loading, setLoading] = useState(true);

  // Propose trade state
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [myPlayerOffer, setMyPlayerOffer] = useState<string>("");
  const [theirPlayerRequest, setTheirPlayerRequest] = useState<string>("");
  const [proposing, setProposing] = useState(false);
  const [proposed, setProposed] = useState(false);

  useEffect(() => {
    if (user?.id) fetchData();
  }, [leagueId, user?.id]);

  async function fetchData() {
    try {
      const hubRes = await fetch("http://localhost:8000/leagues/" + leagueId + "/hub");
      const hubData = await hubRes.json();

      const me = hubData.teams?.find((t: Team) => t.user_id === user?.id);
      setMyTeam(me ?? null);
      setAllTeams(hubData.teams ?? []);

      if (me) {
        const [squadRes, tradesRes] = await Promise.all([
          fetch("http://localhost:8000/teams/" + me.id + "/squad"),
          fetch("http://localhost:8000/teams/" + me.id + "/trades"),
        ]);
        const squadData = await squadRes.json();
        const tradesData = await tradesRes.json();
        setMySquad(squadData);
        setTrades(tradesData);

        const playerMap: Record<string, Player> = {};
        squadData.forEach((s: SquadPlayer) => {
          playerMap[s.player_id] = s.player;
        });

        // Fetch other teams squads for player lookup
        const otherTeams = hubData.teams?.filter((t: Team) => t.id !== me.id) ?? [];
        const squadPromises = otherTeams.map((t: Team) =>
          fetch("http://localhost:8000/teams/" + t.id + "/squad")
            .then((r) => r.json())
            .then((data) => ({ teamId: t.id, squad: data }))
        );
        const otherSquads = await Promise.all(squadPromises);
        const squadsMap: Record<string, SquadPlayer[]> = {};
        otherSquads.forEach(({ teamId, squad }) => {
          squadsMap[teamId] = squad;
          squad.forEach((s: SquadPlayer) => {
            playerMap[s.player_id] = s.player;
          });
        });
        setAllSquads(squadsMap);
        setAllPlayers(playerMap);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function proposeTrade() {
    if (!myTeam || !selectedTeam || !myPlayerOffer || !theirPlayerRequest) return;
    setProposing(true);
    try {
      const res = await fetch("http://localhost:8000/teams/" + myTeam.id + "/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          league_id: leagueId,
          receiver_team_id: selectedTeam.id,
          proposer_player_id: myPlayerOffer,
          receiver_player_id: theirPlayerRequest,
        }),
      });
      if (res.ok) {
        setProposed(true);
        setMyPlayerOffer("");
        setTheirPlayerRequest("");
        setSelectedTeam(null);
        setTimeout(() => setProposed(false), 3000);
        fetchData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setProposing(false);
    }
  }

  async function handleTradeAction(tradeId: string, action: string) {
    if (!myTeam) return;
    try {
      await fetch("http://localhost:8000/teams/" + myTeam.id + "/trades/" + tradeId + "/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  }

  const incomingTrades = trades.filter(
    (t) => t.receiver_team_id === myTeam?.id && t.status === "pending"
  );
  const outgoingTrades = trades.filter((t) => t.proposer_team_id === myTeam?.id);

  const teamName = (id: string) =>
    allTeams.find((t) => t.id === id)?.name ?? "Unknown";

  const playerName = (id: string) =>
    allPlayers[id]?.name ?? "Unknown Player";

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <p className="text-gray-400">Loading trades...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 px-6 py-4 flex items-center gap-4">
        <a href={"/leagues/" + leagueId} className="text-gray-400 hover:text-white transition">
          ← League Hub
        </a>
        <h1 className="text-xl font-bold">⚽ Trades</h1>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-8">

        {/* Propose Trade */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-bold mb-4">Propose a Trade</h2>

          {/* Select team */}
          <div className="mb-4">
            <label className="text-sm text-gray-400 mb-2 block">Select opponent team</label>
            <div className="flex gap-2 flex-wrap">
              {allTeams
                .filter((t) => t.id !== myTeam?.id)
                .map((team) => (
                  <button
                    key={team.id}
                    onClick={() => {
                      setSelectedTeam(team);
                      setTheirPlayerRequest("");
                    }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                      selectedTeam?.id === team.id
                        ? "bg-white text-gray-950"
                        : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                    }`}
                  >
                    {team.name}
                  </button>
                ))}
            </div>
          </div>

          {selectedTeam && (
            <div className="grid grid-cols-2 gap-4 mb-4">
              {/* My player to offer */}
              <div>
                <label className="text-sm text-gray-400 mb-2 block">
                  Your player to offer
                </label>
                <select
                  value={myPlayerOffer}
                  onChange={(e) => setMyPlayerOffer(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                >
                  <option value="">Select player...</option>
                  {mySquad.map((s) => (
                    <option key={s.player_id} value={s.player_id}>
                      {s.player.name} ({s.player.position})
                    </option>
                  ))}
                </select>
              </div>

              {/* Their player to request */}
              <div>
                <label className="text-sm text-gray-400 mb-2 block">
                  Their player you want
                </label>
                <select
                  value={theirPlayerRequest}
                  onChange={(e) => setTheirPlayerRequest(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                >
                  <option value="">Select player...</option>
                  {(allSquads[selectedTeam.id] ?? []).map((s) => (
                    <option key={s.player_id} value={s.player_id}>
                      {s.player.name} ({s.player.position})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <button
            onClick={proposeTrade}
            disabled={!selectedTeam || !myPlayerOffer || !theirPlayerRequest || proposing}
            className="w-full bg-white text-gray-950 font-semibold rounded-lg px-4 py-3 hover:bg-gray-200 transition disabled:opacity-40"
          >
            {proposed ? "Trade Proposed!" : proposing ? "Sending..." : "Send Trade Proposal"}
          </button>
        </div>

        {/* Incoming Trades */}
        {incomingTrades.length > 0 && (
          <div>
            <h2 className="text-lg font-bold mb-3">
              Incoming Trades ({incomingTrades.length})
            </h2>
            <div className="space-y-3">
              {incomingTrades.map((trade) => (
                <div
                  key={trade.id}
                  className="bg-gray-900 border border-yellow-700 rounded-xl p-5"
                >
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm text-gray-400">
                      From <span className="text-white font-semibold">{teamName(trade.proposer_team_id)}</span>
                    </p>
                    <span className="text-xs text-yellow-400 bg-yellow-900 px-2 py-1 rounded">
                      Pending
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mb-4 text-center">
                    <div className="bg-gray-800 rounded-lg p-3">
                      <p className="text-xs text-gray-400 mb-1">They offer</p>
                      <p className="text-sm font-semibold">{playerName(trade.proposer_player_id)}</p>
                      <p className="text-xs text-gray-500">{allPlayers[trade.proposer_player_id]?.club}</p>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-3">
                      <p className="text-xs text-gray-400 mb-1">They want</p>
                      <p className="text-sm font-semibold">{playerName(trade.receiver_player_id)}</p>
                      <p className="text-xs text-gray-500">{allPlayers[trade.receiver_player_id]?.club}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleTradeAction(trade.id, "accept")}
                      className="flex-1 bg-green-700 hover:bg-green-600 text-white text-sm font-semibold py-2 rounded-lg transition"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => handleTradeAction(trade.id, "reject")}
                      className="flex-1 bg-red-900 hover:bg-red-800 text-red-300 text-sm font-semibold py-2 rounded-lg transition"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Outgoing Trades */}
        {outgoingTrades.length > 0 && (
          <div>
            <h2 className="text-lg font-bold mb-3">My Trade History</h2>
            <div className="space-y-3">
              {outgoingTrades.map((trade) => (
                <div
                  key={trade.id}
                  className="bg-gray-900 border border-gray-700 rounded-xl p-5"
                >
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm text-gray-400">
                      To <span className="text-white font-semibold">{teamName(trade.receiver_team_id)}</span>
                    </p>
                    <span className={`text-xs px-2 py-1 rounded ${STATUS_COLORS[trade.status]}`}>
                      {trade.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div className="bg-gray-800 rounded-lg p-3">
                      <p className="text-xs text-gray-400 mb-1">You offered</p>
                      <p className="text-sm font-semibold">{playerName(trade.proposer_player_id)}</p>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-3">
                      <p className="text-xs text-gray-400 mb-1">You wanted</p>
                      <p className="text-sm font-semibold">{playerName(trade.receiver_player_id)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {trades.length === 0 && incomingTrades.length === 0 && (
          <p className="text-gray-500 text-sm text-center py-8">
            No trades yet. Propose one above!
          </p>
        )}
      </main>
    </div>
  );
}