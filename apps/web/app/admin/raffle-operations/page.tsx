"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AdminLayout from "../../../components/AdminLayout";
import { API_BASE_URL } from "@/lib/api-config";

type ProjectType = "ALL" | "NFT" | "TOKEN" | "AIRDROP" | "OTHER";
type Status = "ALL" | "DRAFT" | "SCHEDULED" | "ACTIVE" | "CLOSED" | "DRAWING" | "COMPLETED" | "CANCELLED";
type Raffle = { id: string; title: string; prizeName: string; status: Exclude<Status,"ALL">; startsAt: string; endsAt: string; winnerCount: number; projectId: string; project?: { id: string; name: string; logoUrl?: string | null; category: string } | null; createdBy?: { username?: string | null; email?: string | null }; _count: { entries: number; winners: number; tasks: number } };
type Summary = { raffle: { id: string; title: string; status: string; winnerCount: number; prizeName: string }; entries: Array<{ status: string; _count: { _all: number } }>; winners: Array<{ id: string; selectionRank: number; status: string; notificationStatus: string; walletAddressSnapshot: string; selectedAt: string; notifiedAt?: string | null; user?: { username?: string | null; displayName?: string | null; email?: string | null } | null }> };

async function api<T>(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  const token = typeof window !== "undefined" ? localStorage.getItem("raven_token") : null;
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers, credentials: "include", cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message ?? `Request failed (${response.status})`);
  return data as T;
}

const statuses: Status[] = ["ALL","DRAFT","SCHEDULED","ACTIVE","CLOSED","DRAWING","COMPLETED","CANCELLED"];
const types: ProjectType[] = ["ALL","NFT","TOKEN","AIRDROP","OTHER"];

