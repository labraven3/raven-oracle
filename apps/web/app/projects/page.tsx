"use client";

import { useEffect, useMemo, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

type Project = { id: string; name: string; slug: string; description: string | null; websiteUrl: string | null; xUrl: string | null; discordUrl: string | null; logoUrl: string; category: string; status: string; createdAt: string };

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => { fetch(`${API}/projects`).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.message ?? "Unable to load projects"); return d; }).then(d => setProjects(d.projects ?? [])).catch(e => setError(e instanceof Error ? e.message : "Unable to load projects")).finally(() => setLoading(false)); }, []);

  const filtered = useMemo(() => projects.filter(p => (category === "ALL" || p.category === category) && `${p.name} ${p.description ?? ""}`.toLowerCase().includes(query.toLowerCase())), [projects, query, category]);

  return <main className="min-h-screen bg-[#07070a] text-zinc-100">
    <header className="border-b border-white/10 px-5 py-5"><div className="mx-auto flex max-w-6xl items-center justify-between"><a href="/" className="font-black tracking-[.18em]">RAVEN ORACLE</a><div className="flex gap-4 text-xs text-zinc-500"><a href="/raffles">Raffles</a><a href="/dashboard">Creator Studio</a></div></div></header>
    <section className="mx-auto max-w-6xl px-5 py-14"><div className="max-w-2xl"><span className="text-[9px] font-black tracking-[.2em] text-violet-300/60">PROJECTS</span><h1 className="mt-3 text-5xl font-medium tracking-tight">Explore projects.</h1><p className="mt-4 text-sm leading-6 text-zinc-500">Discover projects and the live raffles attached to them.</p></div>
      <div className="mt-9 flex flex-col gap-3 md:flex-row"><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search projects…" className="flex-1 rounded-xl border border-white/10 bg-[#0d0c11] px-4 py-3 text-sm outline-none focus:border-violet-400/40"/><select value={category} onChange={e => setCategory(e.target.value)} className="rounded-xl border border-white/10 bg-[#0d0c11] px-4 py-3 text-sm text-zinc-300 outline-none"><option>ALL</option>{["NFT","TOKEN","GAME","TOOL","DEFI","COMMUNITY","OTHER"].map(x => <option key={x}>{x}</option>)}</select></div>
      {loading ? <div className="mt-10 text-sm text-zinc-600">Loading projects…</div> : error ? <div className="mt-10 rounded-xl border border-red-500/20 bg-red-500/5 p-5 text-sm text-red-300">{error}</div> : filtered.length === 0 ? <div className="mt-10 rounded-2xl border border-white/10 bg-[#0d0c11] p-12 text-center"><p className="text-zinc-300">No projects found.</p><p className="mt-2 text-xs text-zinc-600">Try another search or category.</p></div> : <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{filtered.map(p => <a key={p.id} href={`/projects/${p.id}`} className="group rounded-2xl border border-white/10 bg-[#0d0c11] p-5 transition hover:border-violet-400/30 hover:bg-[#111016]"><div className="flex items-center gap-4"><img src={p.logoUrl} alt="" className="h-14 w-14 rounded-xl border border-white/10 object-cover"/><div className="min-w-0"><div className="truncate font-semibold">{p.name}</div><span className="mt-1 inline-block rounded-full border border-white/10 px-2 py-1 text-[9px] text-zinc-500">{p.category}</span></div></div><p className="mt-5 line-clamp-3 text-xs leading-5 text-zinc-500">{p.description || "No description yet."}</p><div className="mt-5 flex items-center justify-between text-[10px] text-zinc-600"><span>{p.status}</span><span className="text-violet-300/70 group-hover:text-violet-300">View project →</span></div></a>)}</div>}
    </section>
  </main>;
}
