"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";

interface Activity {
  id: string;
  type: string;
  actor_team_id: string | null;
  payload: Record<string, any>;
  created_at: string;
}

interface Team {
  id: string;
  name: string;
}

const ACTIVITY_ICONS: Record<string, string> = {
  trade_proposed: "🔄",
  trade_accepted: "✅",
  trade_rejected: "❌",
  trade_countered: "↩️",
  free_agent_claim: "➕",
  matchup_result: "⚽",
  draft_pick: "🎯",
};

const ACTIVITY_LABELS: Record<string, string> = {
  trade_proposed: "proposed a trade",
  trade_accepted: "accepted a trade",
  trade_rejected: "rejected a trade",
  trade_countered: "countered a trade",
  free_agent_claim: "picked up a free agent",
  matchup_result: "matchup result",
  draft_pick: "made a draft pick",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (days > 0) return days + "d ago";
  if (hrs > 0) return hrs + "h ago";
  if (mins > 0) return mins + "m ago";
  return "just now";
}

export default function ActivityPage() {
  const params = useParams();
  const leagueId = params.leagueId as string;

  const [activities, setActivities] = useState<Activity[]>([]);
  const [teams, setTeams] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [leagueId]);

  async function fetchData() {
    try {
      const [activityRes, hubRes] = await Promise.all([
        fetch("http://localhost:8000/leagues/" + leagueId + "/activity"),
        fetch("http://localhost:8000/leagues/" + leagueId + "/hub"),
      ]);
      const activityData = await activityRes.json();
      const hubData = await hubRes.json();

      setActivities(activityData);

      const teamMap: Record<string, string> = {};
      hubData.teams?.forEach((t: Team) => {
        teamMap[t.id] = t.name;
      });
      setTeams(teamMap);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function getActivityText(activity: Activity): string {
    const actor = activity.actor_team_id
      ? teams[activity.actor_team_id] ?? "A team"
      : "System";
    const label = ACTIVITY_LABELS[activity.type] ?? activity.type;
    return actor + " " + label;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <p className="text-gray-400">Loading activity...</p>
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
        <h1 className="text-xl font-bold">⚽ League Activity</h1>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        {activities.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-4">📋</p>
            <p className="text-gray-400">No activity yet.</p>
            <p className="text-gray-600 text-sm mt-1">
              Trades and picks will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {activities.map((activity) => (
              <div
                key={activity.id}
                className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4 flex items-start gap-4"
              >
                <span className="text-2xl shrink-0">
                  {ACTIVITY_ICONS[activity.type] ?? "📌"}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">
                    {getActivityText(activity)}
                  </p>
                  {activity.payload && Object.keys(activity.payload).length > 0 && (
                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                      {activity.type === "trade_proposed" && activity.payload.proposer_team_id && (
                        "Trade between " +
                        (teams[activity.payload.proposer_team_id] ?? "Unknown") +
                        " and " +
                        (teams[activity.payload.receiver_team_id] ?? "Unknown")
                      )}
                    </p>
                  )}
                </div>
                <span className="text-xs text-gray-500 shrink-0">
                  {timeAgo(activity.created_at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}