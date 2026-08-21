"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import SiteHeader from "../../components/SiteHeader";
import { API_BASE_URL } from "@/lib/api-config";

type Submission = { id: string; title: string; description: string; opportunityType: string; status: string; pointsAwarded?: number | null; createdAt: string; submittedBy?: { username?: string | null; displayName?: string | null; avatarUrl?: string | null }; project?: { name?: string | null } | null };
type Leader = { userId: string; username?: string | null; displayName?: string | null; avatarUrl?: string | null; points: number };

async function api<T>(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers); headers.set("Content-Type", "application/json");
  const token = typeof window !== "undefined" ? localStorage.getItem("raven_token") : null;
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers, credentials: "include", cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message ?? `Request failed (${response.status})`);
  return data as T;
}

export default function AlphaPage() {
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [title, setTitle] = useState(""); const [description, setDescription] = useState(""); const [links, setLinks] = useState(""); const [type, setType] = useState("MINT");
  const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false); const [query, setQuery] = useState("");

  const load = async () => {
    try {
      const [leaderboardRes, submissionsRes] = await Promise.all([api<{ leaderboard: Leader[] }>("/alpha/leaderboard"), api<{ submissions: Submission[] }>("/alpha")]);
      setLeaders(leaderboardRes.leaderboard); setSubmissions(submissionsRes.submissions);
    } catch (e) { setMessage(e instanceof Error ? e.message : "Unable to load alpha"); }
  };
  useEffect(() => { void load(); }, []);

  const visibleSubmissions = useMemo(() => {
    const q = query.trim().toLowerCase();
    return submissions.filter((item) => !q || `${item.title} ${item.description} ${item.opportunityType} ${item.project?.name ?? ""}`.toLowerCase().includes(q));
  }, [submissions, query]);

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setMessage("");
    try {
      await api("/alpha", { method: "POST", body: JSON.stringify({ title, description, opportunityType: type, evidenceLinks: links.split("\n").map((x) => x.trim()).filter(Boolean) }) });
      setTitle(""); setDescription(""); setLinks(""); setMessage("Alpha submitted for review. Points are awarded after verification."); await load();
    } catch (e) { setMessage(e instanceof Error ? e.message : "Submission failed"); } finally { setBusy(false); }
  };

  return (
    <main className="min-h-screen bg-[#f7f8fb] text-[#15151d] dark:bg-[#07070a] dark:text-zinc-100">
      <SiteHeader />
      <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
        <header className="border-b border-black/5 pb-7 dark:border-white/10">
          <div className="max-w-3xl">
            <div className="text-[10px] font-black uppercase tracking-[.24em] text-violet-500 dark:text-violet-300">King of Alpha</div>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">Find it. Verify it. Earn it.</h1>
            <p className="mt-3 text-sm leading-6 text-zinc-500">Share useful Web3 opportunities with evidence. Verified discoveries strengthen your reputation and earn points.</p>
          </div>
        </header>

        <section className="mt-7 grid gap-4 md:grid-cols-3">
          {[{ label: "Verified contributors", value: leaders.length }, { label: "Alpha submissions", value: submissions.length }, { label: "Verification standard", value: "Evidence first" }].map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#0d0c11]"><div className="text-[9px] font-black uppercase tracking-[.15em] text-zinc-400">{stat.label}</div><div className="mt-3 text-xl font-semibold">{stat.value}</div></div>
          ))}
        </section>

        <div className="mt-5 grid gap-5 lg:grid-cols-[1.6fr_.9fr]">
          <section className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#0d0c11] sm:p-7">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><div className="text-[9px] font-black uppercase tracking-[.18em] text-violet-500 dark:text-violet-300">Submit</div><h2 className="mt-1 text-2xl font-semibold">Share an alpha opportunity</h2></div><span className="text-[9px] font-black uppercase tracking-[.12em] text-zinc-400">Verified only = points</span></div>
            <form onSubmit={submit} className="mt-6 space-y-3">
              <input value={title} onChange={(e) => setTitle(e.target.value)} required minLength={4} maxLength={160} placeholder="Opportunity title" className="w-full rounded-xl border border-black/10 bg-[#fafafa] px-4 py-3 text-sm outline-none focus:border-violet-400 dark:border-white/10 dark:bg-black/20" />
              <select value={type} onChange={(e) => setType(e.target.value)} className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm outline-none dark:border-white/10 dark:bg-[#111218]"><option value="MINT">Mint</option><option value="AIRDROP">Airdrop</option><option value="WL">Whitelist</option><option value="TRADING">Trading</option><option value="TOOL">Tool</option><option value="SECURITY">Security</option><option value="OTHER">Other</option></select>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} required minLength={20} rows={6} placeholder="Explain what you found, why it matters, and how someone can verify it." className="w-full rounded-xl border border-black/10 bg-[#fafafa] px-4 py-3 text-sm outline-none focus:border-violet-400 dark:border-white/10 dark:bg-black/20" />
              <textarea value={links} onChange={(e) => setLinks(e.target.value)} required rows={4} placeholder="Evidence URLs — one per line" className="w-full rounded-xl border border-black/10 bg-[#fafafa] px-4 py-3 text-sm outline-none focus:border-violet-400 dark:border-white/10 dark:bg-black/20" />
              <button disabled={busy} className="w-full rounded-xl bg-violet-600 py-3 text-xs font-black text-white shadow-lg shadow-violet-600/20 transition hover:bg-violet-500 disabled:opacity-50">{busy ? "Submitting…" : "Submit for review"}</button>
            </form>
            {message && <p className="mt-4 rounded-xl border border-black/5 bg-[#fafafa] p-3 text-xs text-zinc-500 dark:border-white/10 dark:bg-black/20">{message}</p>}
          </section>

          <aside className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#0d0c11] sm:p-7">
            <div className="flex items-end justify-between"><div><div className="text-[9px] font-black uppercase tracking-[.18em] text-violet-500 dark:text-violet-300">Rankings</div><h2 className="mt-1 text-2xl font-semibold">Top contributors</h2></div><span className="text-[9px] text-zinc-400">POINTS</span></div>
            <div className="mt-5 space-y-2">
              {leaders.length === 0 ? <p className="text-xs text-zinc-500">No verified points yet.</p> : leaders.slice(0, 10).map((user, index) => (
                <div key={user.userId} className={`flex items-center gap-3 rounded-xl border p-3 ${index < 3 ? "border-violet-400/20 bg-violet-500/5" : "border-black/5 bg-[#fafafa] dark:border-white/5 dark:bg-black/10"}`}>
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-violet-500/10 text-[10px] font-black text-violet-500">{index + 1}</span>
                  <div className="grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-violet-500/10 text-xs font-black text-violet-500">{user.avatarUrl ? <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" /> : (user.displayName || user.username || "?").slice(0, 1).toUpperCase()}</div>
                  <div className="min-w-0 flex-1"><b className="block truncate text-xs">{user.displayName || user.username || "Anonymous"}</b><span className="text-[9px] text-zinc-400">{user.username ? `@${user.username}` : "Raven member"}</span></div>
                  <strong className="text-xs text-violet-500">{user.points}</strong>
                </div>
              ))}
            </div>
          </aside>
        </div>

        <section className="mt-5 rounded-2xl border border-black/5 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#0d0c11] sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><div className="text-[9px] font-black uppercase tracking-[.18em] text-zinc-400">Discovery feed</div><h2 className="mt-1 text-2xl font-semibold">Verified alpha</h2></div><div className="flex items-center gap-3"><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search alpha" className="rounded-xl border border-black/10 bg-[#fafafa] px-4 py-2.5 text-xs outline-none dark:border-white/10 dark:bg-black/20" /><span className="text-[9px] font-black uppercase tracking-[.12em] text-zinc-400">{visibleSubmissions.length} results</span></div></div>
          {visibleSubmissions.length === 0 ? <div className="mt-5 rounded-xl border border-dashed border-black/10 p-12 text-center text-sm text-zinc-500 dark:border-white/10">No verified alpha matches your search.</div> : <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {visibleSubmissions.map((submission) => <article key={submission.id} className="group rounded-2xl border border-black/5 bg-[#fafafa] p-5 transition hover:border-violet-300 dark:border-white/10 dark:bg-black/10 dark:hover:border-violet-500/40"><div className="flex items-center justify-between gap-3"><span className="rounded-full bg-violet-500/10 px-2.5 py-1 text-[8px] font-black uppercase tracking-[.1em] text-violet-500">{submission.opportunityType}</span><span className="text-[9px] text-emerald-500">{submission.status}</span></div><h3 className="mt-3 text-sm font-semibold group-hover:text-violet-500">{submission.title}</h3><p className="mt-2 line-clamp-3 text-xs leading-5 text-zinc-500">{submission.description}</p><div className="mt-5 flex items-center justify-between border-t border-black/5 pt-4 text-[9px] text-zinc-400 dark:border-white/5"><span>{submission.project?.name || "Community"}</span><span className="font-black text-violet-500">{submission.pointsAwarded ? `${submission.pointsAwarded} pts` : "Pending"}</span></div></article>)}
          </div>}
        </section>
      </div>
    </main>
  );
}
