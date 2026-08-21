"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import SiteHeader from "../../components/SiteHeader";
import { API_BASE_URL } from "@/lib/api-config";

type Category = "ALL" | "NFT" | "TOKEN" | "GAME" | "TOOL" | "DEFI" | "COMMUNITY" | "OTHER";
type Project = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  websiteUrl: string | null;
  xUrl: string | null;
  discordUrl: string | null;
  logoUrl: string;
  category: Exclude<Category, "ALL">;
  status: string;
  createdAt: string;
};

const categories: Category[] = ["ALL", "NFT", "TOKEN", "GAME", "TOOL", "DEFI", "COMMUNITY", "OTHER"];

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category>("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${API_BASE_URL}/projects/public`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message ?? "Unable to load projects");
        return data as { projects?: Project[] };
      })
      .then((data) => setProjects(data.projects ?? []))
      .catch((e) => setError(e instanceof Error ? e.message : "Unable to load projects"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects.filter((project) => {
      const categoryOk = category === "ALL" || project.category === category;
      const queryOk = !q || `${project.name} ${project.description ?? ""}`.toLowerCase().includes(q);
      return categoryOk && queryOk;
    });
  }, [projects, category, query]);

  return (
    <main className="min-h-screen bg-[#f6f7f9] text-[#111827] dark:bg-[#07070a] dark:text-zinc-100">
      <SiteHeader />
      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <aside className="sticky top-24 hidden h-fit w-52 shrink-0 rounded-2xl border border-black/5 bg-white p-4 dark:border-white/10 dark:bg-[#0d0c11] lg:block">
          <div className="px-3 pb-4 text-[10px] font-black tracking-[.2em] text-zinc-400">DISCOVER</div>
          <nav className="space-y-1">
            <Link href="/projects" className="block rounded-lg bg-violet-500/10 px-3 py-2.5 text-xs font-bold text-violet-500 dark:text-violet-300">Projects</Link>
            <Link href="/raffles" className="block rounded-lg px-3 py-2.5 text-xs text-zinc-500 hover:bg-black/5 hover:text-zinc-900 dark:hover:bg-white/5 dark:hover:text-zinc-100">Raffles</Link>
            <Link href="/how-it-works" className="block rounded-lg px-3 py-2.5 text-xs text-zinc-500 hover:bg-black/5 hover:text-zinc-900 dark:hover:bg-white/5 dark:hover:text-zinc-100">How it works</Link>
          </nav>
          <div className="mt-6 border-t border-black/5 pt-4 dark:border-white/5">
            <div className="px-3 pb-2 text-[9px] font-black tracking-[.18em] text-zinc-400">CATEGORY</div>
            <div className="space-y-1">
              {categories.slice(1, 7).map((item) => (
                <button key={item} onClick={() => setCategory(item)} className={`block w-full rounded-lg px-3 py-2 text-left text-[11px] ${category === item ? "bg-violet-500 text-white" : "text-zinc-500 hover:bg-black/5 dark:hover:bg-white/5"}`}>{item}</button>
              ))}
            </div>
          </div>
        </aside>

        <section className="min-w-0 flex-1">
          <div className="rounded-3xl border border-black/5 bg-white p-5 sm:p-7 dark:border-white/10 dark:bg-[#0d0c11]">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <span className="text-[9px] font-black tracking-[.23em] text-violet-500 dark:text-violet-300">DISCOVER</span>
                <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">Explore projects.</h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500">Discover approved projects across NFT, token, game, tool, DeFi and community categories.</p>
              </div>
              <div className="text-right text-[10px] font-black tracking-[.12em] text-zinc-400">{filtered.length} PROJECT{filtered.length === 1 ? "" : "S"}</div>
            </div>

            <div className="mt-7 flex flex-col gap-3 lg:flex-row">
              <div className="flex-1 rounded-xl border border-black/10 bg-[#f9fafb] px-4 dark:border-white/10 dark:bg-black/20">
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search projects" className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-zinc-400" />
              </div>
              <div className="flex flex-wrap gap-2">
                {categories.map((item) => <button key={item} onClick={() => setCategory(item)} className={`rounded-xl border px-3.5 py-2.5 text-[10px] font-black ${category === item ? "border-violet-500/30 bg-violet-500 text-white" : "border-black/10 bg-white text-zinc-500 dark:border-white/10 dark:bg-black/20"}`}>{item}</button>)}
              </div>
            </div>
          </div>

          {error && <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-500/5 p-5 text-sm text-red-500">{error}</div>}
          {loading ? <div className="mt-5 rounded-2xl border border-black/5 bg-white p-14 text-center text-sm text-zinc-500 dark:border-white/10 dark:bg-[#0d0c11]">Loading projects…</div> : filtered.length === 0 ? <div className="mt-5 rounded-2xl border border-dashed border-black/10 bg-white p-14 text-center dark:border-white/10 dark:bg-[#0d0c11]"><h2 className="text-lg font-semibold">No projects found</h2><p className="mt-2 text-sm text-zinc-500">Try another search or category.</p></div> : <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{filtered.map((project) => <Link key={project.id} href={`/projects/${project.id}`} className="group overflow-hidden rounded-2xl border border-black/5 bg-white transition hover:-translate-y-1 hover:shadow-xl dark:border-white/10 dark:bg-[#0d0c11]"><div className="relative h-36 overflow-hidden bg-gradient-to-br from-violet-100 via-white to-slate-100 p-4 dark:from-violet-950/40 dark:via-[#15101e] dark:to-[#0b0b0f]"><div className="absolute right-3 top-3 rounded-full border border-black/10 bg-white/80 px-2.5 py-1 text-[8px] font-black text-zinc-500 backdrop-blur dark:border-white/10 dark:bg-black/30">{project.category}</div><div className="grid h-14 w-14 place-items-center overflow-hidden rounded-2xl border border-black/10 bg-white text-xl font-black text-violet-500 shadow-sm dark:border-white/10 dark:bg-black/40 dark:text-violet-200">{project.logoUrl ? <img src={project.logoUrl} alt="" className="h-full w-full object-cover" /> : project.name.slice(0, 1)}</div></div><div className="p-5"><div className="flex items-start gap-3"><div className="min-w-0 flex-1"><h2 className="truncate text-lg font-semibold group-hover:text-violet-500 dark:group-hover:text-violet-200">{project.name}</h2><p className="mt-2 line-clamp-2 text-xs leading-5 text-zinc-500">{project.description || "Approved community on Raven Oracle."}</p></div><span className="text-lg text-violet-500">↗</span></div><div className="mt-5 flex items-center justify-between border-t border-black/5 pt-4 text-[9px] font-black tracking-[.12em] text-zinc-400 dark:border-white/5"><span>VERIFIED PROJECT</span><span className="text-violet-500">VIEW →</span></div></div></Link>)}</div>}
        </section>
      </div>
    </main>
  );
}
