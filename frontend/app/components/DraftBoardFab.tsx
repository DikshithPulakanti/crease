"use client";

import Link from "next/link";

export function DraftBoardFab({
  leagueId,
  pickedCount,
}: {
  leagueId: string;
  pickedCount: number;
}) {
  return (
    <Link
      href={`/leagues/${leagueId}/draft`}
      className="fixed bottom-20 right-4 z-40 flex items-center gap-2 rounded-2xl border border-violet-500/50 bg-gradient-to-r from-violet-600/90 to-violet-500/90 px-4 py-3 text-sm font-bold tracking-tight text-white shadow-lg shadow-violet-900/40 md:bottom-6"
    >
      <span>Draft Board</span>
      <span className="rounded-full bg-black/30 px-2 py-0.5 text-xs font-semibold">{pickedCount} Picked</span>
    </Link>
  );
}
