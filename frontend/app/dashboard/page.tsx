import { UserButton } from "@clerk/nextjs";
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function DashboardPage() {
  const user = await currentUser();

  if (!user) {
    redirect("/sign-in");
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight">⚽ Crease</h1>
        <UserButton />
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <h2 className="text-3xl font-bold mb-2">
          Welcome, {user.firstName}!
        </h2>
        <p className="text-gray-400 mb-10">
          Your Champions League fantasy dashboard
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link href="/leagues/create" className="bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-gray-600 transition block">
            <h3 className="text-lg font-semibold mb-1">Create a League</h3>
            <p className="text-gray-400 text-sm">Start a new private league and invite your friends</p>
          </Link>
          <Link href="/leagues/join" className="bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-gray-600 transition block">
            <h3 className="text-lg font-semibold mb-1">Join a League</h3>
            <p className="text-gray-400 text-sm">Enter an invite code to join an existing league</p>
          </Link>
        </div>
      </main>
    </div>
  );
}