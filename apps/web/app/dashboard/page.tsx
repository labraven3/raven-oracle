"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import SiteHeader from "../../components/SiteHeader";
import { API_BASE_URL } from "@/lib/api-config";

type User = { email: string | null; username?: string | null; displayName?: string | null; emailVerifiedAt?: string | null };
type Project = { id: string; name: string; category: string; status: string; logoUrl?: string | null; _count: { raffles: number } };
type Entry = { id: string; status: string; enteredAt: string; raffle: { id: string; title: string; prizeName: string; status: string; startsAt: string; endsAt: string; project?: { id: string; name: string; logoUrl?: string | null; category: string } | null } };

async function api<T>(path: string) {
  const response = await fetch(`${API_BASE_URL}${path}`, { credentials: "include", cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message ?? "Request failed");
  return data as T;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      api<{ user: User }>("/auth/me"),
      api<{ projects: Project[] }>("/projects/mine"),
      api<{ entries: Entry[] }>("/raffles/mine"),
    ])
      .then(([me, projectData, entryData]) => {
        setUser(me.user);
        setProjects(projectData.projects);
        setEntries(entryData.entries);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Unable to load dashboard");
        router.replace("/login?next=/dashboard");
      })
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#06060a] text-zinc-500">
        <SiteHeader />
        <div className="mx-auto max-w-6xl p-10">Loading your dashboard…</div>
      </main>
    );
  }

  if (!user) return null;

  const name = user.displayName || user.username || user.email?.split("@")[0] || "Raven user";

  return (
    <main className="min-h-screen bg-[#06060a] text-zinc-100">
      <SiteHeader />
      <section className="mx-auto max-w-6xl px-5 py-14">
        <span className="text-[9px] font-black tracking-[.2em] text-violet-300/60">MY DASHBOARD</span>
        <h1 className="mt-3 text-5xl font-medium tracking-tight">Welcome, {name}.</h1>
        <p className="mt-3 text-sm text-zinc-500">Manage your projects and see the raffles you have entered.</p>

        {error && <div className="mt-5 rounded-xl border border-red-900/50 p-4 text-sm text-red-300">{error}</div>}

        <div className="mt-10 flex items-center justify-between">
          <div>
            <span className="text-[9px] font-black tracking-[.18em] text-violet-300/60">CREATOR</span>
            <h2 className="mt-2 text-2xl font-medium">My Projects</h2>
          </div>
          <Link href="/projects/new" className="rounded-lg bg-violet-500 px-4 py-2.5 text-xs font-black text-black">+ New Project</Link>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {projects.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-zinc-600 md:col-span-2">You have not created any projects yet.</div>
          ) : projects.map((project) => (
            <Link key={project.id} href={`/dashboard/projects/${project.id}`} className="rounded-2xl border border-white/10 bg-[#0d0c11] p-5 hover:border-violet-400/30">
              <div className="flex items-center gap-4">
                <div className="grid h-14 w-14 place-items-center overflow-hidden rounded-xl bg-black">{project.logoUrl ? <img src={project.logoUrl} alt="" className="h-full w-full object-cover" /> : <span>{project.name[0]}</span>}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><b>{project.name}</b><span className="rounded-full bg-violet-500/10 px-2 py-1 text-[8px] font-black text-violet-300">{project.category}</span></div>
                  <p className="mt-1 text-xs text-zinc-600">{project.status} · {project._count.raffles} raffle{project._count.raffles === 1 ? "" : "s"}</p>
                </div>
                <span className="text-zinc-600">→</span>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-12"><span className="text-[9px] font-black tracking-[.18em] text-violet-300/60">PARTICIPATION</span><h2 className="mt-2 text-2xl font-medium">Raffles I Joined</h2></div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {entries.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-zinc-600 md:col-span-2">You have not joined any raffles yet. <Link href="/raffles" className="text-violet-300">Browse raffles →</Link></div>
          ) : entries.map((entry) => (
            <Link key={entry.id} href={`/raffles/${entry.raffle.id}`} className="rounded-2xl border border-white/10 bg-[#0d0c11] p-5 hover:border-violet-400/30">
              <div className="flex items-center gap-4">
                <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-xl bg-black">{entry.raffle.project?.logoUrl ? <img src={entry.raffle.project.logoUrl} alt="" className="h-full w-full object-cover" /> : "R"}</div>
                <div className="min-w-0 flex-1"><b className="block truncate">{entry.raffle.title}</b><p className="mt-1 text-xs text-zinc-500">{entry.raffle.project?.name || "Raven Oracle"} · {entry.raffle.prizeName}</p><p className="mt-1 text-[10px] text-zinc-600">Entry: {entry.status} · Joined {new Date(entry.enteredAt).toLocaleDateString()}</p></div>
                <span className="text-zinc-600">→</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