export default function AdminRaffleOperationsPage() {
  const [status,setStatus]=useState<Status>("ALL");
  const [type,setType]=useState<ProjectType>("ALL");
  const [raffles,setRaffles]=useState<Raffle[]>([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState<string | null>(null);
  const [exporting,setExporting]=useState<string | null>(null);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  const [summary,setSummary]=useState<Summary|null>(null);

  const load=useCallback(async()=>{
    setLoading(true);setError("");
    try{
      const q=new URLSearchParams();
      if(status!=="ALL")q.set("status",status);
      if(type!=="ALL")q.set("projectType",type);
      const data=await api<{raffles:Raffle[]}>(`/admin/raffle-operations?${q.toString()}`);
      setRaffles(data.raffles??[]);
    }catch(e){setError(e instanceof Error?e.message:"Unable to load raffle operations");}
    finally{setLoading(false);}
  },[status,type]);

  useEffect(()=>{void load();},[load]);

  const act=async(id:string, action:"evaluate"|"draw")=>{
    setBusy(id);setError("");setMessage("");
    try{
      const data=await api<{success:boolean;evaluated?:number;result?:{winners?:unknown[]}}>(`/admin/raffle-operations/${id}/${action}`,{method:"POST"});
      setMessage(action==="evaluate"?`Evaluation complete. ${data.evaluated??0} entries processed.`:`Draw complete. ${data.result?.winners?.length??0} winners selected.`);
      await load();
    }catch(e){setError(e instanceof Error?e.message:`Unable to ${action} raffle`);}
    finally{setBusy(null);}
  };

  const viewSummary=async(id:string)=>{
    setBusy(id);setError("");
    try{setSummary(await api<Summary>(`/admin/raffle-operations/${id}/summary`));}
    catch(e){setError(e instanceof Error?e.message:"Unable to load raffle summary");}
    finally{setBusy(null);}
  };

  const exportWinners=async(id:string)=>{
    setExporting(id);setError("");setMessage("");
    try{
      const headers=new Headers();
      const token=typeof window!=="undefined"?localStorage.getItem("raven_token"):null;
      if(token)headers.set("Authorization",`Bearer ${token}`);
      const response=await fetch(`${API_BASE_URL}/admin/raffle-operations/${id}/winners/export.csv`,{headers,credentials:"include",cache:"no-store"});
      if(!response.ok){const data=await response.json().catch(()=>({}));throw new Error(data.message??`Export failed (${response.status})`);}
      const blob=await response.blob();
      const url=URL.createObjectURL(blob);
      const anchor=document.createElement("a");
      anchor.href=url;
      anchor.download=`raven-oracle-${id}-winners.csv`;
      document.body.appendChild(anchor);anchor.click();anchor.remove();
      URL.revokeObjectURL(url);
      setMessage("Winner CSV exported.");
    }catch(e){setError(e instanceof Error?e.message:"Unable to export winners");}
    finally{setExporting(null);}
  };

  const counts=useMemo(()=>{const out:Record<string,number>={};for(const r of raffles)out[r.status]=(out[r.status]??0)+1;return out;},[raffles]);

  return <AdminLayout><div className="mx-auto max-w-7xl">
    <div className="mb-8"><span className="text-[9px] font-black tracking-[.2em] text-violet-300/60">OPERATIONS</span><h1 className="mt-2 text-5xl font-medium tracking-tight">Raffle operations.</h1><p className="mt-3 text-sm text-zinc-600">Central admin oversight for NFT, token, airdrop and other raffle lifecycles.</p></div>
    {error&&<div className="mt-6 rounded-xl border border-red-900/50 bg-red-950/20 p-4 text-sm text-red-300">{error}</div>}
    {message&&<div className="mt-6 rounded-xl border border-emerald-900/50 bg-emerald-950/20 p-4 text-sm text-emerald-300">{message}</div>}
    <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-7">{statuses.filter(s=>s!=="ALL").map(s=><button key={s} onClick={()=>setStatus(s)} className={`rounded-xl border p-3 text-left ${status===s?"border-violet-400/40 bg-violet-500/5":"border-white/10 bg-[#0d0c11]"}`}><span className="text-[8px] font-black tracking-[.12em] text-zinc-600">{s}</span><b className="mt-1 block text-xl">{counts[s]??0}</b></button>)}</div>
    <div className="mt-6 flex flex-wrap gap-2">{types.map(t=><button key={t} onClick={()=>setType(t)} className={`rounded-full border px-4 py-2 text-[9px] font-black ${type===t?"border-violet-400 bg-violet-500 text-white":"border-white/10 text-zinc-500"}`}>{t}</button>)}<button onClick={()=>void load()} className="ml-auto rounded-lg border border-white/10 px-4 py-2 text-[10px] font-bold">Refresh</button></div>
    {loading?<div className="py-20 text-center text-sm text-zinc-600">Loading raffle operations…</div>:raffles.length===0?<div className="mt-6 rounded-2xl border border-dashed border-white/10 p-16 text-center text-sm text-zinc-600">No raffles match the current filters.</div>:<div className="mt-6 grid gap-4">{raffles.map(r=><article key={r.id} className="rounded-2xl border border-white/10 bg-[#0d0c11] p-5"><div className="flex gap-4"><div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-black">{r.project?.logoUrl?<img src={r.project.logoUrl} alt="" className="h-full w-full object-cover"/>:<span className="font-black">{r.project?.name?.[0]??"R"}</span>}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="font-bold">{r.title}</h2><span className="rounded-full bg-violet-500/10 px-2 py-1 text-[8px] font-black text-violet-300">{type!=="ALL"?type:"PROJECT"}</span><span className="rounded-full bg-white/5 px-2 py-1 text-[8px] font-black text-zinc-500">{r.status}</span></div><p className="mt-2 text-sm text-zinc-500">{r.project?.name??"Project"} · {r.prizeName}</p><div className="mt-2 flex flex-wrap gap-3 text-[10px] text-zinc-600"><span>{r._count.entries} entries</span><span>{r._count.tasks} tasks</span><span>{r._count.winners} winners</span><span>{r.winnerCount} winner slots</span></div></div></div><div className="mt-4 flex flex-wrap gap-2 border-t border-white/5 pt-4"><Link href={`/raffles/${r.id}`} target="_blank" className="rounded-lg border border-white/10 px-3 py-2 text-[10px] font-bold">Public Page</Link>{(r.status==="CLOSED"||r.status==="DRAWING")&&<button disabled={busy===r.id} onClick={()=>void act(r.id,"evaluate")} className="rounded-lg border border-amber-500/20 px-3 py-2 text-[10px] font-bold text-amber-300">{busy===r.id?"Working…":"Evaluate"}</button>}{r.status==="CLOSED"&&<button disabled={busy===r.id} onClick={()=>void act(r.id,"draw")} className="rounded-lg bg-violet-500 px-3 py-2 text-[10px] font-black text-white">{busy===r.id?"Drawing…":"Draw Winners"}</button>}{r.status==="COMPLETED"&&<button disabled={exporting===r.id} onClick={()=>void exportWinners(r.id)} className="rounded-lg border border-emerald-500/20 px-3 py-2 text-[10px] font-bold text-emerald-300">{exporting===r.id?"Exporting…":"Export Winners"}</button>}<button disabled={busy===r.id} onClick={()=>void viewSummary(r.id)} className="ml-auto rounded-lg border border-white/10 px-3 py-2 text-[10px] font-bold">Summary</button></div></article>)}</div>}
    {summary&&<div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4"><div className="max-h-[85vh] w-full max-w-3xl overflow-auto rounded-2xl border border-white/10 bg-[#0d0c11] p-6"><div className="flex items-start justify-between"><div><span className="text-[9px] text-zinc-600">RAFFLE SUMMARY</span><h2 className="mt-2 text-2xl font-semibold">{summary.raffle.title}</h2><p className="mt-1 text-xs text-zinc-500">{summary.raffle.status} · {summary.raffle.prizeName}</p></div><div className="flex gap-2"><button onClick={()=>void exportWinners(summary.raffle.id)} disabled={exporting===summary.raffle.id} className="rounded-lg border border-emerald-500/20 px-3 py-2 text-xs text-emerald-300">{exporting===summary.raffle.id?"Exporting…":"Export CSV"}</button><button onClick={()=>setSummary(null)} className="rounded-lg border border-white/10 px-3 py-2 text-xs">Close</button></div></div><div className="mt-6 grid gap-3 sm:grid-cols-4">{summary.entries.map(e=><div key={e.status} className="rounded-xl border border-white/10 bg-black/20 p-3"><span className="text-[8px] text-zinc-600">{e.status}</span><b className="mt-1 block text-xl">{e._count._all}</b></div>)}</div><h3 className="mt-7 text-sm font-bold">Winners</h3><div className="mt-3 space-y-2">{summary.winners.length===0?<p className="text-sm text-zinc-600">No winners selected.</p>:summary.winners.map(w=><div key={w.id} className="rounded-xl border border-white/10 bg-black/20 p-4"><div className="flex items-center justify-between gap-3"><div><b>#{w.selectionRank} · {w.user?.displayName||w.user?.username||w.user?.email||"Unknown"}</b><p className="mt-1 text-[10px] text-zinc-600">{w.walletAddressSnapshot}</p></div><div className="text-right text-[9px] text-zinc-500">{w.status}<br/>{w.notificationStatus}</div></div></div>)}</div></div></div>}
  </div></AdminLayout>;
}
