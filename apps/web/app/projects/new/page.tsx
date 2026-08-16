"use client";

import { useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

async function api<T>(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  const token = localStorage.getItem("raven_token");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message ?? `Request failed (${response.status})`);
  return data as T;
}

export default function NewProject() {
  const [form, setForm] = useState({ name: "", description: "", websiteUrl: "", xUrl: "", discordUrl: "", logoUrl: "", category: "OTHER" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const set = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async () => {
    if (!form.name.trim()) return setMessage("Project name is required.");
    setBusy(true); setMessage("");
    try {
      const data = await api<{ project: { id: string; name: string } }>("/projects/", { method: "POST", body: JSON.stringify(form) });
      setMessage(`Project “${data.project.name}” created. You can now create its raffle.`);
      setTimeout(() => { window.location.href = `/create?projectId=${data.project.id}`; }, 500);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to create project"); }
    finally { setBusy(false); }
  };

  return <main className="min-h-screen bg-[#07070a] text-zinc-100">
    <header className="border-b border-white/10 px-5 py-5"><div className="mx-auto flex max-w-5xl items-center justify-between"><a href="/" className="font-black tracking-[.18em]">RAVEN ORACLE</a><a href="/dashboard" className="text-xs text-zinc-500">Creator Studio →</a></div></header>
    <div className="mx-auto max-w-5xl px-5 py-14"><div className="max-w-2xl"><span className="text-[9px] font-black tracking-[.2em] text-violet-300/60">PROJECT ONBOARDING</span><h1 className="mt-3 text-5xl font-medium tracking-tight">Add a project.</h1><p className="mt-4 text-sm leading-6 text-zinc-500">Create the project first. Its website, X and Discord become the context for the raffles you publish.</p></div>
      <section className="mt-10 rounded-2xl border border-white/10 bg-[#0d0c11] p-6"><div className="grid gap-5 md:grid-cols-2">
        <label>Project name<input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="XYZ" /></label>
        <label>Category<select value={form.category} onChange={(e) => set("category", e.target.value)}><option>OTHER</option><option>NFT</option><option>DEFI</option><option>GAMING</option><option>AI</option><option>INFRASTRUCTURE</option><option>MEME</option></select></label>
        <label className="md:col-span-2">Description<textarea value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Short description of the project" /></label>
        <label>Website<input value={form.websiteUrl} onChange={(e) => set("websiteUrl", e.target.value)} placeholder="https://xyz.com" /></label>
        <label>X profile<input value={form.xUrl} onChange={(e) => set("xUrl", e.target.value)} placeholder="https://x.com/xyz" /></label>
        <label>Discord invite<input value={form.discordUrl} onChange={(e) => set("discordUrl", e.target.value)} placeholder="https://discord.gg/xyz" /></label>
        <label>Logo URL<input value={form.logoUrl} onChange={(e) => set("logoUrl", e.target.value)} placeholder="https://.../logo.png" /></label>
      </div></section>
      {message && <div className="mt-5 rounded-xl border border-violet-900/50 bg-violet-950/20 p-4 text-sm text-violet-200">{message}</div>}
      <button disabled={busy} onClick={() => void submit()} className="mt-6 w-full rounded-xl bg-violet-500 py-4 text-sm font-black">{busy ? "Creating project…" : "Create project & continue"}</button>
    </div>
    <style jsx>{`label{display:block;font-size:11px;color:#77717f}input,textarea,select{display:block;width:100%;margin-top:8px;border:1px solid #292531;border-radius:8px;background:#08080b;color:#f5f5f7;padding:11px;font-size:12px;outline:none}textarea{min-height:120px;resize:vertical}input:focus,textarea:focus,select:focus{border-color:#7651ad}`}</style>
  </main>;
}
