"use client";

import { useCallback, useEffect, useState } from "react";
import ThemeToggle from "../../../components/ThemeToggle";
import { API_BASE_URL } from "@/lib/api-config";

type User = {
  id: string;
  email?: string | null;
  username?: string | null;
  displayName?: string | null;
  role: string;
  status: string;
  emailVerifiedAt?: string | null;
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
  const token = typeof window !== "undefined" ? localStorage.getItem("raven_token") : null;
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message ?? `Request failed (${response.status})`);
  return data as T;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [filter, setFilter] = useState<"ALL" | "ACTIVE" | "SUSPENDED" | "BANNED">("ALL");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [actionUser, setActionUser] = useState<User | null>(null);
  const [actionType, setActionType] = useState<"SUSPEND" | "BAN" | "ACTIVATE" | "POINTS" | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [pointsAmount, setPointsAmount] = useState(0);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const queryStatus = filter === "ALL" ? "" : `?status=${filter}`;
      const data = await api<{ success: boolean; users: User[] }>(
        `/admin/users${queryStatus}`
      );
      setUsers(data.users);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load users");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const openAction = (user: User, type: "SUSPEND" | "BAN" | "ACTIVATE" | "POINTS") => {
    setActionUser(user);
    setActionType(type);
    setActionReason("");
    setPointsAmount(0);
  };

  const closeAction = () => {
    setActionUser(null);
    setActionType(null);
    setActionReason("");
    setPointsAmount(0);
  };

  const executeStatusChange = async () => {
    if (!actionUser || !actionType || (actionType !== "ACTIVATE" && !actionReason.trim())) {
      setError("Reason is required");
      return;
    }

    setBusy(actionUser.id);
    setError("");
    try {
      const newStatus = actionType === "SUSPEND" ? "SUSPENDED" : actionType === "BAN" ? "BANNED" : "ACTIVE";
      await api(`/admin/users/${actionUser.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          status: newStatus,
          reason: actionReason,
        }),
      });
      setMessage(`User ${newStatus.toLowerCase()} successfully`);
      closeAction();
      await loadUsers();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Status change failed");
    } finally {
      setBusy(null);
    }
  };

  const executePointsAdjustment = async () => {
    if (!actionUser || !actionReason.trim() || pointsAmount === 0) {
      setError("Amount and reason are required");
      return;
    }

    setBusy(actionUser.id);
    setError("");
    try {
      await api(`/admin/users/${actionUser.id}/points`, {
        method: "PATCH",
        body: JSON.stringify({
          amount: pointsAmount,
          reason: actionReason,
        }),
      });
      setMessage(`Points ${pointsAmount > 0 ? "awarded" : "deducted"} successfully`);
      closeAction();
      await loadUsers();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Points adjustment failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <main className="min-h-screen bg-[#07070a] text-zinc-100">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#07070a]/90 backdrop-blur-xl">
        <div className="mx-auto flex min-h-[72px] w-[min(1180px,calc(100%-32px))] items-center justify-between px-4">
          <a href="/" className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-violet-500 font-black text-black">
              R
            </span>
            <b className="text-sm tracking-[.18em]">RAVEN ORACLE</b>
          </a>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <a href="/admin" className="rounded-lg border border-white/10 px-3 py-2 text-xs">
              Back to Admin
            </a>
          </div>
        </div>
      </header>

      <section className="mx-auto w-[min(1180px,calc(100%-32px))] px-4 py-12">
        <span className="text-[9px] font-black tracking-[.2em] text-violet-300/60">
          USER MANAGEMENT
        </span>
        <h1 className="mt-2 text-5xl font-medium tracking-tight">Manage users.</h1>
        <p className="mt-3 text-sm text-zinc-600">
          View, suspend, ban users, and manage points.
        </p>

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

        {/* Filters */}
        <div className="mt-8 flex flex-wrap gap-2">
          {(["ALL", "ACTIVE", "SUSPENDED", "BANNED"] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`rounded-lg px-4 py-2 text-[10px] font-black ${
                filter === status
                  ? "bg-white text-black"
                  : "border border-white/10 text-zinc-500"
              }`}
            >
              {status}
            </button>
          ))}
          <button
            onClick={() => void loadUsers()}
            className="ml-auto rounded-lg border border-white/10 px-4 py-2 text-[10px] font-bold"
          >
            Refresh
          </button>
        </div>

        {/* Users List */}
        {loading ? (
          <div className="py-20 text-center text-sm text-zinc-600">Loading users…</div>
        ) : users.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-white/10 p-16 text-center text-sm text-zinc-600">
            No {filter.toLowerCase()} users found.
          </div>
        ) : (
          <div className="mt-5 grid gap-4">
            {users.map((user) => (
              <article
                key={user.id}
                className="rounded-2xl border border-white/10 bg-[#0d0c11] p-5"
              >
                <div className="flex items-start gap-4">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-violet-500/10 text-lg font-black">
                    {(user.displayName || user.username || user.email || "?")
                      .slice(0, 1)
                      .toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <b className="text-base">
                        {user.displayName || user.username || user.email || "Unknown User"}
                      </b>
                      <span
                        className={`rounded-full px-2 py-1 text-[9px] font-black ${
                          user.role === "ADMIN"
                            ? "bg-red-500/10 text-red-300"
                            : user.role === "MODERATOR"
                              ? "bg-yellow-500/10 text-yellow-300"
                              : "bg-blue-500/10 text-blue-300"
                        }`}
                      >
                        {user.role}
                      </span>
                      <span
                        className={`rounded-full px-2 py-1 text-[9px] font-black ${
                          user.status === "ACTIVE"
                            ? "bg-emerald-500/10 text-emerald-300"
                            : user.status === "SUSPENDED"
                              ? "bg-yellow-500/10 text-yellow-300"
                              : user.status === "BANNED"
                                ? "bg-red-500/10 text-red-300"
                                : "bg-zinc-500/10 text-zinc-500"
                        }`}
                      >
                        {user.status}
                      </span>
                      {user.emailVerifiedAt && (
                        <span className="rounded-full bg-green-500/10 px-2 py-1 text-[9px] text-green-300">
                          ✓ Verified
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-zinc-500">
                      {user.email && <span>{user.email}</span>}
                      {user.username && user.email && <span> • </span>}
                      {user.username && <span>@{user.username}</span>}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-zinc-600">
                      <span>{user._count.raffleEntries} raffle entries</span>
                      <span>•</span>
                      <span>{user._count.alphaSubmissions} alpha submissions</span>
                      <span>•</span>
                      <span>{user._count.chatMessages} chat messages</span>
                      <span>•</span>
                      <span>{user._count.walletAddresses} wallets</span>
                    </div>
                    <p className="mt-2 text-[10px] text-zinc-700">
                      Joined {new Date(user.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="mt-4 flex flex-wrap gap-2 border-t border-white/5 pt-4">
                  {user.status !== "ACTIVE" && (
                    <button
                      disabled={busy === user.id}
                      onClick={() => openAction(user, "ACTIVATE")}
                      className="rounded-lg border border-emerald-900/40 px-3 py-2 text-[10px] font-bold text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-50"
                    >
                      Activate
                    </button>
                  )}
                  {user.status === "ACTIVE" && (
                    <button
                      disabled={busy === user.id}
                      onClick={() => openAction(user, "SUSPEND")}
                      className="rounded-lg border border-yellow-900/40 px-3 py-2 text-[10px] font-bold text-yellow-300 hover:bg-yellow-500/10 disabled:opacity-50"
                    >
                      Suspend
                    </button>
                  )}
                  {user.status !== "BANNED" && (
                    <button
                      disabled={busy === user.id}
                      onClick={() => openAction(user, "BAN")}
                      className="rounded-lg border border-red-900/40 px-3 py-2 text-[10px] font-bold text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                    >
                      Ban
                    </button>
                  )}
                  <button
                    disabled={busy === user.id}
                    onClick={() => openAction(user, "POINTS")}
                    className="rounded-lg border border-violet-900/40 px-3 py-2 text-[10px] font-bold text-violet-300 hover:bg-violet-500/10 disabled:opacity-50"
                  >
                    Adjust Points
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Action Modal */}
      {actionUser && actionType && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0d0c11] p-6">
            <h2 className="text-xl font-bold">
              {actionType === "POINTS"
                ? "Adjust Points"
                : actionType === "ACTIVATE"
                  ? "Activate User"
                  : actionType === "SUSPEND"
                    ? "Suspend User"
                    : "Ban User"}
            </h2>
            <p className="mt-2 text-sm text-zinc-500">
              User: {actionUser.displayName || actionUser.username || actionUser.email}
            </p>

            <div className="mt-6 space-y-4">
              {actionType === "POINTS" && (
                <div>
                  <label className="block text-xs font-bold text-zinc-400">
                    Points Amount
                  </label>
                  <input
                    type="number"
                    value={pointsAmount}
                    onChange={(e) => setPointsAmount(parseInt(e.target.value) || 0)}
                    min="-10000"
                    max="10000"
                    className="mt-2 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none"
                    placeholder="e.g., 100 or -50"
                  />
                  <p className="mt-1 text-xs text-zinc-600">
                    Positive to award, negative to deduct
                  </p>
                </div>
              )}

              {actionType !== "ACTIVATE" && (
                <div>
                  <label className="block text-xs font-bold text-zinc-400">
                    Reason {actionType === "POINTS" ? "" : "(Required)"}
                  </label>
                  <textarea
                    value={actionReason}
                    onChange={(e) => setActionReason(e.target.value)}
                    rows={3}
                    maxLength={actionType === "POINTS" ? 500 : 1000}
                    className="mt-2 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none"
                    placeholder={
                      actionType === "POINTS"
                        ? "Why are you adjusting points?"
                        : `Why are you ${actionType === "SUSPEND" ? "suspending" : "banning"} this user?`
                    }
                  />
                </div>
              )}
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={closeAction}
                className="flex-1 rounded-lg border border-white/10 px-4 py-3 text-sm font-bold"
              >
                Cancel
              </button>
              <button
                onClick={actionType === "POINTS" ? executePointsAdjustment : executeStatusChange}
                disabled={busy === actionUser.id}
                className={`flex-1 rounded-lg px-4 py-3 text-sm font-black disabled:opacity-50 ${
                  actionType === "BAN"
                    ? "bg-red-500 text-white"
                    : actionType === "SUSPEND"
                      ? "bg-yellow-500 text-black"
                      : actionType === "ACTIVATE"
                        ? "bg-emerald-500 text-black"
                        : "bg-violet-500 text-black"
                }`}
              >
                {busy === actionUser.id ? "Processing…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
