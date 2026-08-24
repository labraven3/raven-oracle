"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import SiteHeader from "../../../components/SiteHeader";
import { API_BASE_URL } from "@/lib/api-config";

type Project = { id: string; name: string; projectType?: "NFT" | "TOKEN" | "AIRDROP" | "OTHER"; category: string; status: string; logoUrl?: string | null; chain?: string | null; raffles: Array<{ id: string; title: string; status: string; prizeName: string; startsAt: string; endsAt: string; winnerCount: number; _count: { entries: number; winners: number; tasks: number } }> };
type Draft = { id: string; title: string; prizeName: string; updatedAt: string; winnerCount: number; prizeQuantity: number };

async function api<T>(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  const token = typeof window !== "undefined" ? localStorage.getItem("raven_token") : null;
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers, credentials: "include", cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message ?? "Request failed");
  return data as T;
}

const buckets = ["DRAFT", "SCHEDULED", "ACTIVE", "CLOSED", "COMPLETED"] as const;
type Bucket = (typeof buckets)[number];
function formatDate(value: string) { return new Date(value).toLocaleString([], { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }); }

export default function CreatorStudioPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft[]>>({});
  const [bucket, setBucket] = useState<Bucket>("DRAFT");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creatingProjectId, setCreatingProjectId] = useState<string | null>(null);

  const load = async () => {
    try {
      const projectData = await api<{ projects: Project[] }>("/projects/mine");
      const list = projectData.projects ?? [];
      setProjects(list);
      const draftEntries = await Promise.all(list.map(async (project) => {
        try {
          const result = await api<{ drafts: Draft[] }>(`/raffle-drafts/${project.id}`);
          return [project.id, result.drafts ?? []] as const;
        } catch {
          return [project.id, []] as const;
        }
      }));
      setDrafts(Object.fromEntries(draftEntries));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load Creator Studio");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const createRaffle = async (project: Project) => {
    if (project.status !== "APPROVED") {
      setError(`${project.name} must be approved before a raffle can be published.`);
      return;
    }
    setCreatingProjectId(project.id);
    setError("");
    try {
      const data = await api<{ draftId: string }>(`/raffle-drafts/${project.id}`, {
        method: "POST",
        body: JSON.stringify({
          title: "",
          description: "",
          prizeName: "",
          prizeDescription: "",
          prizeQuantity: 1,
          winnerCount: 1,
          maxEntriesPerUser: 1,
          fairnessAlgorithmVersion: "v1",
          startsAt: "",
          endsAt: "",
          tasks: [],
        }),
      });
      router.push(`/dashboard/projects/${project.id}/drafts/${data.draftId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to create raffle draft");
    } finally {
      setCreatingProjectId(null);
    }
  };

  const rows = useMemo(() => {
    const draftRows = bucket === "DRAFT"
      ? projects.flatMap((project) => (drafts[project.id] ?? []).map((draft) => ({ kind: "draft" as const, project, draft })))
      : [];
    const raffleRows = bucket !== "DRAFT"
      ? projects.flatMap((project) => project.raffles.filter((raffle) => raffle.status === bucket).map((raffle) => ({ kind: "raffle" as const, project, raffle })))
      : [];
    return [...draftRows, ...raffleRows];
  }, [bucket, projects, drafts]);

  const counts = useMemo(() => {
    const result: Record<Bucket, number> = { DRAFT: 0, SCHEDULED: 0, ACTIVE: 0, CLOSED: 0, COMPLETED: 0 };
    for (const project of projects) {
      result.DRAFT += (drafts[project.id] ?? []).length;
      for (const raffle of project.raffles) if (raffle.status in result) result[raffle.status as Bucket] += 1;
    }
    return result;
  }, [projects, drafts]);

  return <main className="min-h-screen bg-[#06060a] text-zinc-100">
    <SiteHeader />
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-5 border-b border-white/10 pb-7 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link href="/dashboard" className="text-xs text-zinc-600 hover:text-violet-300">← Dashboard</Link>
          <span className="mt-5 block text-[9px] font-black tracking-[.22em] text-violet-300/70">CREATOR STUDIO</span>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">Manage your projects.</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-500">Draft, schedule, run and review every raffle from one creator workspace.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/projects/new" className="rounded-xl border border-white/10 bg-white/[.03] px-5 py-3 text-xs font-black text-zinc-200">+ New Project</Link>
          {projects.filter((project) => project.status === "APPROVED").length === 1 && (() => { const project = projects.find((item) => item.status === "APPROVED")!; return <button onClick={() => void createRaffle(project)} disabled={creatingProjectId === project.id} className="rounded-xl bg-violet-500 px-5 py-3 text-xs font-black text-white disabled:opacity-50">{creatingProjectId === project.id ? "Opening…" : "+ Create Raffle"}</button>; })()}
        </div>
      </div>

      {error && <div className="mt-6 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300">{error}</div>}

      <section className="mt-7 rounded-3xl border border-white/10 bg-[#0d0c11] p-5 sm:p-7">
        <div className="flex items-center justify-between gap-4">
          <div><span className="text-[9px] font-black tracking-[.18em] text-violet-300/60">YOUR PROJECTS</span><h2 className="mt-2 text-2xl font-semibold">Create a raffle</h2></div>
          <span className="text-[10px] font-black tracking-[.12em] text-zinc-600">{projects.length} PROJECT{projects.length === 1 ? "" : "S"}</span>
        </div>
        {loading ? <div className="py-10 text-center text-sm text-zinc-600">Loading projects…</div> : projects.length === 0 ? <div className="mt-5 rounded-2xl border border-dashed border-white/10 p-10 text-center"><p className="text-sm text-zinc-500">Create a project first.</p><Link href="/projects/new" className="mt-3 inline-block text-xs font-bold text-violet-300">Create project →</Link></div> : <div className="mt-5 grid gap-3 md:grid-cols-2">{projects.map((project) => <div key={project.id} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-black/10 p-4"><div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-black">{project.logoUrl ? <img src={project.logoUrl} alt="" className="h-full w-full object-cover" /> : project.name.slice(0, 1)}</div><div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{project.name}</div><div className="mt-1 text-[10px] text-zinc-600">{project.status} · {project.projectType ?? project.category}</div></div><button onClick={() => void createRaffle(project)} disabled={project.status !== "APPROVED" || creatingProjectId === project.id} className="shrink-0 rounded-lg bg-violet-500 px-3 py-2 text-[10px] font-black text-white disabled:cursor-not-allowed disabled:opacity-40">{creatingProjectId === project.id ? "Opening…" : "Create Raffle"}</button></div>)}</div>}
      </section>

      <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{buckets.map((item) => <button key={item} onClick={() => setBucket(item)} className={`rounded-2xl border p-4 text-left transition ${bucket === item ? "border-violet-400/40 bg-violet-500/5" : "border-white/10 bg-[#0d0c11] hover:border-white/20"}`}><span className="text-[9px] font-black tracking-[.15em] text-zinc-600">{item}</span><b className="mt-2 block text-3xl">{counts[item]}</b></button>)}</div>

      <section className="mt-7 rounded-3xl border border-white/10 bg-[#0d0c11] p-5 sm:p-7"><div className="flex items-center justify-between gap-4"><div><span className="text-[9px] font-black tracking-[.18em] text-violet-300/60">{bucket}</span><h2 className="mt-2 text-2xl font-semibold">{bucket === "DRAFT" ? "Saved drafts" : `${bucket.toLowerCase()} raffles`}</h2></div><span className="text-[10px] font-black tracking-[.12em] text-zinc-600">{rows.length} ITEM{rows.length === 1 ? "" : "S"}</span></div>{loading ? <div className="py-20 text-center text-sm text-zinc-600">Loading Creator Studio…</div> : rows.length === 0 ? <div className="mt-6 rounded-2xl border border-dashed border-white/10 p-14 text-center"><h3 className="text-lg font-semibold">No {bucket.toLowerCase()} items</h3><p className="mt-2 text-sm text-zinc-500">Create a project or raffle to start building your creator workspace.</p></div> : <div className="mt-6 space-y-3">{rows.map((row) => row.kind === "draft" ? <Link key={row.draft.id} href={`/dashboard/projects/${row.project.id}/drafts/${row.draft.id}`} className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-black/10 p-5 hover:border-violet-400/30 md:flex-row md:items-center"><div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-black">{row.project.logoUrl ? <img src={row.project.logoUrl} alt="" className="h-full w-full object-cover" /> : row.project.name.slice(0, 1)}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-violet-500/10 px-2 py-1 text-[8px] font-black text-violet-300">DRAFT</span><span className="text-[9px] text-zinc-600">{row.project.projectType ?? row.project.category}</span></div><h3 className="mt-2 truncate text-sm font-semibold">{row.draft.title || "Untitled Draft"}</h3><p className="mt-1 text-xs text-zinc-500">{row.draft.prizeName || "Prize TBD"} · {row.draft.winnerCount} winner{row.draft.winnerCount === 1 ? "" : "s"} · updated {formatDate(row.draft.updatedAt)}</p></div><span className="text-xs font-bold text-violet-300">Edit draft →</span></Link> : <Link key={row.raffle.id} href={`/dashboard/raffles/${row.raffle.id}`} className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-black/10 p-5 hover:border-violet-400/30 md:flex-row md:items-center"><div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-black">{row.project.logoUrl ? <img src={row.project.logoUrl} alt="" className="h-full w-full object-cover" /> : row.project.name.slice(0, 1)}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-violet-500/10 px-2 py-1 text-[8px] font-black text-violet-300">{row.raffle.status}</span><span className="text-[9px] text-zinc-600">{row.project.projectType ?? row.project.category}</span></div><h3 className="mt-2 truncate text-sm font-semibold">{row.raffle.title}</h3><p className="mt-1 text-xs text-zinc-500">{row.raffle.prizeName} · {row.raffle._count.entries} entries · {row.raffle._count.tasks} tasks · {row.raffle.winnerCount} winner{row.raffle.winnerCount === 1 ? "" : "s"}</p></div><div className="flex flex-wrap gap-2 text-[10px] font-bold"><span className="rounded-lg border border-white/10 px-3 py-2">Manage</span>{row.raffle.status === "COMPLETED" && <span className="rounded-lg border border-violet-500/20 bg-violet-500/5 px-3 py-2 text-violet-300">Winners</span>}</div></Link>)}</div>}</section>
    </div>
  </main>;
}
