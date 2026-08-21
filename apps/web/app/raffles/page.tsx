"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import SiteHeader from "../../components/SiteHeader";
import { API_BASE_URL } from "@/lib/api-config";

type Status = "ALL" | "ACTIVE" | "SCHEDULED" | "COMPLETED";
type Raffle = {
  id: string;
  title: string;
  description: string | null;
  prizeName: string;
  prizeQuantity: number;
  startsAt: string;
  endsAt: string;
  status: string;
  winnerCount: number;
  project: { id: string; name: string; logoUrl: string | null; category: string } | null;
  _count: { entries: number; winners: number; tasks: number };
};

function dateLabel(value: string) { return new Date(value).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" }); }
function timing(raffle: Raffle) { if (raffle.status === "SCHEDULED") return `Starts ${dateLabel(raffle.startsAt)}`; if (raffle.status === "ACTIVE") return `Ends ${dateLabel(raffle.endsAt)}`; return "Completed"; }

export default function RafflesPage() {
  const [raffles, setRaffles] = useState<Raffle[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status>("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE_URL}/raffles/public`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message ?? "Unable to load raffles");
        return data as { raffles?: Raffle[] };
      })
      .then((data) => { if (!cancelled) setRaffles(data.raffles ?? []); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Unable to load raffles"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return raffles.filter((raffle) => {
      const statusOk = status === "ALL" || (status === "COMPLETED" ? ["CLOSED", "DRAWING", "COMPLETED"].includes(raffle.status) : raffle.status === status);
      const haystack = `${raffle.title} ${raffle.description ?? ""} ${raffle.prizeName} ${raffle.project?.name ?? ""}`.toLowerCase();
      return statusOk && (!q || haystack.includes(q));
    });
  }, [raffles, status, query]);

  return (
    <main className="min-h-screen bg-[#f6f7f9] text-[#111827] dark:bg-[#07070a] dark:text-zinc-100">
      <SiteHeader />
      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <aside className="sticky top-24 hidden h-fit w-52 shrink-0 rounded-2xl border border-black/5 bg-white p-4 dark:border-white/10 dark:bg-[#0d0c11] lg:block">
          <div className="px-3 pb-4 text-[10px] font-black tracking-[.2em] text-zinc-400">EXPLORE</div>
          <nav className="space-y-1">
            <Link href="/projects" className="block rounded-lg px-3 py-2.5 text-xs text-zinc-500 hover:bg-black/5 dark:hover:bg-white/5">Projects</Link>
            <Link href="/raffles" className="block rounded-lg bg-violet-500/10 px-3 py-2.5 text-xs font-bold text-violet-500 dark:text-violet-300">Raffles</Link>
            <Link href="/how-it-works" className="block rounded-lg px-3 py-2.5 text-xs text-zinc-500 hover:bg-black/5 dark:hover:bg-white/5">How it works</Link>
          </nav>
        </aside>

        <section className="min-w-0 flex-1">
          <div className="rounded-3xl border border-black/5 bg-white p-5 dark:border-white/10 dark:bg-[#0d0c11] sm:p-7">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <span className="text-[9px] font-black tracking-[.23em] text-violet-500 dark:text-violet-300">RAFFLES</span>
                <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">Find a raffle.</h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500">Explore active and upcoming project raffles, see the entry requirements, and join from the project page.</p>
              </div>
              <div className="text-right text-[10px] font-black tracking-[.12em] text-zinc-400">{visible.length} RAFFLE{visible.length === 1 ? "" : "S"}</div>
            </div>

            <div className="mt-7 flex flex-col gap-3 md:flex-row">
              <div className="min-w-0 flex-1 rounded-xl border border-black/10 bg-[#f9fafb] px-4 dark:border-white/10 dark:bg-black/20">
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search raffle, project or prize" className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-zinc-400" />
              </div>
              <div className="flex flex-wrap gap-2">
                {(["ALL", "ACTIVE", "SCHEDULED", "COMPLETED"] as const).map((item) => <button key={item} onClick={() => setStatus(item)} className={`rounded-xl border px-3.5 py-2.5 text-[10px] font-black ${status === item ? "border-violet-500/30 bg-violet-500 text-white" : "border-black/10 bg-white text-zinc-500 dark:border-white/10 dark:bg-black/20"}`}>{item}</button>)}
              </div>
            </div>
          </div>

          {error && <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-500/5 p-5 text-sm text-red-500">{error}</div>}
          {loading ? <div className="mt-5 rounded-2xl border border-black/5 bg-white p-14 text-center text-sm text-zinc-500 dark:border-white/10 dark:bg-[#0d0c11]">Loading raffles…</div> : visible.length === 0 ? <div className="mt-5 rounded-2xl border border-dashed border-black/10 bg-white p-14 text-center dark:border-white/10 dark:bg-[#0d0c11]"><h2 className="text-lg font-semibold">No raffles found</h2><p className="mt-2 text-sm text-zinc-500">Try another search or filter.</p></div> : <div className="mt-5 overflow-hidden rounded-2xl border border-black/5 bg-white dark:border-white/10 dark:bg-[#0d0c11]">
            <div className="hidden grid-cols-[minmax(260px,2fr)_1fr_100px_100px_120px] gap-4 border-b border-black/5 px-5 py-3 text-[9px] font-black tracking-[.13em] text-zinc-400 dark:border-white/5 md:grid">
              <span>RAFFLE</span><span>PROJECT</span><span>WINNERS</span><span>ENTRIES</span><span>END DATE</span>
            </div>
            {visible.map((raffle) => <Link key={raffle.id} href={`/raffles/${raffle.id}`} className="grid gap-4 border-b border-black/5 px-5 py-4 transition hover:bg-violet-500/[.03] dark:border-white/5 md:grid-cols-[minmax(260px,2fr)_1fr_100px_100px_120px] md:items-center">
              <div className="flex items-center gap-3"><div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl border border-black/10 bg-slate-100 text-sm font-black text-violet-500 dark:border-white/10 dark:bg-black/30 dark:text-violet-200">{raffle.project?.logoUrl ? <img src={raffle.project.logoUrl} alt="" className="h-full w-full object-cover" /> : "R"}</div><div className="min-w-0"><div className="flex items-center gap-2"><span className={`rounded-full border px-2 py-0.5 text-[8px] font-black ${raffle.status === "ACTIVE" ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-500" : "border-violet-500/20 bg-violet-500/5 text-violet-500"}`}>{raffle.status}</span><span className="truncate text-[9px] text-zinc-400">{timing(raffle)}</span></div><h2 className="mt-1 truncate text-sm font-semibold group-hover:text-violet-500">{raffle.title}</h2><p className="mt-1 truncate text-[10px] text-zinc-500">{raffle.prizeName} · {raffle.prizeQuantity} prize{raffle.prizeQuantity === 1 ? "" : "s"}</p></div></div>
              <div className="pl-14 text-xs text-zinc-500 md:pl-0">{raffle.project?.name ?? "Project"}<span className="block text-[9px] text-zinc-400">{raffle.project?.category ?? ""}</span></div>
              <div className="pl-14 text-xs font-semibold md:pl-0">{raffle.winnerCount}</div>
              <div className="pl-14 text-xs text-zinc-500 md:pl-0">{raffle._count.entries}</div>
              <div className="pl-14 text-xs text-zinc-500 md:pl-0">{dateLabel(raffle.endsAt)}</div>
            </Link>)}
          </div>}
        </section>
      </div>
    </main>
  );
}
