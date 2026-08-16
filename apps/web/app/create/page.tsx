"use client";

import { useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

type TaskDraft = { type: "X_FOLLOW" | "X_LIKE" | "X_REPOST" | "DISCORD_JOIN"; title: string; target: string; targetUrl: string; isRequired: boolean };

async function api<T>(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers); headers.set("Content-Type", "application/json");
  const token = localStorage.getItem("raven_token"); if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`${API}${path}`, { ...options, headers }); const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message ?? `Request failed (${res.status})`); return data as T;
}

const emptyTask: TaskDraft = { type: "X_FOLLOW", title: "Follow the project on X", target: "", targetUrl: "", isRequired: true };

export default function CreateRaffle() {
  const [title, setTitle] = useState(""); const [description, setDescription] = useState("");
  const [prizeName, setPrizeName] = useState(""); const [prizeDescription, setPrizeDescription] = useState("");
  const [quantity, setQuantity] = useState(1); const [winners, setWinners] = useState(1);
  const [startsAt, setStartsAt] = useState(""); const [endsAt, setEndsAt] = useState("");
  const [tasks, setTasks] = useState<TaskDraft[]>([{ ...emptyTask }]); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");

  const addTask = () => setTasks((items) => [...items, { ...emptyTask, title: "", target: "", targetUrl: "" }]);
  const updateTask = (index: number, patch: Partial<TaskDraft>) => setTasks((items) => items.map((item, i) => i === index ? { ...item, ...patch } : item));

  const create = async () => {
    if (!title || !prizeName || !startsAt || !endsAt) return setMessage("Title, prize and dates are required.");
    setBusy(true); setMessage("");
    try {
      const raffle = await api<{ raffle: { id: string } }>("/raffles/", { method: "POST", body: JSON.stringify({ title, description, prizeName, prizeDescription, prizeQuantity: quantity, winnerCount: winners, startsAt: new Date(startsAt).toISOString(), endsAt: new Date(endsAt).toISOString(), entryRules: { tasks } }) });
      for (let i = 0; i < tasks.length; i++) await api(`/raffles/${raffle.raffle.id}/tasks`, { method: "POST", body: JSON.stringify({ ...tasks[i], sortOrder: i }) });
      setMessage(`Raffle created successfully. ID: ${raffle.raffle.id}`);
    } catch (e) { setMessage(e instanceof Error ? e.message : "Unable to create raffle"); }
    finally { setBusy(false); }
  };

  return <main className="min-h-screen bg-[#07070a] text-zinc-100">
    <header className="border-b border-white/10 bg-[#07070a]/90 px-5 py-5 backdrop-blur-xl"><div className="mx-auto flex max-w-6xl items-center justify-between"><a href="/" className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg border border-violet-400/20 bg-violet-950/30 font-black text-violet-200">R</span><span className="text-sm font-black tracking-[.18em]">RAVEN ORACLE</span></a><a href="/" className="text-xs text-zinc-500 hover:text-white">← Back to raffles</a></div></header>
    <div className="mx-auto max-w-6xl px-5 py-12"><div className="max-w-2xl"><span className="text-[9px] font-black tracking-[.2em] text-violet-300/60">CREATOR STUDIO</span><h1 className="mt-3 text-5xl font-medium tracking-tight">Create a raffle.</h1><p className="mt-4 text-sm leading-6 text-zinc-500">Define the prize, schedule and the exact social actions participants must complete. Raven Oracle verifies them automatically before the draw.</p></div>
      <div className="mt-10 grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
        <section className="rounded-2xl border border-white/10 bg-[#0d0c11] p-6"><h2 className="text-lg font-bold">Raffle details</h2><div className="mt-5 grid gap-4"><label>Title<input value={title} onChange={e => setTitle(e.target.value)} placeholder="XYZ Community Raffle" /></label><label>Description<textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Tell participants what they can win and why." /></label><div className="grid gap-4 sm:grid-cols-2"><label>Prize<input value={prizeName} onChange={e => setPrizeName(e.target.value)} placeholder="1× WL Spot" /></label><label>Prize details<input value={prizeDescription} onChange={e => setPrizeDescription(e.target.value)} placeholder="Whitelist allocation" /></label></div><div className="grid gap-4 sm:grid-cols-2"><label>Prize quantity<input type="number" min={1} value={quantity} onChange={e => setQuantity(Number(e.target.value))} /></label><label>Winner count<input type="number" min={1} value={winners} onChange={e => setWinners(Number(e.target.value))} /></label></div><div className="grid gap-4 sm:grid-cols-2"><label>Starts<input type="datetime-local" value={startsAt} onChange={e => setStartsAt(e.target.value)} /></label><label>Ends<input type="datetime-local" value={endsAt} onChange={e => setEndsAt(e.target.value)} /></label></div></div></section>
        <aside className="rounded-2xl border border-white/10 bg-[#0d0c11] p-6"><span className="text-[9px] font-black tracking-[.2em] text-zinc-600">PUBLISH CHECKLIST</span><div className="mt-5 space-y-3 text-sm text-zinc-500"><div>✓ Prize configured</div><div>✓ Entry window configured</div><div>✓ Required tasks configured</div><div>✓ Automated verification</div><div>✓ Deterministic fair draw</div></div></aside>
      </div>

      <section className="mt-5 rounded-2xl border border-white/10 bg-[#0d0c11] p-6"><div className="flex items-center justify-between"><div><span className="text-[9px] font-black tracking-[.2em] text-zinc-600">ELIGIBILITY TASKS</span><h2 className="mt-2 text-lg font-bold">What participants must do</h2></div><button onClick={addTask} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold">+ Add task</button></div><div className="mt-6 space-y-4">{tasks.map((task, index) => <div key={index} className="rounded-xl border border-white/10 bg-black/20 p-4"><div className="grid gap-3 md:grid-cols-[160px_1fr_1fr]"><select value={task.type} onChange={e => updateTask(index, { type: e.target.value as TaskDraft["type"] })}><option value="X_FOLLOW">X Follow</option><option value="X_LIKE">X Like</option><option value="X_REPOST">X Repost</option><option value="DISCORD_JOIN">Discord Join</option></select><input value={task.title} onChange={e => updateTask(index, { title: e.target.value })} placeholder="Task title" /><input value={task.target} onChange={e => updateTask(index, { target: e.target.value })} placeholder="Target username / server ID" /></div><div className="mt-3 flex gap-3"><input className="flex-1" value={task.targetUrl} onChange={e => updateTask(index, { targetUrl: e.target.value })} placeholder="Target URL" /><label className="flex items-center gap-2 text-xs text-zinc-500"><input type="checkbox" checked={task.isRequired} onChange={e => updateTask(index, { isRequired: e.target.checked })} /> Required</label><button onClick={() => setTasks(items => items.filter((_, i) => i !== index))} className="rounded border border-red-900/40 px-3 text-xs text-red-400">Remove</button></div></div>)}</div></section>

      {message && <div className="mt-5 rounded-xl border border-violet-900/50 bg-violet-950/20 p-4 text-sm text-violet-200">{message}</div>}
      <button disabled={busy} onClick={() => void create()} className="mt-6 w-full rounded-xl bg-violet-500 py-4 text-sm font-black shadow-lg shadow-violet-500/10">{busy ? "Creating raffle…" : "Create raffle"}</button>
    </div>
    <style jsx>{`label{display:block;font-size:11px;color:#77717f}input,textarea,select{display:block;width:100%;margin-top:8px;border:1px solid #292531;border-radius:8px;background:#08080b;color:#f5f5f7;padding:11px;font:inherit;font-size:12px;outline:none}textarea{min-height:110px;resize:vertical}input:focus,textarea:focus,select:focus{border-color:#7651ad}`}</style>
  </main>;
}
