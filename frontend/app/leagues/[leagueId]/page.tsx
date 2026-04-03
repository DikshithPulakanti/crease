"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";

export default function LeaguePage() {
  const { leagueId } = useParams();
  const searchParams = useSearchParams();
  const inviteCode = searchParams.get("invite");
  const { user } = useUser();

  const [copied, setCopied] = useState(false);

  function copyInviteCode() {
    if (inviteCode) {
      navigator.clipboard.writeText(inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 px-6 py-4 flex items-center gap-4">
        <a href="/dashboard" className="text-gray-400 hover:text-white transition">
          ← Dashboard
        </a>
        <h1 className="text-xl font-bold">⚽ Crease</h1>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-12">
        <h2 className="text-3xl font-bold mb-2">League Created!</h2>
        <p className="text-gray-400 mb-10">
          Share the invite code with your friends to get them to join.
        </p>

        {/* Invite Code */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
          <p className="text-sm text-gray-400 mb-2">Invite Code</p>
          <div className="flex items-center gap-4">
            <span className="text-3xl font-mono font-bold tracking-widest">
              {inviteCode}
            </span>
            <button
              onClick={copyInviteCode}
              className="bg-gray-800 hover:bg-gray-700 text-sm px-4 py-2 rounded-lg transition"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>

        {/* League ID */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
          <p className="text-sm text-gray-400 mb-2">League ID</p>
          <p className="font-mono text-sm text-gray-300">{leagueId}</p>
        </div>

        {/* Next Steps */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h3 className="font-semibold mb-4">Next Steps</h3>
          <ol className="space-y-3 text-gray-400 text-sm list-decimal list-inside">
            <li>Share the invite code with your friends</li>
            <li>Wait for everyone to join</li>
            <li>Start the draft once all teams are ready</li>
          </ol>
        </div>
      </main>
    </div>
  );
}