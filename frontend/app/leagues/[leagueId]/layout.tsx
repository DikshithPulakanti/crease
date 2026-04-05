import { LeagueShell } from "@/app/components/LeagueShell";
import { apiUrl } from "@/lib/api";

async function teamNameMap(leagueId: string): Promise<Record<string, string>> {
  try {
    const res = await fetch(apiUrl(`/leagues/${leagueId}/hub`), {
      next: { revalidate: 15 },
    });
    if (!res.ok) return {};
    const data = (await res.json()) as { teams?: { id: string; name: string }[] };
    const map: Record<string, string> = {};
    for (const t of data.teams ?? []) {
      map[t.id] = t.name;
    }
    return map;
  } catch {
    return {};
  }
}

export default async function LeagueLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;
  const teamNameById = await teamNameMap(leagueId);
  return (
    <LeagueShell leagueId={leagueId} teamNameById={teamNameById}>
      {children}
    </LeagueShell>
  );
}
