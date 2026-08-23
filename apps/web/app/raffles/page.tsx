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
    fetch(`${API_BASE_URL}/raffles`, { cache: "no-store" })
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
      const haystack = `${raffle.title} ${raffle.description ?? ""} ${raffle.prizeName} ${raffle.project?.name ?? ""} ${raffle.project?.category ?? ""}`.toLowerCase();
      return statusOk && (!q || haystack.includes(q));
    });
  }, [raffles, status, query]);

  return (
    <main className="min-h-screen bg-[#f7f8fb] text-[#15151d] dark:bg-[#07070a] dark:text-zinc-100">
      <SiteHeader />
      <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-5 border-b border-black/5 pb-7 dark:border-white/10 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[.24em] text-violet-500 dark:text-violet-300">Explore</div>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">Raffles</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500">Browse active and upcoming project raffles. Open a raffle to review requirements before you enter.</p>
          </div>
          <Link href="/projects" className="inline-flex items-center justify-center rounded-xl border border-black/10 bg-white px-5 py-3 text-xs font-black text-zinc-700 shadow-sm hover:border-violet-300 hover:text-violet-500 dark:border-white/10 dark:bg-[#0d0c11] dark:text-zinc-200">Browse projects</Link>
        </header>

        <section className="mt-7 rounded-2xl border border-black/5 bg-white shadow-sm dark:border-white/10 dark:bg-[#0d0c11]">
          <div className="grid gap-3 p-5 lg:grid-cols-[1fr_auto] sm:p-6">
            <label className="flex items-center rounded-xl border border-black/10 bg-[#fafafa] px-4 dark:border-white/10 dark:bg-black/20"><span className="mr-3 text-zinc-400">⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search raffle, project, prize" className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-zinc-400" /></label>
            <div className="flex flex-wrap gap-2">
              {(["ALL", "ACTIVE", "SCHEDULED", "COMPLETED"] as const).map((item) => <button key={item} onClick={() => setStatus(item)} className={`rounded-xl border px-4 py-3 text-[10px] font-black transition ${status === item ? "border-violet-500 bg-violet-500 text-white" : "border-black/10 bg-white text-zinc-500 hover:border-violet-300 hover:text-violet-500 dark:border-white/10 dark:bg-[#111218] dark:text-zinc-300 dark:hover:border-violet-400"}`}>{item === "ALL" ? "All" : item.charAt(0) + item.slice(1).toLowerCase()}</button>)}
            </div>
          </div>
          <div className="flex items-center justify-between border-t border-black/5 px-5 py-3 text-[10px] font-black uppercase tracking-[.14em] text-zinc-400 dark:border-white/10 sm:px-6"><span>{loading ? "Loading" : `${visible.length} raffles`}</span><span>Live discovery</span></div>
        </section>

        {error && <div className="mt-5 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-500">{error}</div>}
        {loading ? <div className="mt-5 rounded-2xl border border-black/5 bg-white p-16 text-center text-sm text-zinc-500 dark:border-white/10 dark:bg-[#0d0c11]">Loading raffles…</div> : visible.length === 0 ? <div className="mt-5 rounded-2xl border border-dashed border-black/10 bg-white p-16 text-center dark:border-white/10 dark:bg-[#0d0c11]"><h2 className="text-lg font-semibold">No raffles found</h2><p className="mt-2 text-sm text-zinc-500">Try another search or status filter.</p></div> : (
          <div className="mt-5 overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm dark:border-white/10 dark:bg-[#0d0c11]">
            <div className="hidden grid-cols-[minmax(300px,2.2fr)_1fr_90px_90px_120px] gap-4 border-b border-black/5 px-5 py-3 text-[9px] font-black uppercase tracking-[.14em] text-zinc-400 dark:border-white/5 md:grid sm:px-6"><span>Raffle</span><span>Project</span><span>Winners</span><span>Entries</span><span>End date</span></div>
            {visible.map((raffle) => (
              <Link key={raffle.id} href={`/raffles/${raffle.id}`} className="group grid gap-4 border-b border-black/5 px-5 py-5 transition hover:bg-violet-500/[.03] last:border-b-0 dark:border-white/5 md:grid-cols-[minmax(300px,2.2fr)_1fr_90px_90px_120px] md:items-center sm:px-6">
                <div className="flex items-center gap-4">
                  <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl border border-black/10 bg-slate-100 text-sm font-black text-violet-500 dark:border-white/10 dark:bg-black/30 dark:text-violet-200">{raffle.project?.logoUrl ? <img src={raffle.project.logoUrl} alt="" className="h-full w-full object-cover" /> : "R"}</div>
                  <div className="min-w-0"><div className="flex items-center gap-2"><span className={`rounded-full border px-2.5 py-1 text-[8px] font-black uppercase ${raffle.status === "ACTIVE" ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-500" : "border-violet-500/20 bg-violet-500/5 text-violet-500"}`}>{raffle.status}</span><span className="truncate text-[9px] text-zinc-400">{timing(raffle)}</span></div><h2 className="mt-2 truncate text-sm font-semibold group-hover:text-violet-500">{raffle.title}</h2><p className="mt-1 truncate text-[10px] text-zinc-500">{raffle.prizeName} · {raffle.prizeQuantity} prize{raffle.prizeQuantity === 1 ? "" : "s"}</p></div>
                </div>
                <div className="pl-[4.5rem] text-xs text-zinc-500 md:pl-0">{raffle.project?.name ?? "Project"}<span className="mt-1 block text-[9px] uppercase tracking-[.1em] text-zinc-400">{raffle.project?.category ?? ""}</span></div>
                <div className="pl-[4.5rem] text-xs font-semibold md:pl-0">{raffle.winnerCount}</div>
                <div className="pl-[4.5rem] text-xs text-zinc-500 md:pl-0">{raffle._count.entries}</div>
                <div className="pl-[4.5rem] text-xs text-zinc-500 md:pl-0">{dateLabel(raffle.endsAt)}</div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
