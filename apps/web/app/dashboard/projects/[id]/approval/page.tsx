"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import SiteHeader from "../../../../../components/SiteHeader";
import { API_BASE_URL } from "@/lib/api-config";

type Issue = { code: string; field: string; message: string };
type HistoryItem = { id: string; action: string; summary: string; createdAt: string };
type Readiness = { ready: boolean; issues: Issue[]; history: HistoryItem[]; project?: { name: string; status: string; projectType: string; chain: string | null; rejectionReason?: string | null } | null };

async function api<T>(path: string, options: RequestInit = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers: { "Content-Type": "application/json", ...(options.headers ?? {}) }, credentials: "include", cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message ?? `Request failed (${response.status})`);
  return data as T;
}

export default function ProjectApprovalPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<Readiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = async () => {
    setLoading(true); setError("");
    try { setData(await api<Readiness>(`/project-approval/${id}`)); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to load approval readiness"); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [id]);

  const resubmit = async () => {
    setBusy(true); setError(""); setMessage("");
    try { await api(`/project-approval/${id}/resubmit`, { method: "POST" }); setMessage("Project resubmitted for admin review."); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to resubmit project"); }
    finally { setBusy(false); }
  };

  return (
    <main className="min-h-screen bg-[#06060a] text-zinc-100">
      <SiteHeader />
      <div className="mx-auto max-w-5xl px-5 py-10">
        <Link href={`/dashboard/projects/${id}`} className="text-xs text-zinc-500 hover:text-violet-300">← Project dashboard</Link>
        {loading ? <div className="py-20 text-center text-sm text-zinc-600">Checking project readiness…</div> : error && !data ? <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-950/20 p-6 text-sm text-red-300">{error}</div> : data && (
          <>
            <section className="mt-8 rounded-3xl border border-white/10 bg-[#0d0c11] p-7 sm:p-9">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span className="text-[9px] font-black tracking-[.2em] text-violet-300/60">SUBMISSION READINESS</span>
                  <h1 className="mt-2 text-4xl font-medium">{data.project?.name}</h1>
                  <p className="mt-2 text-xs text-zinc-600">{data.project?.projectType} · {data.project?.chain ?? "No chain"} · {data.project?.status}</p>
                </div>
                <div className={`rounded-full px-4 py-2 text-[10px] font-black ${data.ready ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-300"}`}>{data.ready ? "READY FOR REVIEW" : `${data.issues.length} ITEMS TO FIX`}</div>
              </div>

              {data.project?.status === "REJECTED" && data.project.rejectionReason && (
                <div className="mt-8 rounded-2xl border border-red-500/20 bg-red-500/5 p-6">
                  <div className="text-[9px] font-black uppercase tracking-[.18em] text-red-300">ADMIN REJECTION REASON</div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-300">{data.project.rejectionReason}</p>
                </div>
              )}

              {data.ready ? (
                <div className="mt-8 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6 text-sm leading-6 text-emerald-200">
                  {data.project?.status === "REJECTED" ? "Your project has been fixed and is ready to be resubmitted." : "Your project has the required chain, project information, type and metadata. It is ready for admin review."}
                  {data.project?.status === "REJECTED" && <button disabled={busy} onClick={() => void resubmit()} className="mt-5 rounded-xl bg-violet-500 px-5 py-3 text-xs font-black text-white disabled:opacity-40">{busy ? "Resubmitting…" : "Resubmit for review"}</button>}
                </div>
              ) : (
                <div className="mt-8">
                  <h2 className="text-xl font-medium">Missing or invalid information</h2>
                  <div className="mt-4 space-y-3">{data.issues.map((issue) => <div key={`${issue.code}-${issue.field}`} className="rounded-2xl border border-amber-500/15 bg-amber-500/5 p-4"><div className="text-[10px] font-black uppercase tracking-[.12em] text-amber-300">{issue.field}</div><p className="mt-1 text-sm text-zinc-300">{issue.message}</p></div>)}</div>
                  <Link href={`/dashboard/projects/${id}/metadata`} className="mt-6 inline-flex rounded-xl bg-violet-500 px-5 py-3 text-xs font-black text-white">Fix project information →</Link>
                </div>
              )}
              {message && <div className="mt-5 rounded-xl border border-emerald-900/50 bg-emerald-950/20 p-4 text-sm text-emerald-300">{message}</div>}
              {error && <div className="mt-5 rounded-xl border border-red-900/50 bg-red-950/20 p-4 text-sm text-red-300">{error}</div>}
            </section>

            <section className="mt-6 rounded-3xl border border-white/10 bg-[#0d0c11] p-7">
              <span className="text-[9px] font-black tracking-[.2em] text-violet-300/60">PROJECT HISTORY</span>
              <h2 className="mt-2 text-2xl font-medium">Audit timeline</h2>
              {data.history.length === 0 ? <div className="mt-6 rounded-xl border border-dashed border-white/10 p-10 text-center text-sm text-zinc-600">No project history yet.</div> : <div className="mt-6 space-y-3">{data.history.map((item) => <div key={item.id} className="rounded-2xl border border-white/10 bg-black/20 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-[9px] font-black tracking-[.12em] text-violet-300">{item.action}</span><time className="text-[10px] text-zinc-600">{new Date(item.createdAt).toLocaleString()}</time></div><p className="mt-2 text-sm text-zinc-300">{item.summary}</p></div>)}</div>}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
