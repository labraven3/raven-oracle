"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import SiteHeader from "../../../../../components/SiteHeader";
import { API_BASE_URL } from "@/lib/api-config";

type Winner = { id: string; selectionRank: number; walletAddressSnapshot: string; status: string; notificationStatus: string; selectedAt: string; notifiedAt?: string | null; user: { displayName?: string | null; username?: string | null; email?: string | null; emailVerifiedAt?: string | null } };
type Raffle = { id: string; title: string; prizeName: string; status: string; winnerCount: number };

async function api<T>(path: string, options: RequestInit = {}) { const headers = new Headers(options.headers); const token = typeof window !== "undefined" ? localStorage.getItem("raven_token") : null; if (token) headers.set("Authorization", `Bearer ${token}`); headers.set("Content-Type", "application/json"); const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers, credentials: "include", cache: "no-store" }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.message ?? `Request failed (${response.status})`); return data as T; }

export default function WinnerCenterPage() {
  const { id } = useParams<{ id: string }>();
  const [raffle,setRaffle]=useState<Raffle|null>(null),[winners,setWinners]=useState<Winner[]>([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(""),[error,setError]=useState(""),[message,setMessage]=useState("");
  const load = async()=>{setLoading(true);setError("");try{const data=await api<{raffle:Raffle;winners:Winner[];viewer:string}>(`/raffles/${id}/winners`);setRaffle(data.raffle);setWinners(data.winners??[])}catch(e){setError(e instanceof Error?e.message:"Unable to load Winner Center")}finally{setLoading(false)}};
  useEffect(()=>{void load()},[id]);
  const notify=async(winnerId:string,resend=false)=>{setBusy(winnerId);setError("");setMessage("");try{await api(`/raffles/${id}/winners/${winnerId}/${resend?"resend":"notify"}`,{method:"POST"});setMessage(resend?"Winner email resent.":"Winner email sent.");await load()}catch(e){setError(e instanceof Error?e.message:"Notification failed")}finally{setBusy("")}};
  const exportGoogleSheet = async () => {
    setBusy("google-sheet"); setError(""); setMessage("");
    try {
      const data = await api<{ spreadsheetUrl: string; message?: string }>(`/raffles/${id}/winners/export/google-sheets`, { method: "POST", body: JSON.stringify({}) });
      setMessage(data.message ?? "Winner Google Sheet created.");
      window.open(data.spreadsheetUrl, "_blank", "noopener,noreferrer");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to create Google Sheet"); }
    finally { setBusy(""); }
  };
  if(loading)return <main className="min-h-screen bg-[#06060a] text-zinc-500"><SiteHeader/><div className="mx-auto max-w-6xl p-10">Loading Winner Center…</div></main>;
  return <main className="min-h-screen bg-[#06060a] text-zinc-100"><SiteHeader/><div className="mx-auto max-w-6xl px-5 py-8"><div className="flex flex-wrap items-center justify-between gap-3"><Link href={`/dashboard/raffles/${id}`} className="text-xs text-zinc-500 hover:text-violet-300">← Raffle operations</Link><div className="flex flex-wrap gap-2"><a href={`${API_BASE_URL}/raffles/${id}/winners/export`} target="_blank" rel="noreferrer" className="rounded-xl border border-white/10 px-4 py-2.5 text-xs font-black">Export CSV</a><button type="button" onClick={()=>void exportGoogleSheet()} disabled={busy==="google-sheet"||winners.length===0} className="rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-black text-black disabled:cursor-not-allowed disabled:opacity-40">{busy==="google-sheet"?"Creating Sheet…":"Export to Google Sheets"}</button></div></div><section className="mt-5 rounded-3xl border border-white/10 bg-[#0d0c11] p-7"><span className="text-[9px] font-black tracking-[.2em] text-violet-300/60">WINNER CENTER</span><h1 className="mt-2 text-4xl font-semibold">{raffle?.title}</h1><p className="mt-2 text-sm text-zinc-500">{raffle?.prizeName} · {winners.length} / {raffle?.winnerCount ?? 0} winners</p></section>{error&&<div className="mt-5 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300">{error}</div>}{message&&<div className="mt-5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-emerald-300">{message}</div>}<section className="mt-6 space-y-3">{winners.length===0?<div className="rounded-2xl border border-dashed border-white/10 p-14 text-center text-sm text-zinc-600">No winners have been selected yet.</div>:winners.map(w=><article key={w.id} className="rounded-2xl border border-white/10 bg-[#0d0c11] p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-center"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-violet-500/10 text-lg font-black text-violet-300">#{w.selectionRank}</div><div className="min-w-0 flex-1"><b className="block truncate">{w.user.displayName||w.user.username||w.user.email||"Winner"}</b><span className="mt-1 block truncate text-xs text-zinc-500">{w.walletAddressSnapshot}</span><span className="mt-1 block text-[10px] text-zinc-600">{w.user.email||"No email"} · {w.user.emailVerifiedAt?"email verified":"email not verified"}</span></div><div className="flex flex-wrap gap-2 text-[10px] font-black"><span className="rounded-lg border border-white/10 px-3 py-2">{w.status}</span><span className="rounded-lg border border-white/10 px-3 py-2">{w.notificationStatus}</span>{w.notificationStatus==="SENT"?<button disabled={busy===w.id} onClick={()=>void notify(w.id,true)} className="rounded-lg bg-violet-500 px-3 py-2 text-white">{busy===w.id?"Sending…":"Resend email"}</button>:<button disabled={busy===w.id} onClick={()=>void notify(w.id)} className="rounded-lg bg-violet-500 px-3 py-2 text-white">{busy===w.id?"Sending…":"Notify winner"}</button>}</div></div></article>)}</section></div></main>;
}
