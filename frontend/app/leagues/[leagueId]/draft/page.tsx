"use client";

import { useParams } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { apiUrl } from "@/lib/api";

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
  draft_position: number | null;
}

interface DraftState {
  status: string;
  order: string[];
  current_pick_index: number;
  total_picks: number;
  round_num: number;
  current_team_id: string;
  seconds_left: number;
  picked_player_ids: string[];
  is_complete: boolean;
}

interface DraftPick {
  team_id: string;
  player_id: string;
  pick_number: number;
  round: number;
}

const POSITION_COLORS: Record<string, string> = {
  GK: "bg-yellow-500 text-yellow-950",
  DEF: "bg-blue-500 text-blue-950",
  MID: "bg-green-500 text-green-950",
  ATT: "bg-red-500 text-red-950",
};

// Club colors mapped by club name
const CLUB_COLORS: Record<string, { border: string; bg: string; header: string }> = {
  "Arsenal":              { border: "border-red-600",    bg: "bg-red-950",    header: "bg-red-900" },
  "Liverpool":            { border: "border-rose-600",   bg: "bg-rose-950",   header: "bg-rose-900" },
  "Barcelona":            { border: "border-blue-700",   bg: "bg-blue-950",   header: "bg-blue-900" },
  "Real Madrid":          { border: "border-purple-400", bg: "bg-purple-950", header: "bg-purple-900" },
  "Bayern München":       { border: "border-orange-600", bg: "bg-orange-950", header: "bg-orange-900" },
  "Atletico Madrid":      { border: "border-red-800",    bg: "bg-red-950",    header: "bg-red-900" },
  "Paris Saint-Germain":  { border: "border-sky-600",    bg: "bg-sky-950",    header: "bg-sky-900" },
  "Sporting CP":          { border: "border-green-600",  bg: "bg-green-950",  header: "bg-green-900" },
};

const DEFAULT_CLUB_COLOR = { border: "border-gray-600", bg: "bg-gray-900", header: "bg-gray-800" };

function getClubColor(club: string) {
  return CLUB_COLORS[club] ?? DEFAULT_CLUB_COLOR;
}

// Keep these for team header columns (draft order colors)
const TEAM_COLORS = [
  "border-red-500",
  "border-blue-500",
  "border-green-500",
  "border-yellow-500",
  "border-purple-500",
  "border-pink-500",
  "border-orange-500",
  "border-teal-500",
];

