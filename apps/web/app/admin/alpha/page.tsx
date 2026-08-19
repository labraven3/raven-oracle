"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { API_BASE_URL } from "@/lib/api-config";

type Row = {
  id: string;
  title: string;
  description: string;
  opportunityType: string;
  status: string;
  pointsAwarded: number | null;
  submittedBy: {
    username?: string | null;
    displayName?: string | null;
  };
  project?: {
    name: string;
  } | null;
};

async function api<T>(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  const token = localStorage.getItem("raven_token");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message ?? `Request failed (${response.status})`);
  return data as T;
}

export default function AdminAlpha() {
  const [rows, setRows] = useState<Row[]>([]);
  const [message, setMessage] = useState("");

  const load = async () => {
    try {
      const data = await api<{ submissions: Row[] }>("/admin/alpha?status=SUBMITTED");
      setRows(data.submissions);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to load");
    }
  };

  useEffect(() => {
    const loadData = async () => {
      await load();
    };
    void loadData();
  }, []);

  const act = async (id: string, status: "VERIFIED" | "REJECTED" | "DUPLICATE") => {
    try {
      await api(`/admin/alpha/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status,
          points: status === "VERIFIED" ? 100 : 0,
        }),
      });
      setRows((prev) => prev.filter((row) => row.id !== id));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Action failed");
    }
  };

  return (
    <main className="min-h-screen bg-[#07070a] text-zinc-100">
      <header className="border-b border-white/10 px-5 py-5">
        <div className="mx-auto flex max-w-6xl justify-between">
          <Link href="/admin" className="font-black tracking-[.18em]">
            RAVEN ORACLE ADMIN
          </Link>
          <Link href="/admin" className="text-xs text-zinc-500">
            ← Admin
          </Link>
        </div>
      </header>
      <section className="mx-auto max-w-6xl px-5 py-10">
        <span className="text-[9px] font-black tracking-[.2em] text-violet-300/60">
          MODERATION
        </span>
        <h1 className="mt-3 text-4xl">Alpha review queue</h1>
        <p className="mt-2 text-sm text-zinc-600">Verify useful evidence before awarding points.</p>
        {message && <p className="mt-4 text-xs text-red-300">{message}</p>}
        <div className="mt-8 space-y-3">
          {rows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 p-12 text-center text-sm text-zinc-700">
              Queue is clear.
            </div>
          ) : (
            rows.map((row) => (
              <article key={row.id} className="rounded-2xl border border-white/10 bg-[#0d0c11] p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <span className="text-[9px] tracking-wider text-violet-300/60">
                      {row.opportunityType}
                    </span>
                    <h2 className="mt-2 text-lg font-bold">{row.title}</h2>
                    <p className="mt-2 max-w-3xl text-xs leading-6 text-zinc-500">
                      {row.description}
                    </p>
                    <p className="mt-3 text-[9px] text-zinc-700">
                      Submitted by {row.submittedBy.displayName || row.submittedBy.username || "member"} ·{" "}
                      {row.project?.name || "Community"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => void act(row.id, "VERIFIED")}
                      className="rounded-lg bg-emerald-500/15 px-3 py-2 text-[10px] font-black text-emerald-300"
                    >
                      Verify +100
                    </button>
                    <button
                      onClick={() => void act(row.id, "DUPLICATE")}
                      className="rounded-lg border border-white/10 px-3 py-2 text-[10px]"
                    >
                      Duplicate
                    </button>
                    <button
                      onClick={() => void act(row.id, "REJECTED")}
                      className="rounded-lg border border-red-400/20 px-3 py-2 text-[10px] text-red-300"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
