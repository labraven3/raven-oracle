"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { API_BASE_URL } from "@/lib/api-config";

type Task = { id: string; title: string; type: string; target: string; targetUrl?: string | null; isRequired: boolean };
type Raffle = { id: string; title: string; status: string; endsAt: string };
type Project = { id: string; name: string; projectType?: string; category?: string };
type WinnersData = { viewer: "CREATOR" | "WINNER"; raffle: Raffle; winners: Array<{ id: string }> };

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

export default function CreatorQuickActions() {
  const pathname = usePathname();
  const router = useRouter();
  const raffleMatch = pathname.match(/^\/raffles\/([^/]+)$/);
  const projectMatch = pathname.match(/^\/dashboard\/projects\/([^/]+)$/);
  const raffleId = raffleMatch?.[1] ?? null;
  const projectId = projectMatch?.[1] ?? null;

  const [open, setOpen] = useState(false);
  const [creator, setCreator] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [raffle, setRaffle] = useState<Raffle | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    setAuthenticated(Boolean(localStorage.getItem("raven_token")));
  }, [pathname]);

  useEffect(() => {
    setOpen(false); setCreator(false); setMessage(""); setTasks([]); setRaffle(null); setProject(null);
  }, [pathname]);

  const loadRaffleTools = async () => {
    if (!raffleId) return;
    setBusy(true); setMessage("");
    try {
      const [winnerData, taskData] = await Promise.all([
        api<WinnersData>(`/raffles/${raffleId}/winners`),
        api<{ tasks: Task[] }>(`/raffles/${raffleId}/tasks`),
      ]);
      setCreator(winnerData.viewer === "CREATOR");
      setRaffle(winnerData.raffle);
      setTasks(taskData.tasks ?? []);
    } catch (error) {
      setCreator(false);
      setMessage(error instanceof Error ? error.message : "Creator tools unavailable");
    } finally { setBusy(false); }
  };

  const loadProjectTools = async () => {
    if (!projectId) return;
    setBusy(true); setMessage("");
    try {
      const data = await api<{ project: Project }>(`/projects/${projectId}/manage`);
      setProject(data.project);
    } catch (error) {
      setProject(null);
      setMessage(error instanceof Error ? error.message : "Project tools unavailable");
    } finally { setBusy(false); }
  };

  const toggle = async () => {
    if (!open) {
      setOpen(true);
      if (raffleId) await loadRaffleTools();
      if (projectId) await loadProjectTools();
    } else setOpen(false);
  };

  const deleteTask = async (task: Task) => {
    if (!raffleId || !window.confirm(`Delete task "${task.title}"?`)) return;
    setBusy(true); setMessage("");
    try {
      await api(`/raffles/${raffleId}/tasks/${task.id}`, { method: "DELETE" });
      setTasks((items) => items.filter((item) => item.id !== task.id));
      setMessage("Task deleted.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to delete task"); }
    finally { setBusy(false); }
  };

  const deleteRaffle = async () => {
    if (!raffleId || !window.confirm("Delete this raffle? Completed raffles with winners are protected.")) return;
    setBusy(true); setMessage("");
    try { await api(`/raffles/${raffleId}`, { method: "DELETE" }); router.push("/dashboard"); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to delete raffle"); }
    finally { setBusy(false); }
  };

  const draw = async () => {
    if (!raffleId) return;
    setBusy(true); setMessage("");
    try { await api(`/raffles/${raffleId}/draw`, { method: "POST" }); setMessage("Winners drawn successfully."); await loadRaffleTools(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to draw winners"); }
    finally { setBusy(false); }
  };

  const exportWinners = async () => {
    if (!raffleId) return;
    setBusy(true); setMessage("");
    try {
      const token = localStorage.getItem("raven_token") ?? "";
      const response = await fetch(`${API_BASE_URL}/raffles/${raffleId}/winners/export`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).message || "Unable to export winners");
      const blob = await response.blob(); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `raven-oracle-${raffleId}-winners.csv`; anchor.click(); URL.revokeObjectURL(url); setMessage("Winner CSV exported.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to export winners"); }
    finally { setBusy(false); }
  };

  const deleteProject = async () => {
    if (!projectId || !project || project.projectType !== "NFT") return;
    if (!window.confirm(`Delete NFT project "${project.name}"? Open raffles will be cancelled; winner history is retained.`)) return;
    setBusy(true); setMessage("");
    try { await api(`/projects/${projectId}`, { method: "DELETE" }); router.push("/dashboard"); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to delete project"); }
    finally { setBusy(false); }
  };

  if (!authenticated || (!raffleId && !projectId)) return null;

  return <>
    <button onClick={() => void toggle()} className="fixed bottom-5 right-5 z-50 rounded-xl border border-violet-400/30 bg-[#0d0c11]/95 px-4 py-3 text-[10px] font-black text-violet-200 shadow-2xl backdrop-blur-xl">{raffleId ? "Creator tools" : "Project tools"}</button>
    {open && <div className="fixed bottom-20 right-5 z-50 w-[min(390px,calc(100vw-32px))] rounded-2xl border border-white/10 bg-[#0d0c11] p-5 text-zinc-100 shadow-2xl">
      <div className="flex items-center justify-between gap-3"><div><p className="text-[9px] font-black tracking-[.18em] text-violet-300/70">RAVEN ORACLE</p><h3 className="mt-1 text-lg font-semibold">{raffleId ? "Creator tools" : "Project tools"}</h3></div><button onClick={() => setOpen(false)} className="rounded-lg border border-white/10 px-2 py-1 text-xs">×</button></div>
      {busy && <p className="mt-3 text-xs text-zinc-600">Working…</p>}
      {message && <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-zinc-400">{message}</div>}
      {raffleId && creator && raffle && <div className="mt-4 space-y-3"><div className="rounded-xl border border-white/10 bg-black/20 p-3"><p className="text-xs font-bold">{raffle.title}</p><p className="mt-1 text-[10px] text-zinc-600">{raffle.status} · ends {new Date(raffle.endsAt).toLocaleString()}</p></div><Link href={`/dashboard/raffles/${raffleId}`} className="block rounded-lg border border-white/10 px-3 py-2 text-[10px] font-black">Open operations center →</Link><div className="grid grid-cols-2 gap-2"><button disabled={busy || raffle.status !== "CLOSED"} onClick={() => void draw()} className="rounded-lg bg-violet-500 px-3 py-2 text-[10px] font-black disabled:opacity-30">Draw winners</button><button disabled={busy} onClick={() => void exportWinners()} className="rounded-lg border border-white/10 px-3 py-2 text-[10px] font-black">Export CSV</button></div><div><p className="mb-2 text-[9px] font-black tracking-[.14em] text-zinc-600">TASKS</p><div className="space-y-2">{tasks.length === 0 ? <p className="text-xs text-zinc-600">No tasks.</p> : tasks.map((task) => <div key={task.id} className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/10 p-2"><div className="min-w-0 flex-1"><p className="truncate text-xs">{task.title}</p><p className="truncate text-[9px] text-zinc-600">{task.type}</p></div><button disabled={busy} onClick={() => void deleteTask(task)} className="rounded-md border border-red-500/20 px-2 py-1 text-[9px] font-black text-red-300">Delete</button></div>)}</div></div><button disabled={busy || ["COMPLETED","CANCELLED"].includes(raffle.status)} onClick={() => void deleteRaffle()} className="w-full rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-[10px] font-black text-red-300 disabled:opacity-30">Delete raffle</button></div>}
      {projectId && project?.projectType === "NFT" && <div className="mt-4 space-y-3"><div className="rounded-xl border border-white/10 bg-black/20 p-3"><p className="text-xs font-bold">{project.name}</p><p className="mt-1 text-[10px] text-zinc-600">NFT project · creator only</p></div><button disabled={busy} onClick={() => void deleteProject()} className="w-full rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-[10px] font-black text-red-300">Delete NFT project</button></div>}
      {raffleId && !creator && !busy && <p className="mt-4 text-xs text-zinc-600">This account is not the raffle creator, so creator actions are hidden.</p>}
    </div>}
  </>;
}
