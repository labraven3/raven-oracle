"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AdminLayout from "@/components/AdminLayout";
import { API_BASE_URL } from "@/lib/api-config";
type Project = { id: string; name: string; description?: string | null; logoUrl?: string | null; category: string; status: string; rejectionReason?: string | null; createdAt: string };
type Stats = { submittedProjects: number; approvedProjects: number; activeRaffles: number; entries: number; users: number };

async function api<T>(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers); headers.set("Content-Type", "application/json");
  const token = typeof window !== "undefined" ? localStorage.getItem("raven_token") : null; if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers }); const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message ?? `Request failed (${response.status})`); return data as T;
}

export default function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null); const [projects, setProjects] = useState<Project[]>([]); const [filter, setFilter] = useState("SUBMITTED");
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState<string | null>(null); const [message, setMessage] = useState(""); const [error, setError] = useState("");
  const [flaggedMessages, setFlaggedMessages] = useState(0);
  
  // TODO: Implement /api/chat/messages/flagged endpoint
  // useEffect(() => {
  //   async function loadFlagged() {
  //     try {
  //       const data = await api<{messages: unknown[]}>("/chat/messages/flagged");
  //       setFlaggedMessages(data.messages.length);
  //     } catch {
  //       // Silent fail - not critical
  //     }
  //   }
  //   void loadFlagged();
  // }, []);
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      setError("");
      try {
        const [overview, list] = await Promise.all([
          api<{ stats: Stats }>("/admin/overview"),
          api<{ projects: Project[] }>(`/admin/projects?status=${filter}`),
        ]);
        setStats(overview.stats);
        setProjects(list.projects);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unable to load moderation center");
      } finally {
        setLoading(false);
      }
    };
    void init();
  }, [filter]);
  
  const moderate = async (id: string, status: "APPROVED" | "REJECTED") => {
    setBusy(id);
    setError("");
    try {
      await api(`/admin/projects/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status,
          rejectionReason:
            status === "REJECTED"
              ? "Does not meet Raven Oracle NFT project requirements."
              : undefined,
        }),
      });
      setMessage(
        status === "APPROVED" ? "Project approved and published." : "Project rejected."
      );
      setLoading(true);
      setError("");
      try {
        const [overview, list] = await Promise.all([
          api<{ stats: Stats }>("/admin/overview"),
          api<{ projects: Project[] }>(`/admin/projects?status=${filter}`),
        ]);
        setStats(overview.stats);
        setProjects(list.projects);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unable to load moderation center");
      } finally {
        setLoading(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Moderation failed");
    } finally {
      setBusy(null);
    }
  };
  return (
    <AdminLayout>
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <span className="text-[9px] font-black tracking-[.2em] text-violet-300/60">OPERATIONS</span>
          <h1 className="mt-2 text-5xl font-medium tracking-tight">Moderation center.</h1>
          <p className="mt-3 text-sm text-zinc-600">
            Approve NFT communities before they become visible to participants.
          </p>
        </div>
        {error && (
          <div className="mt-6 rounded-xl border border-red-900/50 bg-red-950/20 p-4 text-sm text-red-300">
            {error}
          </div>
        )}
        {message && (
          <div className="mt-6 rounded-xl border border-emerald-900/50 bg-emerald-950/20 p-4 text-sm text-emerald-300">
            {message}
          </div>
        )}
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {stats &&
            Object.entries({
              SUBMITTED: stats.submittedProjects,
              APPROVED: stats.approvedProjects,
              "ACTIVE RAFFLES": stats.activeRaffles,
              ENTRIES: stats.entries,
              USERS: stats.users,
            }).map(([label, value]) => (
              <div key={label} className="rounded-xl border border-white/10 bg-[#0d0c11] p-4">
                <small className="text-[9px] font-black tracking-[.15em] text-zinc-600">
                  {label}
                </small>
                <b className="mt-2 block text-2xl">{value}</b>
              </div>
            ))}
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Link
            href="/admin/alpha"
            className="group rounded-xl border border-white/10 bg-[#0d0c11] p-6 transition-colors hover:border-violet-500/50"
          >
            <div className="flex items-center justify-between">
              <div>
                <b className="text-lg">Alpha Moderation</b>
                <p className="mt-1 text-xs text-zinc-600">Review community alpha submissions</p>
              </div>
              <span className="text-2xl opacity-50 transition-opacity group-hover:opacity-100">
                →
              </span>
            </div>
          </Link>
          <Link
            href="/admin/chat"
            className="group rounded-xl border border-white/10 bg-[#0d0c11] p-6 transition-colors hover:border-violet-500/50"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <b className="text-lg">Chat Moderation</b>
                  {flaggedMessages > 0 && (
                    <span className="rounded-full bg-red-500 px-2 py-0.5 text-[9px] font-black text-white">
                      {flaggedMessages}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-zinc-600">Moderate community chat messages</p>
              </div>
              <span className="text-2xl opacity-50 transition-opacity group-hover:opacity-100">
                →
              </span>
            </div>
          </Link>
          <Link
            href="/admin/users"
            className="group rounded-xl border border-white/10 bg-[#0d0c11] p-6 transition-colors hover:border-violet-500/50"
          >
            <div className="flex items-center justify-between">
              <div>
                <b className="text-lg">User Management</b>
                <p className="mt-1 text-xs text-zinc-600">View, suspend, ban users, and manage points</p>
              </div>
              <span className="text-2xl opacity-50 transition-opacity group-hover:opacity-100">
                →
              </span>
            </div>
          </Link>
          <Link
            href="/admin/raffles"
            className="group rounded-xl border border-white/10 bg-[#0d0c11] p-6 transition-colors hover:border-violet-500/50"
          >
            <div className="flex items-center justify-between">
              <div>
                <b className="text-lg">Raffle Management</b>
                <p className="mt-1 text-xs text-zinc-600">Cancel raffles and review winners</p>
              </div>
              <span className="text-2xl opacity-50 transition-opacity group-hover:opacity-100">
                →
              </span>
            </div>
          </Link>
          <Link
            href="/admin/audit-logs"
            className="group rounded-xl border border-white/10 bg-[#0d0c11] p-6 transition-colors hover:border-violet-500/50"
          >
            <div className="flex items-center justify-between">
              <div>
                <b className="text-lg">Audit Logs</b>
                <p className="mt-1 text-xs text-zinc-600">View system activity and admin actions</p>
              </div>
              <span className="text-2xl opacity-50 transition-opacity group-hover:opacity-100">
                →
              </span>
            </div>
          </Link>
          <Link
            href="/admin/hero-settings"
            className="group rounded-xl border border-white/10 bg-[#0d0c11] p-6 transition-colors hover:border-violet-500/50"
          >
            <div className="flex items-center justify-between">
              <div>
                <b className="text-lg">Hero Settings</b>
                <p className="mt-1 text-xs text-zinc-600">Customize home page hero section</p>
              </div>
              <span className="text-2xl opacity-50 transition-opacity group-hover:opacity-100">
                →
              </span>
            </div>
          </Link>
          <Link
            href="/admin/community-links"
            className="group rounded-xl border border-white/10 bg-[#0d0c11] p-6 transition-colors hover:border-violet-500/50"
          >
            <div className="flex items-center justify-between">
              <div>
                <b className="text-lg">Community Links</b>
                <p className="mt-1 text-xs text-zinc-600">Manage footer community section</p>
              </div>
              <span className="text-2xl opacity-50 transition-opacity group-hover:opacity-100">
                →
              </span>
            </div>
          </Link>
        </div>
        <div className="mt-10 flex flex-wrap gap-2">
          {["SUBMITTED", "APPROVED", "REJECTED"].map((item) => (
            <button
              key={item}
              onClick={() => setFilter(item)}
              className={`rounded-lg px-4 py-2 text-[10px] font-black ${
                filter === item
                  ? "bg-white text-black"
                  : "border border-white/10 text-zinc-500"
              }`}
            >
              {item}
            </button>
          ))}
          <button
            onClick={async () => {
              setLoading(true);
              setError("");
              try {
                const [overview, list] = await Promise.all([
                  api<{ stats: Stats }>("/admin/overview"),
                  api<{ projects: Project[] }>(`/admin/projects?status=${filter}`),
                ]);
                setStats(overview.stats);
                setProjects(list.projects);
              } catch (e) {
                setError(e instanceof Error ? e.message : "Unable to load moderation center");
              } finally {
                setLoading(false);
              }
            }}
            className="ml-auto rounded-lg border border-white/10 px-4 py-2 text-[10px] font-bold"
          >
            Refresh
          </button>
        </div>
        {loading ? (
          <div className="py-20 text-center text-sm text-zinc-600">Loading moderation queue…</div>
        ) : projects.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-white/10 p-16 text-center text-sm text-zinc-600">
            No {filter.toLowerCase()} NFT projects.
          </div>
        ) : (
          <div className="mt-5 grid gap-4">
            {projects.map((p) => (
              <article key={p.id} className="rounded-2xl border border-white/10 bg-[#0d0c11] p-5">
                <div className="flex flex-wrap gap-5">
                  <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-black">
                    {p.logoUrl ? (
                      <img src={p.logoUrl} alt={p.name} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-xl font-black">{p.name[0]}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-bold">{p.name}</h2>
                      <span className="rounded-full bg-violet-500/10 px-2 py-1 text-[9px] font-black text-violet-300">
                        {p.category}
                      </span>
                      <span className="rounded-full bg-white/5 px-2 py-1 text-[9px] text-zinc-500">
                        {p.status}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-zinc-500">
                      {p.description || "No description provided."}
                    </p>
                    <p className="mt-2 text-[10px] text-zinc-700">
                      Submitted {new Date(p.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                {p.status === "SUBMITTED" && (
                  <div className="mt-5 flex flex-wrap gap-2 border-t border-white/5 pt-4">
                    <Link
                      href={`/projects/${p.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-white/10 px-4 py-2 text-[10px] font-bold"
                    >
                      Preview
                    </Link>
                    <button
                      disabled={busy === p.id}
                      onClick={() => void moderate(p.id, "REJECTED")}
                      className="rounded-lg border border-red-900/40 px-4 py-2 text-[10px] font-bold text-red-300"
                    >
                      Reject
                    </button>
                    <button
                      disabled={busy === p.id}
                      onClick={() => void moderate(p.id, "APPROVED")}
                      className="rounded-lg bg-emerald-500 px-4 py-2 text-[10px] font-black text-black"
                    >
                      {busy === p.id ? "Saving…" : "Approve & publish"}
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
