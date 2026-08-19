"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ThemeToggle from "../../../components/ThemeToggle";
import { API_BASE_URL } from "@/lib/api-config";

type AuditLog = {
  id: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: any;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
  actor?: {
    id: string;
    username?: string | null;
    displayName?: string | null;
    role: string;
  } | null;
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

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [actionFilter, setActionFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams();
        if (actionFilter) params.set("action", actionFilter);
        if (entityFilter) params.set("entityType", entityFilter);
        const query = params.toString() ? `?${params.toString()}` : "";
        const data = await api<{ success: boolean; logs: AuditLog[] }>(
          `/admin/audit-logs${query}`
        );
        setLogs(data.logs);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unable to load audit logs");
      } finally {
        setLoading(false);
      }
    };
    void init();
  }, [actionFilter, entityFilter]);

  const actionTypes = [
    "LOGIN_SUCCESS",
    "LOGIN_FAILED",
    "REGISTRATION",
    "EMAIL_VERIFICATION",
    "OAUTH_LOGIN",
    "PROJECT_APPROVED",
    "PROJECT_REJECTED",
    "ALPHA_VERIFIED",
    "ALPHA_REJECTED",
    "USER_SUSPENDED",
    "USER_BANNED",
    "POINTS_AWARDED",
  ];

  const entityTypes = [
    "User",
    "Project",
    "Raffle",
    "AlphaSubmission",
    "RaffleEntry",
  ];

  return (
    <main className="min-h-screen bg-[#07070a] text-zinc-100">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#07070a]/90 backdrop-blur-xl">
        <div className="mx-auto flex min-h-[72px] w-[min(1180px,calc(100%-32px))] items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-violet-500 font-black text-black">
              R
            </span>
            <b className="text-sm tracking-[.18em]">RAVEN ORACLE</b>
          </Link>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link href="/admin" className="rounded-lg border border-white/10 px-3 py-2 text-xs">
              Back to Admin
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto w-[min(1180px,calc(100%-32px))] px-4 py-12">
        <span className="text-[9px] font-black tracking-[.2em] text-violet-300/60">
          SYSTEM MONITORING
        </span>
        <h1 className="mt-2 text-5xl font-medium tracking-tight">Audit Logs.</h1>
        <p className="mt-3 text-sm text-zinc-600">
          Track all system actions, user activity, and admin operations.
        </p>

        {error && (
          <div className="mt-6 rounded-xl border border-red-900/50 bg-red-950/20 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Filters */}
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-bold text-zinc-400">Filter by Action</label>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="mt-2 w-full rounded-lg border border-white/10 bg-[#0d0c11] px-4 py-3 text-sm outline-none"
            >
              <option value="">All Actions</option>
              {actionTypes.map((action) => (
                <option key={action} value={action}>
                  {action.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-zinc-400">Filter by Entity</label>
            <select
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
              className="mt-2 w-full rounded-lg border border-white/10 bg-[#0d0c11] px-4 py-3 text-sm outline-none"
            >
              <option value="">All Entities</option>
              {entityTypes.map((entity) => (
                <option key={entity} value={entity}>
                  {entity}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={async () => {
              setLoading(true);
              setError("");
              try {
                const params = new URLSearchParams();
                if (actionFilter) params.set("action", actionFilter);
                if (entityFilter) params.set("entityType", entityFilter);
                const query = params.toString() ? `?${params.toString()}` : "";
                const data = await api<{ success: boolean; logs: AuditLog[] }>(
                  `/admin/audit-logs${query}`
                );
                setLogs(data.logs);
              } catch (e) {
                setError(e instanceof Error ? e.message : "Unable to load audit logs");
              } finally {
                setLoading(false);
              }
            }}
            className="rounded-lg border border-white/10 px-4 py-2 text-[10px] font-bold"
          >
            Refresh
          </button>
        </div>

        {/* Logs List */}
        {loading ? (
          <div className="py-20 text-center text-sm text-zinc-600">Loading audit logs…</div>
        ) : logs.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-white/10 p-16 text-center text-sm text-zinc-600">
            No audit logs found.
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            {logs.map((log) => (
              <article
                key={log.id}
                className="rounded-2xl border border-white/10 bg-[#0d0c11] p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-violet-500/10 px-3 py-1 text-[9px] font-black text-violet-300">
                        {log.action.replace(/_/g, " ")}
                      </span>
                      <span className="rounded-full bg-white/5 px-2 py-1 text-[9px] text-zinc-500">
                        {log.entityType}
                      </span>
                      {log.actor && (
                        <span className="text-xs text-zinc-600">
                          by {log.actor.displayName || log.actor.username || "System"}
                        </span>
                      )}
                    </div>

                    {log.metadata && (
                      <div className="mt-3 rounded-xl border border-white/5 bg-black/20 p-3">
                        <pre className="overflow-x-auto text-[10px] text-zinc-500">
                          {JSON.stringify(log.metadata, null, 2)}
                        </pre>
                      </div>
                    )}

                    <div className="mt-3 flex flex-wrap gap-4 text-[10px] text-zinc-700">
                      {log.entityId && <span>Entity ID: {log.entityId.slice(0, 8)}...</span>}
                      {log.ipAddress && <span>IP: {log.ipAddress}</span>}
                      <span>{new Date(log.createdAt).toLocaleString()}</span>
                    </div>
                  </div>

                  {log.actor && (
                    <span
                      className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-black ${
                        log.actor.role === "ADMIN"
                          ? "bg-red-500/10 text-red-300"
                          : log.actor.role === "MODERATOR"
                            ? "bg-yellow-500/10 text-yellow-300"
                            : "bg-blue-500/10 text-blue-300"
                      }`}
                    >
                      {log.actor.role}
                    </span>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}

        {logs.length > 0 && (
          <div className="mt-5 rounded-xl border border-white/10 bg-[#0d0c11] p-4 text-center text-xs text-zinc-600">
            Showing {logs.length} most recent logs (max 200)
          </div>
        )}
      </section>
    </main>
  );
}
