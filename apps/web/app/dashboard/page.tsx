"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import SiteHeader from "../../components/SiteHeader";
import { API_BASE_URL } from "@/lib/api-config";

type User = { email: string | null; username?: string | null; displayName?: string | null; emailVerifiedAt?: string | null };
type Project = { id: string; name: string; category: string; status: string; logoUrl?: string | null; bannerUrl?: string | null; _count: { raffles: number } };
type Entry = { id: string; status: string; enteredAt: string; raffle: { id: string; title: string; prizeName: string; status: string; startsAt: string; endsAt: string; winnerCount: number; project?: { id: string; name: string; logoUrl?: string | null; bannerUrl?: string | null; category: string } | null } };
type RaffleTab = "RUNNING" | "CLOSED" | "WON";

async function api<T>(path: string) {
  const headers = new Headers();
  const token = typeof window !== "undefined" ? localStorage.getItem("raven_token") : null;
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API_BASE_URL}${path}`, { headers, credentials: "include", cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message ?? "Request failed");
  return data as T;
}

function dateLabel(value: string) {
  return new Date(value).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [tab, setTab] = useState<RaffleTab>("RUNNING");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const me = await api<{ user: User }>("/auth/me");
        if (cancelled) return;
        setUser(me.user);

        const [entryResult, projectResult] = await Promise.allSettled([
          api<{ entries: Entry[] }>("/raffles/mine"),
          api<{ projects: Project[] }>("/projects/mine"),
        ]);
        if (cancelled) return;
        if (entryResult.status === "fulfilled") setEntries(entryResult.value.entries ?? []);
        else setError(entryResult.reason instanceof Error ? entryResult.reason.message : "Unable to load joined raffles");
        if (projectResult.status === "fulfilled") setProjects(projectResult.value.projects ?? []);
      } catch {
        if (!cancelled) {
          localStorage.removeItem("raven_token");
          router.replace("/login?next=/dashboard");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [router]);

  const visibleEntries = useMemo(() => entries.filter((entry) => {
    if (tab === "WON") return entry.status === "WON" || entry.raffle.status === "COMPLETED" && entry.status === "WINNER";
    if (tab === "CLOSED") return ["CLOSED", "DRAWING", "COMPLETED"].includes(entry.raffle.status);
    return ["SCHEDULED", "ACTIVE"].includes(entry.raffle.status);
  }), [entries, tab]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#06060a] text-zinc-500 dark:bg-[#06060a]">
        <SiteHeader />
        <div className="mx-auto max-w-7xl px-5 py-20">Loading your dashboard…</div>
      </main>
    );
  }

  if (!user) return null;

  const name = user.displayName || user.username || user.email?.split("@")[0] || "Raven user";

  return (
    <main className="min-h-screen bg-[#06060a] text-zinc-100">
      <SiteHeader />
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <section className="rounded-3xl border border-white/10 bg-[#0d0c11] p-5 sm:p-7">
          <div className="flex flex-col gap-5 border-b border-white/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <span className="text-[9px] font-black tracking-[.23em] text-violet-300/70">DASHBOARD</span>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Welcome back, {name}.</h1>
              <p className="mt-2 text-sm text-zinc-500">Your joined raffles, entries and project activity in one place.</p>
            </div>
            <Link href="/raffles" className="rounded-xl border border-white/10 bg-black/20 px-4 py-2.5 text-xs font-black text-zinc-200 hover:bg-white/5">Explore raffles</Link>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex w-fit overflow-hidden rounded-xl border border-white/10 bg-black/20">
              {(["RUNNING", "CLOSED", "WON"] as const).map((item) => (
                <button key={item} onClick={() => setTab(item)} className={`px-5 py-2.5 text-[10px] font-black ${tab === item ? "bg-violet-500 text-white" : "text-zinc-500 hover:text-zinc-200"}`}>
                  {item === "RUNNING" ? "Running" : item === "CLOSED" ? "Closed" : "Won"}
                </button>
              ))}
            </div>
            <span className="text-[9px] font-black tracking-[.12em] text-zinc-500">{visibleEntries.length} {visibleEntries.length === 1 ? "RAFFLE" : "RAFFLES"}</span>
          </div>

          {error && <div className="mt-5 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400">{error}</div>}

          {visibleEntries.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-white/10 p-14 text-center">
              <div className="mx-auto grid h-20 w-20 place-items-center rounded-2xl border border-white/10 bg-black/20 text-2xl text-violet-300">◇</div>
              <h2 className="mt-5 text-lg font-semibold">Nothing to see here</h2>
              <p className="mt-2 text-sm text-zinc-500">{tab === "RUNNING" ? "Join a raffle to see it in your dashboard." : "No raffles match this tab yet."}</p>
              <Link href="/raffles" className="mt-5 inline-flex rounded-xl bg-violet-500 px-4 py-2.5 text-xs font-black text-white">Explore raffles</Link>
            </div>
          ) : (
            <div className="mt-5 overflow-hidden rounded-2xl border border-white/10">
              <div className="hidden grid-cols-[minmax(260px,2fr)_1fr_110px_130px] gap-4 border-b border-white/10 bg-black/10 px-5 py-3 text-[9px] font-black tracking-[.13em] text-zinc-500 md:grid">
                <span>RAFFLE</span><span>PROJECT</span><span>ENTRY</span><span>END DATE</span>
              </div>
              {visibleEntries.map((entry) => (
                <Link key={entry.id} href={`/raffles/${entry.raffle.id}`} className="grid gap-4 border-b border-white/10 px-5 py-4 last:border-b-0 hover:bg-white/[.03] md:grid-cols-[minmax(260px,2fr)_1fr_110px_130px] md:items-center">
                  <div className="flex items-center gap-3">
                    <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-white/10 bg-black/20 text-violet-200">
                      {entry.raffle.project?.logoUrl ? <img src={entry.raffle.project.logoUrl} alt="" className="h-full w-full object-cover" /> : "R"}
                    </div>
                    <div className="min-w-0">
                      <span className="rounded-full border border-violet-400/20 bg-violet-500/5 px-2 py-0.5 text-[8px] font-black text-violet-300">{entry.raffle.status}</span>
                      <h2 className="mt-1 truncate text-sm font-semibold">{entry.raffle.title}</h2>
                      <p className="mt-1 truncate text-[10px] text-zinc-500">{entry.raffle.prizeName}</p>
                    </div>
                  </div>
                  <div className="pl-15 text-xs text-zinc-500 md:pl-0">{entry.raffle.project?.name ?? "Project"}<span className="block text-[9px] text-zinc-600">{entry.raffle.project?.category ?? ""}</span></div>
                  <div className="pl-15 text-xs font-semibold md:pl-0">{entry.status}</div>
                  <div className="pl-15 text-xs text-zinc-500 md:pl-0">{dateLabel(entry.raffle.endsAt)}</div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="mt-6 rounded-3xl border border-white/10 bg-[#0d0c11] p-5 sm:p-7">
          <div className="flex items-end justify-between gap-4">
            <div>
              <span className="text-[9px] font-black tracking-[.2em] text-violet-300/70">MY PROJECTS</span>
              <h2 className="mt-2 text-2xl font-semibold">Projects you created</h2>
            </div>
            <Link href="/projects/new" className="rounded-xl bg-violet-500 px-4 py-2.5 text-xs font-black text-white">+ New Project</Link>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {projects.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-zinc-600 md:col-span-2">No projects created yet.</div>
            ) : projects.map((project) => (
              <Link key={project.id} href={`/dashboard/projects/${project.id}`} className="rounded-2xl border border-white/10 bg-black/10 p-4 hover:border-violet-400/30">
                <div className="flex items-center gap-3">
                  <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-xl bg-black/30">{project.logoUrl ? <img src={project.logoUrl} alt="" className="h-full w-full object-cover" /> : project.name[0]}</div>
                  <div className="min-w-0 flex-1"><b className="block truncate">{project.name}</b><span className="text-[10px] text-zinc-500">{project.category} · {project._count.raffles} raffle{project._count.raffles === 1 ? "" : "s"}</span></div>
                  <span className="text-zinc-600">→</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
