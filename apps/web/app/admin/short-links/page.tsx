"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { API_BASE_URL } from "@/lib/api-config";

type Raffle = { id: string; title: string; prizeName?: string; project?: { name?: string | null } | null };
type ShortLink = { id: string; slug: string; raffleId: string; active: boolean; clickCount: number; uniqueClickCount: number; createdAt: string; lastClickedAt?: string | null; raffleTitle?: string; prizeName?: string; projectName?: string | null; url: string };

const authHeaders = () => {
  const headers = new Headers({ "Content-Type": "application/json" });
  const token = typeof window !== "undefined" ? localStorage.getItem("raven_admin_token") : null;
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return headers;
};

export default function ShortLinksPage() {
  const [raffles, setRaffles] = useState<Raffle[]>([]);
  const [links, setLinks] = useState<ShortLink[]>([]);
  const [raffleId, setRaffleId] = useState("");
  const [slug, setSlug] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editSlug, setEditSlug] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const selectedRaffle = useMemo(() => raffles.find((r) => r.id === raffleId), [raffles, raffleId]);

  async function load() {
    setLoading(true);
    try {
      const [linksResponse, rafflesResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/short-links`, { headers: authHeaders(), credentials: "include", cache: "no-store" }),
        fetch(`${API_BASE_URL}/admin/raffles`, { headers: authHeaders(), credentials: "include", cache: "no-store" }),
      ]);
      if (!linksResponse.ok || !rafflesResponse.ok) throw new Error("Unable to load short links.");
      const linksJson = await linksResponse.json();
      const rafflesJson = await rafflesResponse.json();
      setLinks(linksJson.shortLinks ?? []);
      setRaffles(rafflesJson.raffles ?? []);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to load short links."); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  async function createLink(event: FormEvent) {
    event.preventDefault();
    setSaving(true); setMessage("");
    try {
      const response = await fetch(`${API_BASE_URL}/short-links`, { method: "POST", headers: authHeaders(), credentials: "include", body: JSON.stringify({ raffleId, slug }) });
      const json = await response.json();
      if (!response.ok) throw new Error(json.message ?? "Could not create short link.");
      setSlug(""); setRaffleId(""); setMessage("Short link created."); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not create short link."); }
    finally { setSaving(false); }
  }

  async function updateLink(id: string, body: { slug?: string; active?: boolean }) {
    const response = await fetch(`${API_BASE_URL}/short-links/${id}`, { method: "PATCH", headers: authHeaders(), credentials: "include", body: JSON.stringify(body) });
    const json = await response.json();
    if (!response.ok) throw new Error(json.message ?? "Could not update short link.");
    setEditing(null); await load();
  }

  async function deleteLink(id: string) {
    if (!window.confirm("Delete this short link? The raffle itself will not be deleted.")) return;
    try { await updateDelete(id); } catch (error) { setMessage(error instanceof Error ? error.message : "Could not delete short link."); }
  }

  async function updateDelete(id: string) {
    const response = await fetch(`${API_BASE_URL}/short-links/${id}`, { method: "DELETE", headers: authHeaders(), credentials: "include" });
    const json = await response.json();
    if (!response.ok) throw new Error(json.message ?? "Could not delete short link.");
    setMessage("Short link deleted."); await load();
  }

  function copy(url: string) {
    void navigator.clipboard.writeText(`${window.location.origin}${url}`);
    setMessage("Short URL copied.");
  }

  function suggestedSlug(title: string) {
    return title.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70);
  }

  return <div className="mx-auto max-w-7xl">
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-xs font-bold uppercase tracking-[0.25em] text-violet-300">Admin Tools</p><h1 className="mt-2 text-3xl font-black">Raffle Short Links</h1><p className="mt-2 max-w-2xl text-sm text-zinc-400">Create clean Raven Oracle URLs like <span className="text-zinc-200">/r/arc-roulette</span> without changing the original raffle URL.</p></div>
    </div>

    <form onSubmit={createLink} className="mb-8 rounded-2xl border border-white/10 bg-white/[.025] p-6">
      <div className="mb-5"><h2 className="text-lg font-black">Create short link</h2><p className="mt-1 text-xs text-zinc-500">Each raffle can have its own unique slug. Existing raffle functionality is untouched.</p></div>
      <div className="grid gap-4 md:grid-cols-[1.4fr_1fr_auto]">
        <label className="text-xs font-bold text-zinc-400">Raffle<select required value={raffleId} onChange={(e) => { setRaffleId(e.target.value); const r = raffles.find((x) => x.id === e.target.value); if (r && !slug) setSlug(suggestedSlug(r.title)); }} className="mt-2 block w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-violet-500"><option value="">Select raffle...</option>{raffles.map((r) => <option key={r.id} value={r.id}>{r.project?.name ? `${r.project.name} — ` : ""}{r.title}</option>)}</select></label>
        <label className="text-xs font-bold text-zinc-400">Custom slug<div className="mt-2 flex overflow-hidden rounded-xl border border-white/10 bg-black/30"><span className="flex items-center border-r border-white/10 px-3 text-zinc-500">/r/</span><input required value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} placeholder="arc-roulette" className="min-w-0 flex-1 bg-transparent px-3 py-3 text-sm text-white outline-none" /></div></label>
        <button disabled={saving || !raffleId || !slug} className="self-end rounded-xl bg-violet-500 px-6 py-3 text-sm font-black text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-40">{saving ? "Creating..." : "Create Link"}</button>
      </div>
      {selectedRaffle && <p className="mt-3 text-xs text-zinc-500">Preview: <span className="text-violet-300">https://ravenoracle.xyz/r/{slug || suggestedSlug(selectedRaffle.title)}</span></p>}
    </form>

    {message && <div className="mb-5 rounded-xl border border-violet-500/20 bg-violet-500/10 px-4 py-3 text-sm text-violet-200">{message}</div>}

    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[.02]">
      <div className="border-b border-white/10 px-6 py-5"><h2 className="font-black">All short links</h2></div>
      {loading ? <div className="p-10 text-center text-sm text-zinc-500">Loading...</div> : links.length === 0 ? <div className="p-10 text-center text-sm text-zinc-500">No short links yet.</div> : <div className="divide-y divide-white/5">{links.map((link) => <div key={link.id} className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-base font-bold text-violet-300">/r/{link.slug}</span><span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${link.active ? "bg-emerald-500/10 text-emerald-300" : "bg-zinc-500/10 text-zinc-500"}`}>{link.active ? "Active" : "Disabled"}</span></div><p className="mt-2 font-bold">{link.projectName ? `${link.projectName} — ` : ""}{link.raffleTitle}</p><p className="mt-1 text-xs text-zinc-500">{link.url} → /raffles/{link.raffleId}</p></div>
          <div className="flex flex-wrap gap-2"><button onClick={() => copy(link.url)} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold hover:bg-white/5">Copy</button><button onClick={() => void updateLink(link.id, { active: !link.active }).catch((e) => setMessage(e.message))} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold hover:bg-white/5">{link.active ? "Disable" : "Enable"}</button><button onClick={() => { setEditing(link.id); setEditSlug(link.slug); }} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold hover:bg-white/5">Edit</button><button onClick={() => void deleteLink(link.id)} className="rounded-lg border border-red-500/20 px-3 py-2 text-xs font-bold text-red-300 hover:bg-red-500/10">Delete</button></div>
        </div>
        {editing === link.id && <div className="mt-4 flex flex-wrap gap-2"><input value={editSlug} onChange={(e) => setEditSlug(e.target.value.toLowerCase())} className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-violet-500" /><button onClick={() => void updateLink(link.id, { slug: editSlug }).catch((e) => setMessage(e.message))} className="rounded-lg bg-violet-500 px-4 py-2 text-xs font-bold">Save</button><button onClick={() => setEditing(null)} className="rounded-lg border border-white/10 px-4 py-2 text-xs font-bold">Cancel</button></div>}
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4"><div className="rounded-xl border border-white/5 bg-black/20 p-3"><div className="text-[10px] uppercase text-zinc-500">Clicks</div><div className="mt-1 text-lg font-black">{link.clickCount}</div></div><div className="rounded-xl border border-white/5 bg-black/20 p-3"><div className="text-[10px] uppercase text-zinc-500">Unique</div><div className="mt-1 text-lg font-black">{link.uniqueClickCount}</div></div><div className="rounded-xl border border-white/5 bg-black/20 p-3"><div className="text-[10px] uppercase text-zinc-500">Created</div><div className="mt-1 text-sm font-bold">{new Date(link.createdAt).toLocaleDateString()}</div></div><div className="rounded-xl border border-white/5 bg-black/20 p-3"><div className="text-[10px] uppercase text-zinc-500">Last clicked</div><div className="mt-1 text-sm font-bold">{link.lastClickedAt ? new Date(link.lastClickedAt).toLocaleString() : "Never"}</div></div></div>
      </div>)}</div>}
    </div>
  </div>;
}
