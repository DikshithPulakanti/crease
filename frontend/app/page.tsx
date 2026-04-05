import { UserButton, SignOutButton } from "@clerk/nextjs";
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function DashboardPage() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">

      {/* Header */}
      <header className="border-b border-white/5 px-6 py-4 flex items-center justify-between backdrop-blur-sm sticky top-0 z-50 bg-[#0a0a0f]/80">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center">
            <span className="text-xs font-black text-black">C</span>
          </div>
          <span className="font-bold text-lg tracking-tight">Crease</span>
        </div>
        <div className="flex items-center gap-3">
          <UserButton appearance={{ elements: { avatarBox: "w-8 h-8" } }} />
          <SignOutButton redirectUrl="/sign-in">
            <button className="text-gray-500 hover:text-red-400 transition" title="Sign out">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          </SignOutButton>
        </div>
      </header>

      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-emerald-500/10 blur-[120px] rounded-full" />
        </div>
        <div className="max-w-5xl mx-auto px-6 pt-16 pb-12 relative">
          <p className="text-emerald-400 text-sm font-semibold tracking-widest uppercase mb-3">
            Champions League Fantasy
          </p>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-3">
            Welcome back,<br />
            <span className="text-emerald-400">{user.firstName ?? user.username ?? "Manager"}.</span>
          </h1>
          <p className="text-gray-400 text-lg">
            Draft your squad. Win your league. Claim the trophy.
          </p>
        </div>
      </div>

      {/* Main cards */}
      <div className="max-w-5xl mx-auto px-6 pb-20">

        <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4">
          Get Started
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Create League */}
          <Link href="/leagues/create" className="group relative overflow-hidden rounded-2xl border border-white/8 bg-white/3 hover:bg-white/5 hover:border-emerald-500/30 transition-all duration-300 p-8 flex flex-col gap-4">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-2xl">
              🏆
            </div>
            <div>
              <h2 className="text-xl font-bold mb-1">Create a League</h2>
              <p className="text-gray-400 text-sm leading-relaxed">
                Start a private league, set your rules, and invite friends to compete across the UCL knockout stages.
              </p>
            </div>
            <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold mt-auto">
              Start now
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </div>
          </Link>

          {/* Join League */}
          <Link href="/leagues/join" className="group relative overflow-hidden rounded-2xl border border-white/8 bg-white/3 hover:bg-white/5 hover:border-violet-500/30 transition-all duration-300 p-8 flex flex-col gap-4">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-2xl">
              ⚡
            </div>
            <div>
              <h2 className="text-xl font-bold mb-1">Join a League</h2>
              <p className="text-gray-400 text-sm leading-relaxed">
                Have an invite code? Enter it here to join an existing league and start drafting your team.
              </p>
            </div>
            <div className="flex items-center gap-2 text-violet-400 text-sm font-semibold mt-auto">
              Enter code
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </div>
          </Link>
        </div>

        {/* How it works */}
        <div className="mt-16">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-6">
            How it works
          </p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { step: "01", icon: "🏗️", title: "Create a league", desc: "Set your rules and invite up to 10 friends" },
              { step: "02", icon: "🎯", title: "Snake draft", desc: "Live draft room — pick 15 players in snake order" },
              { step: "03", icon: "⚽", title: "Set your lineup", desc: "Pick your starting 11, captain, and vice-captain each week" },
              { step: "04", icon: "📊", title: "Win H2H matchups", desc: "Score the most points each gameweek to win" },
            ].map(({ step, icon, title, desc }) => (
              <div key={step} className="rounded-xl border border-white/5 bg-white/2 p-5">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xl">{icon}</span>
                  <span className="text-xs font-bold text-gray-600">{step}</span>
                </div>
                <h3 className="font-semibold text-sm mb-1">{title}</h3>
                <p className="text-gray-500 text-xs leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}