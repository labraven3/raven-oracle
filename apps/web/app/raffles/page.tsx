"use client";

import { useEffect, useMemo, useState } from "react";

type Raffle = {
  id: string;
  title: string;
  description?: string | null;
  prizeName: string;
  prizeQuantity: number;
  startsAt: string;
  endsAt: string;
  status: "SCHEDULED" | "ACTIVE" | "CLOSED" | "COMPLETED";
};

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

function formatDate(value: string) {
  return new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function timeLabel(raffle: Raffle) {
  const now = Date.now();
  const start = new Date(raffle.startsAt).getTime();
  const end = new Date(raffle.endsAt).getTime();
  if (raffle.status === "SCHEDULED" || start > now) return `Starts ${formatDate(raffle.startsAt)}`;
  if (raffle.status === "ACTIVE" && end > now) return `Ends ${formatDate(raffle.endsAt)}`;
  return "Ended";
}

export default function RafflesPage() {
  const [raffles, setRaffles] = useState<Raffle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"ALL" | "ACTIVE" | "SCHEDULED" | "COMPLETED">("ALL");

  useEffect(() => {
    let cancelled = false;
    fetch(`${API}/raffles/public`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message ?? "Unable to load raffles");
        return data as { raffles: Raffle[] };
      })
      .then((data) => { if (!cancelled) setRaffles(data.raffles); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Unable to load raffles"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const visible = useMemo(
    () => filter === "ALL" ? raffles : raffles.filter((raffle) => raffle.status === filter),
    [raffles, filter],
  );

  return (
    <main className="min-h-screen bg-[#07070a] text-zinc-100">
      <header className="border-b border-white/10 bg-[#07070a]/90 backdrop-blur-xl">
        <div className="mx-auto flex min-h-[72px] w-[min(1180px,calc(100%-32px))] items-center justify-between">
          <a href="/" className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl border border-violet-400/25 bg-violet-950/20 font-black text-violet-200">R</span>
            <span><b className="block text-sm tracking-[.18em]">RAVEN ORACLE</b><small className="text-[9px] tracking-[.16em] text-zinc-600">RAFFLES</small></span>
          </a>
          <a href="/create" className="rounded-lg bg-violet-500 px-4 py-2.5 text-xs font-black">Create raffle</a>
        </div>
      </header>

      <div className="mx-auto w-[min(1180px,calc(100%-32px))] py-14">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <span className="text-[9px] font-black tracking-[.2em] text-violet-300/60">DISCOVER</span>
            <h1 className="mt-2 text-5xl font-medium tracking-tight">Live raffles.</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-500">Find active drops, upcoming giveaways and completed draws. No wallet connection is required just to browse.</p>
          </div>
          <div className="flex gap-2 rounded-xl border border-white/10 bg-[#0d0c11] p-1">
            {(["ALL", "ACTIVE", "SCHEDULED", "COMPLETED"] as const).map((item) => (
              <button key={item} onClick={() => setFilter(item)} className={`rounded-lg px-3 py-2 text-[10px] font-black tracking-wide ${filter === item ? "bg-white text-black" : "text-zinc-500 hover:text-zinc-200"}`}>{item}</button>
            ))}
          </div>
        </div>

        {error && <div className="mt-8 rounded-xl border border-red-900/50 bg-red-950/20 p-4 text-sm text-red-300">{error}</div>}
        {loading ? <div className="py-24 text-center text-sm text-zinc-600">Loading raffles…</div> : visible.length === 0 ? <div className="mt-10 rounded-2xl border border-dashed border-white/10 p-16 text-center"><p className="text-zinc-500">No raffles match this filter.</p></div> : <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {visible.map((raffle) => (
            <a key={raffle.id} href={`/raffles/${raffle.id}`} className="group rounded-2xl border border-white/10 bg-[#0d0c11] p-6 transition hover:-translate-y-0.5 hover:border-violet-400/30 hover:bg-[#100e15]">
              <div className="flex items-center justify-between gap-3">
                <span className={`rounded-full px-2.5 py-1 text-[9px] font-black ${raffle.status === "ACTIVE" ? "bg-emerald-950/50 text-emerald-300" : raffle.status === "SCHEDULED" ? "bg-violet-950/50 text-violet-300" : "bg-white/5 text-zinc-500"}`}>{raffle.status}</span>
                <span className="text-[10px] text-zinc-600">{timeLabel(raffle)}</span>
              </div>
              <h2 className="mt-6 line-clamp-2 text-xl font-bold group-hover:text-violet-200">{raffle.title}</h2>
              <p className="mt-2 line-clamp-2 min-h-10 text-xs leading-5 text-zinc-600">{raffle.description ?? "Enter this raffle for a chance to win."}</p>
              <div className="mt-6 border-t border-white/5 pt-5">
                <small className="text-[9px] font-black tracking-[.15em] text-zinc-600">PRIZE</small>
                <p className="mt-1 font-bold">{raffle.prizeName}</p>
                <p className="mt-1 text-[10px] text-zinc-600">{raffle.prizeQuantity} winner{raffle.prizeQuantity === 1 ? "" : "s"} · View raffle →</p>
              </div>
            </a>
          ))}
        </div>}
      </div>
    </main>
  );
}
