"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import SiteHeader from "../../../components/SiteHeader";
import { API_BASE_URL } from "@/lib/api-config";

type Raffle = { id: string; title: string; prizeName: string; prizeQuantity: number; startsAt: string; endsAt: string; status: string; winnerCount: number };
type Project = { id: string; name: string; description: string | null; websiteUrl: string | null; xUrl: string | null; discordUrl: string | null; logoUrl: string; bannerUrl: string | null; projectType?: "NFT" | "TOKEN" | "AIRDROP" | "OTHER"; chain?: string | null; status: string; raffles: Raffle[] };

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_BASE_URL}/projects/${id}`, { cache: "default", signal: controller.signal })
      .then(async r => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.message ?? "Project not found"); return d; })
      .then(d => { if (!controller.signal.aborted) setProject(d.project); })
      .catch(e => { if (e.name !== "AbortError") setError(e instanceof Error ? e.message : "Unable to load project"); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id]);

  if (loading) return <main className="min-h-screen bg-[#06060a] text-zinc-400"><SiteHeader/><div className="mx-auto max-w-6xl p-10">Loading project…</div></main>;
  if (error || !project || project.status !== "APPROVED") return <main className="min-h-screen bg-[#06060a] text-zinc-400"><SiteHeader/><div className="mx-auto max-w-2xl px-5 py-24"><Link href="/projects" className="text-xs text-violet-300">← Projects</Link><div className="mt-5 rounded-3xl border border-white/10 bg-[#0d0c11] p-8">{error || "Project is not publicly available."}</div></div></main>;

  const live = project.raffles.filter(r => r.status === "ACTIVE" || r.status === "SCHEDULED");
  return <main className="min-h-screen bg-[#06060a] text-zinc-100">
    <SiteHeader/>
    <div className="mx-auto max-w-6xl px-5 py-8">
      <Link href="/projects" className="text-xs text-zinc-500 hover:text-violet-300">← All Projects</Link>
      <section className="mt-5 overflow-hidden rounded-3xl border border-white/10 bg-[#0d0c11]">
        <div className="relative flex h-[280px] items-center justify-center overflow-hidden bg-[#0b0b10] sm:h-[360px] lg:h-[400px]">
          {project.bannerUrl ? <img src={project.bannerUrl} alt={`${project.name} banner`} loading="eager" decoding="async" fetchPriority="high" className="h-full w-full object-contain"/> : <div className="h-full w-full bg-[radial-gradient(circle_at_50%_35%,rgba(139,92,246,.34),transparent_40%),linear-gradient(135deg,#181323,#0b0b0f)]"/>}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#0d0c11] to-transparent"/>
          <div className="absolute left-4 top-4 rounded-full border border-white/10 bg-black/55 px-3 py-1.5 text-[9px] font-black text-white backdrop-blur">{project.chain || "TBA"}</div>
          <div className="absolute right-4 top-4 rounded-full border border-white/10 bg-black/55 px-3 py-1.5 text-[9px] font-black text-emerald-300 backdrop-blur">✓ VERIFIED</div>
        </div>
        <div className="px-6 pb-8 sm:px-9">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
            <div className="-mt-10 grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-2xl border-4 border-[#0d0c11] bg-black shadow-2xl sm:h-28 sm:w-28">
              {project.logoUrl ? <img src={project.logoUrl} alt="" loading="eager" decoding="async" className="h-full w-full object-cover"/> : <span className="text-4xl font-black">{project.name[0]}</span>}
            </div>
            <div className="min-w-0 flex-1 pb-1">
              <div className="flex flex-wrap gap-2"><span className="rounded-full bg-violet-500/10 px-3 py-1 text-[9px] font-black text-violet-300">{project.projectType ?? "NFT"}</span>{project.chain && <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-[9px] font-black text-cyan-300">⛓ {project.chain}</span>}</div>
              <h1 className="mt-3 text-4xl font-medium tracking-tight sm:text-5xl">{project.name}</h1>
            </div>
          </div>
          <p className="mt-5 max-w-4xl text-sm leading-7 text-zinc-500">{project.description || "Approved project on Raven Oracle."}</p>
          <div className="mt-5 flex flex-wrap gap-2">{project.websiteUrl&&<a href={project.websiteUrl} target="_blank" rel="noreferrer" className="rounded-xl border border-white/10 px-4 py-2.5 text-xs">Website ↗</a>}{project.xUrl&&<a href={project.xUrl} target="_blank" rel="noreferrer" className="rounded-xl border border-white/10 px-4 py-2.5 text-xs">X ↗</a>}{project.discordUrl&&<a href={project.discordUrl} target="_blank" rel="noreferrer" className="rounded-xl border border-white/10 px-4 py-2.5 text-xs">Discord ↗</a>}</div>
        </div>
      </section>
      <section className="mt-10"><div className="flex items-end justify-between"><div><span className="text-[9px] font-black tracking-[.2em] text-violet-300/60">PROJECT RAFFLES</span><h2 className="mt-2 text-3xl font-medium">Live & upcoming</h2></div><Link href="/raffles" className="text-xs font-bold text-violet-300">Browse all →</Link></div>{live.length===0?<div className="mt-6 rounded-2xl border border-dashed border-white/10 p-14 text-center text-sm text-zinc-600">No live or upcoming raffles right now.</div>:<div className="mt-6 grid gap-4 md:grid-cols-2">{live.map(r=><Link key={r.id} href={`/raffles/${r.id}`} className="rounded-2xl border border-white/10 bg-[#0d0c11] p-6 hover:border-violet-400/30"><span className="text-[9px] font-black text-emerald-300">{r.status}</span><h3 className="mt-4 text-xl font-medium">{r.title}</h3><p className="mt-2 text-xs text-zinc-500">{r.prizeName} · {r.prizeQuantity} whitelist spot{r.prizeQuantity===1?"":"s"}</p></Link>)}</div>}</section>
    </div>
  </main>;
}