export default function DraftRoomPage() {
  const params = useParams();
  const leagueId = params.leagueId as string;
  const { user } = useUser();

  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [draftState, setDraftState] = useState<DraftState | null>(null);
  const [picks, setPicks] = useState<DraftPick[]>([]);
  const [myTeamId, setMyTeamId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [posFilter, setPosFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [secondsLeft, setSecondsLeft] = useState(90);
  const [showPlayerPool, setShowPlayerPool] = useState(false);
  const [boardFromApi, setBoardFromApi] = useState<{
    teams: { id: string; name: string; draft_position: number | null; accent_index: number }[];
    picks: {
      round: number;
      pick_number: number;
      team_id: string;
      player_id: string;
      player: Player | null;
    }[];
    total_picks: number;
  } | null>(null);

  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (user?.id) {
      fetchInitialData();
      fetchDraftState();
    }
  }, [leagueId, user?.id]);

  useEffect(() => {
    if (!myTeamId) return;
    connectWebSocket();
    return () => wsRef.current?.close();
  }, [myTeamId]);

  useEffect(() => {
    if (!draftState) return;
    setSecondsLeft(Math.round(draftState.seconds_left));
    const interval = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [draftState?.current_pick_index]);

  async function fetchDraftState() {
    try {
      const res = await fetch(apiUrl(`/leagues/${leagueId}/draft-state`));
      const data = await res.json();
      setDraftState(data);
    } catch (err) {
      console.error(err);
    }
  }

  async function fetchInitialData() {
    try {
      const [playersRes, hubRes, boardRes] = await Promise.all([
        fetch(apiUrl("/players")),
        fetch(apiUrl(`/leagues/${leagueId}/hub`)),
        fetch(apiUrl(`/leagues/${leagueId}/draft`)),
      ]);
      const playersData = await playersRes.json();
      const hubData = await hubRes.json();
      const boardData = boardRes.ok ? await boardRes.json() : null;
      setPlayers(playersData);
      setTeams(hubData.teams ?? []);
      setBoardFromApi(boardData);
      const myTeam = hubData.teams?.find((t: Team) => t.user_id === user?.id);
      if (myTeam) setMyTeamId(myTeam.id);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function connectWebSocket() {
    const base = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(
      /^http/,
      "ws"
    );
    const ws = new WebSocket(`${base}/ws/draft/${leagueId}/${myTeamId}`);
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.event === "draft_state") {
        setDraftState(msg.data);
      }
      if (msg.event === "pick_made") {
        setDraftState(msg.data.draft_state);
        setPicks((prev) => [
          ...prev,
          {
            team_id: msg.data.team_id,
            player_id: msg.data.player_id,
            pick_number: msg.data.pick_number,
            round: msg.data.round,
          },
        ]);
      }
      if (msg.event === "draft_complete") {
        setDraftState((prev) => prev ? { ...prev, is_complete: true } : prev);
      }
    };
    ws.onerror = (e) => console.error("WS error", e);
    wsRef.current = ws;
  }

  function pickPlayer(playerId: string) {
    if (!wsRef.current) return;
    wsRef.current.send(JSON.stringify({ event: "make_pick", player_id: playerId }));
    setShowPlayerPool(false);
  }

  const isMyTurn = draftState?.current_team_id === myTeamId;
  const pickedIds = new Set(draftState?.picked_player_ids ?? []);
  const numTeams = teams.length || 1;
  const totalRounds = 15;

  // Build grid: grid[round][teamIndex] = pick
  const grid: (DraftPick | null)[][] = Array.from({ length: totalRounds }, () =>
    Array(numTeams).fill(null)
  );

  const sortedTeams = draftState?.order
    ? draftState.order.map((id) => teams.find((t) => t.id === id)).filter(Boolean) as Team[]
    : teams;

  picks.forEach((pick) => {
    const teamIndex = sortedTeams.findIndex((t) => t.id === pick.team_id);
    const round = pick.round - 1;
    if (teamIndex >= 0 && round >= 0 && round < totalRounds) {
      grid[round][teamIndex] = pick;
    }
  });

  const filteredPlayers = players.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.club.toLowerCase().includes(search.toLowerCase());
    const matchesPos = posFilter === "ALL" || p.position === posFilter;
    const notPicked = !pickedIds.has(p.id);
    return matchesSearch && matchesPos && notPicked;
  });

  const playerMap = Object.fromEntries(players.map((p) => [p.id, p]));

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0f] text-white">
        <p className="text-sm text-zinc-500">Loading draft room…</p>
      </div>
    );
  }

  const live =
    draftState &&
    !draftState.is_complete &&
    draftState.status !== "not_started" &&
    Array.isArray(draftState.order) &&
    draftState.order.length > 0;

  const showPostBoard =
    boardFromApi && boardFromApi.total_picks > 0 && !live;

  if (showPostBoard && boardFromApi) {
    return <PostDraftBoard leagueId={leagueId} data={boardFromApi} />;
  }

  if (draftState?.is_complete && (!boardFromApi || boardFromApi.total_picks === 0)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0f] text-white">
        <div className="text-center">
          <h2 className="mb-4 text-3xl font-bold">Draft Complete!</h2>
          <p className="mb-8 text-zinc-400">All squads have been drafted.</p>
          <a
            href={"/leagues/" + leagueId}
            className="rounded-xl bg-white px-6 py-3 font-semibold text-gray-950 transition hover:bg-zinc-200"
          >
            Go to League Hub
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-3 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-lg font-bold">Draft Board</h1>
          <p className="text-xs text-gray-400">
            {numTeams} teams × {totalRounds} rounds snake draft
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Timer */}
          <div className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold ${
            isMyTurn ? "bg-green-900 text-green-200" : "bg-gray-800 text-gray-300"
          }`}>
            <span>{isMyTurn ? "Your pick" : "Waiting..."}</span>
            <span className={`text-lg font-mono ${secondsLeft <= 10 ? "text-red-400" : ""}`}>
              {secondsLeft}s
            </span>
          </div>
          {/* My team name */}
          <div className="text-sm text-gray-400">
            {teams.find((t) => t.id === myTeamId)?.name ?? "My Team"}
          </div>
          {/* Pick button — always visible */}
          <button
            onClick={() => setShowPlayerPool(true)}
            className="bg-white text-gray-950 font-semibold px-4 py-2 rounded-lg hover:bg-gray-200 transition text-sm"
          >
            {isMyTurn ? "Make Pick" : "Browse Players"}
          </button>
        </div>
      </header>

      {/* Draft Grid */}
      <div className="flex-1 overflow-auto p-4">
        <table className="w-full border-collapse">
          {/* Team headers */}
          <thead>
            <tr>
              <th className="w-10 text-xs text-gray-600 font-normal pb-3"></th>
              {sortedTeams.map((team, i) => (
                <th key={team.id} className="pb-3 px-1">
                  <div className={`rounded-lg py-2 px-3 text-center border-t-2 ${TEAM_COLORS[i % TEAM_COLORS.length]} bg-gray-900`}>
                    <p className="text-xs text-gray-400 font-normal">#{i + 1}</p>
                    <p className={`text-sm font-semibold truncate ${
                      team.id === draftState?.current_team_id ? "text-white" : "text-gray-300"
                    }`}>
                      {team.name}
                    </p>
                    {team.id === draftState?.current_team_id && (
                      <p className="text-xs text-yellow-400">Picking...</p>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: totalRounds }, (_, roundIdx) => (
              <tr key={roundIdx}>
                {/* Round number */}
                <td className="text-xs text-gray-600 text-center pr-2 align-top pt-2">
                  {roundIdx + 1}
                </td>
                {sortedTeams.map((team, teamIdx) => {
                  const pick = grid[roundIdx][teamIdx];
                  const player = pick ? playerMap[pick.player_id] : null;
                  const isCurrentPick =
                    draftState?.current_pick_index === roundIdx * numTeams +
                      (roundIdx % 2 === 0 ? teamIdx : numTeams - 1 - teamIdx);

                  return (
                    <td key={team.id} className="px-1 py-1 align-top">
                      {player ? (
                        <div className={`rounded-lg p-2 border ${getClubColor(player.club).border} ${getClubColor(player.club).bg}`}>
                          <p className="text-xs text-gray-400 mb-1">
                            {roundIdx + 1}.{teamIdx + 1}
                          </p>
                          {player.photo_url && (
                            <img
                              src={player.photo_url}
                              alt={player.name}
                              className="w-10 h-10 rounded-full mx-auto mb-1 object-cover bg-gray-700"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = "none";
                              }}
                            />
                          )}
                          <p className="text-xs font-semibold text-center truncate">
                            {player.name.split(" ").slice(-1)[0]}
                          </p>
                          <p className="text-xs text-gray-400 text-center truncate">
                            {player.club}
                          </p>
                          <div className="flex justify-center mt-1">
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${POSITION_COLORS[player.position]}`}>
                              {player.position}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className={`rounded-lg border h-24 flex items-center justify-center ${
                          isCurrentPick
                            ? "border-yellow-500 bg-yellow-950 animate-pulse"
                            : "border-gray-800 bg-gray-900"
                        }`}>
                          {isCurrentPick && (
                            <span className="text-yellow-400 text-xs">On the clock</span>
                          )}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Player Pool Modal */}
      {showPlayerPool && (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col border border-gray-700">
            <div className="p-4 border-b border-gray-700 flex items-center justify-between">
              <h3 className="font-bold text-lg">Pick a Player</h3>
              <button
                onClick={() => setShowPlayerPool(false)}
                className="text-gray-400 hover:text-white text-xl"
              >
                x
              </button>
            </div>
            <div className="p-4 border-b border-gray-700 flex gap-3">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search players..."
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none"
                autoFocus
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
            <div className="flex-1 overflow-y-auto">
              {filteredPlayers.map((player) => (
                <div
                  key={player.id}
                  className={`flex items-center justify-between px-4 py-3 border-b border-gray-800 transition ${
                    isMyTurn ? "hover:bg-gray-800 cursor-pointer" : "cursor-default opacity-75"
                  }`}
                  onClick={() => isMyTurn && pickPlayer(player.id)}
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
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${POSITION_COLORS[player.position]}`}>
                      {player.position}
                    </span>
                    <div>
                      <p className="text-sm font-medium">{player.name}</p>
                      <p className="text-xs text-gray-500">{player.club}</p>
                    </div>
                  </div>
                  {isMyTurn ? (
                    <span className="text-xs bg-white text-gray-950 font-semibold px-3 py-1.5 rounded-lg shrink-0">
                      Pick
                    </span>
                  ) : (
                    <span className="text-xs text-gray-600 bg-gray-800 px-3 py-1.5 rounded-lg shrink-0">
                      Not your turn
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PostDraftBoard({
  leagueId,
  data,
}: {
  leagueId: string;
  data: {
    teams: { id: string; name: string; draft_position: number | null; accent_index: number }[];
    picks: {
      round: number;
      pick_number: number;
      team_id: string;
      player_id: string;
      player: Player | null;
    }[];
    total_picks: number;
  };
}) {
  const order = [...data.teams].sort(
    (a, b) => (a.draft_position ?? 999) - (b.draft_position ?? 999)
  );
  const n = order.length || 1;
  const maxR = Math.max(1, ...data.picks.map((p) => p.round));

  const grid: ({
    pick_number: number;
    round: number;
    player: Player | null;
  } | null)[][] = Array.from({ length: maxR }, () => Array(n).fill(null));

  for (const pick of data.picks) {
    const r = pick.round - 1;
    if (r < 0 || r >= maxR) continue;
    const col = order.findIndex((t) => t.id === pick.team_id);
    if (col < 0) continue;
    grid[r][col] = {
      pick_number: pick.pick_number,
      round: pick.round,
      player: pick.player,
    };
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] pb-24 text-white">
      <header className="border-b border-white/8 px-4 py-6 md:px-8">
        <h1 className="text-2xl font-bold tracking-tight">Draft Board</h1>
        <p className="text-sm text-zinc-500">
          {n} teams × {maxR} rounds snake draft · {data.total_picks} picks
        </p>
      </header>
      <div className="overflow-x-auto p-4">
        <table className="w-full min-w-[800px] border-collapse">
          <thead>
            <tr>
              <th className="w-8 pb-3 text-left text-xs font-normal text-zinc-600" />
              {order.map((t, i) => (
                <th key={t.id} className="px-1 pb-3">
                  <div
                    className={`rounded-xl border-t-2 py-2 text-center ${TEAM_COLORS[i % TEAM_COLORS.length]} border border-white/8 bg-white/[0.03]`}
                  >
                    <p className="text-xs text-zinc-500">#{i + 1}</p>
                    <p className="truncate text-sm font-semibold">{t.name}</p>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.map((row, ri) => (
              <tr key={ri}>
                <td className="align-top pt-2 text-center text-xs text-zinc-600">{ri + 1}</td>
                {row.map((cell, ci) => (
                  <td key={ci} className="p-1 align-top">
                    {cell?.player ? (
                      <div
                        className={`rounded-2xl border p-2 ${getClubColor(cell.player.club).border} ${getClubColor(cell.player.club).bg}`}
                      >
                        <p className="mb-1 text-right text-[10px] text-zinc-500">
                          {cell.round}.
                          {(cell.round - 1) % 2 === 0 ? ci + 1 : n - ci}
                        </p>
                        {cell.player.photo_url && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={cell.player.photo_url}
                            alt=""
                            className="mx-auto mb-1 h-10 w-10 rounded-full object-cover"
                          />
                        )}
                        <p className="text-center text-xs font-bold leading-tight">
                          {cell.player.name}
                        </p>
                        <span
                          className={`mt-1 flex justify-center text-[10px] font-bold ${POSITION_COLORS[cell.player.position] ?? "bg-zinc-700 text-white"} rounded px-1.5 py-0.5`}
                        >
                          {cell.player.position}
                        </span>
                      </div>
                    ) : (
                      <div className="h-24 rounded-2xl border border-dashed border-white/10 bg-zinc-900/50" />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <a
        href={`/leagues/${leagueId}`}
        className="mx-4 mt-4 inline-block rounded-2xl border border-white/8 px-6 py-3 text-sm font-bold text-zinc-300 hover:bg-white/5 md:mx-8"
      >
        ← League hub
      </a>
    </div>
  );
}