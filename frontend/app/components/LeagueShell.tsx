"use client";

import { useEffect, useState } from "react";
import { LeagueSidebar } from "./LeagueSidebar";
import { ActivityLogPanel } from "./ActivityLogPanel";
import { DraftBoardFab } from "./DraftBoardFab";
import { apiUrl } from "@/lib/api";

export function LeagueShell({
  leagueId,
  teamNameById,
  children,
}: {
  leagueId: string;
  teamNameById?: Record<string, string>;
  children: React.ReactNode;
}) {
  const [picked, setPicked] = useState(0);
  useEffect(() => {
    let c = false;
    fetch(apiUrl(`/leagues/${leagueId}/draft`))
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!c && d?.total_picks != null) setPicked(d.total_picks);
      })
      .catch(() => {});
    return () => {
      c = true;
    };
  }, [leagueId]);

  return (
    <div className="flex min-h-screen bg-[#0a0a0f]">
      <LeagueSidebar leagueId={leagueId} />
      <div className="flex min-w-0 flex-1 flex-col md:flex-row">
        <div className="min-w-0 flex-1">{children}</div>
        <ActivityLogPanel leagueId={leagueId} teamNameById={teamNameById} />
      </div>
      <DraftBoardFab leagueId={leagueId} pickedCount={picked} />
    </div>
  );
}
