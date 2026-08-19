"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import ThemeToggle from "../../../components/ThemeToggle";
import { API_BASE_URL } from "@/lib/api-config";

type PendingUser = {
  id: string;
  email?: string | null;
  username?: string | null;
  createdAt: string;
  _count: {
    raffleEntries: number;
    alphaSubmissions: number;
    chatMessages: number;
    walletAddresses: number;
  };
};

async function api<T>(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  const token = typeof window !== "undefined" ? localStorage.getItem("raven_admin_token") : null;
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message ?? `Request failed (${response.status})`);
  return data as T;
}

export default function PendingUsersPage() {
  const [users, setUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api<{ success: boolean; users: PendingUser[] }>("/admin/pending-users");
      setUsers(data.users);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load pending users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const deleteUser = async (user: PendingUser) => {
    const label = user.email || user.username || user.id;
    const confirmed = window.confirm(
      `Permanently delete ${label}?\n\nOnly unverified pending users with no activity can be deleted. This cannot be undone.`
    );
    if (!confirmed) return;

    setBusy(user.id);
    setError("");
    setMessage("");
    try {
      await api(`/admin/pending-users/${user.id}`, { method: "DELETE" });
      setMessage(`${label} was permanently deleted. The email can now be used to register again.`);
      await loadUsers();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to delete user");
    } finally {
      setBusy(null);
    }
  };

  return (
    <main className="min-h-screen bg-[#07070a] text-zinc-100">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#07070a]/90 backdrop-blur-xl">
        <div className="mx-auto flex min-h-[72px] w-[min(1180px,calc(100%-32px))] items-center justify-between px-4">
          <Link href="/admin" className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-violet-500 font-black text-black">R</span>
            <b className="text-sm tracking-[.18em]">RAVEN ORACLE</b>
          </Link>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link href="/admin/users" className="rounded-lg border border-white/10 px-3 py-2 text-xs">User Management</Link>
            <Link href="/admin" className="rounded-lg border border-white/10 px-3 py-2 text-xs">Back to Admin</Link>
          </div>
        </div>
      </header>

      <section className="mx-auto w-[min(1180px,calc(100%-32px))] px-4 py-12">
        <span className="text-[9px] font-black tracking-[.2em] text-violet-300/60">ACCOUNT CLEANUP</span>
        <h1 className="mt-2 text-5xl font-medium tracking-tight">Pending users.</h1>
        <p className="mt-3 max-w-2xl text-sm text-zinc-500">
          Permanently remove unverified pending accounts that were created during testing so the same email can register again.
        </p>

        <div className="mt-6 rounded-xl border border-yellow-900/40 bg-yellow-950/20 p-4 text-sm text-yellow-200">
          <b>Safety rule:</b> this screen can delete only USER accounts that are still PENDING, have no email verification, and have no recorded activity. Admins, moderators, verified users, and active accounts are protected.
        </div>

        {error && <div className="mt-6 rounded-xl border border-red-900/50 bg-red-950/20 p-4 text-sm text-red-300">{error}</div>}
        {message && <div className="mt-6 rounded-xl border border-emerald-900/50 bg-emerald-950/20 p-4 text-sm text-emerald-300">{message}</div>}

        <div className="mt-8 flex justify-end">
          <button onClick={() => void loadUsers()} disabled={loading} className="rounded-lg border border-white/10 px-4 py-2 text-xs font-bold disabled:opacity-50">
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="py-20 text-center text-sm text-zinc-600">Loading pending users…</div>
        ) : users.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-white/10 p-16 text-center text-sm text-zinc-600">
            No unverified pending users found.
          </div>
        ) : (
          <div className="mt-5 grid gap-4">
            {users.map((user) => {
              const activity = Object.values(user._count).reduce((sum, count) => sum + count, 0);
              return (
                <article key={user.id} className="rounded-2xl border border-white/10 bg-[#0d0c11] p-5">
                  <div className="flex flex-wrap items-start justify-between gap-5">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <b className="text-base">{user.email || user.username || "Unknown User"}</b>
                        <span className="rounded-full bg-zinc-500/10 px-2 py-1 text-[9px] font-black text-zinc-400">PENDING</span>
                        <span className="rounded-full bg-red-500/10 px-2 py-1 text-[9px] font-black text-red-300">NOT VERIFIED</span>
                      </div>
                      {user.username && user.email && <p className="mt-2 text-sm text-zinc-500">@{user.username}</p>}
                      <p className="mt-2 text-xs text-zinc-600">Created {new Date(user.createdAt).toLocaleString()}</p>
                      <p className="mt-2 text-xs text-zinc-600">
                        {activity === 0 ? "No activity — safe for cleanup" : `${activity} activity record${activity === 1 ? "" : "s"} detected`}
                      </p>
                    </div>

                    <button
                      disabled={busy === user.id || activity > 0}
                      onClick={() => void deleteUser(user)}
                      className="rounded-lg border border-red-900/50 bg-red-950/20 px-4 py-2 text-xs font-black text-red-300 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {busy === user.id ? "Deleting…" : "Delete Permanently"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
