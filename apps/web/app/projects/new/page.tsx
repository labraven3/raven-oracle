"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { API_BASE_URL } from "@/lib/api-config";

const MAX_IMAGE_BYTES = 1 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];
type Chain = { id: string; name: string; slug: string };

async function api<T>(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: "include",
    cache: "no-store",
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const token = typeof window !== "undefined"
      ? localStorage.getItem("raven_token")
      : null;

    if (response.status === 401 && token) {
      headers.set("Authorization", `Bearer ${token}`);

      const retry = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers,
        credentials: "include",
        cache: "no-store",
      });

      const retryData = await retry.json().catch(() => ({}));

      if (!retry.ok) {
        throw new Error(retryData.message ?? `Request failed (${retry.status})`);
      }

      return retryData as T;
    }

    throw new Error(data.message ?? `Request failed (${response.status})`);
  }

  return data as T;
}

function normalizeUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export default function NewProject() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);
  const [chains, setChains] = useState<Chain[]>([]);
  const [form, setForm] = useState({ name: "", description: "", websiteUrl: "", xUrl: "", discordUrl: "", logoUrl: "", bannerUrl: "", projectType: "NFT" as const, chain: "" });
  const [nftMeta, setNftMeta] = useState({ supply: "", mintDate: "TBD" });
  const [logoName, setLogoName] = useState("");
  const [bannerName, setBannerName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    const checkAccessAndLoad = async () => {
      setChecking(true);
      const token = localStorage.getItem("raven_token");
      try {
        const response = await fetch(`${API_BASE_URL}/auth/me`, {
          method: "GET",
          credentials: "include",
          cache: "no-store",
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (!response.ok) {
          if (!cancelled) router.replace("/login?next=/projects/new");
          return;
        }
        if (cancelled) return;
        setAuthorized(true);

        const chainsResponse = await fetch(`${API_BASE_URL}/chains`, { credentials: "include", cache: "no-store" });
        const data = await chainsResponse.json().catch(() => ({}));
        if (!chainsResponse.ok) throw new Error(data.message ?? "Unable to load chains");
        if (cancelled) return;
        setChains(data.chains ?? []);
        if (data.chains?.[0]) setForm((current) => ({ ...current, chain: current.chain || data.chains[0].name }));
      } catch (error) {
        if (!cancelled) setMessage(error instanceof Error ? error.message : "Unable to load project submission");
      } finally {
        if (!cancelled) setChecking(false);
      }
    };
    void checkAccessAndLoad();
    return () => { cancelled = true; };
  }, [router]);

  const setField = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((current) => ({ ...current, [key]: value }));

  const handleImage = (kind: "logoUrl" | "bannerUrl", file: File | undefined) => {
    setMessage("");
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) return setMessage("Image must be PNG, JPG or WEBP.");
    if (file.size > MAX_IMAGE_BYTES) return setMessage("Image must be 1 MB or smaller.");
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return setMessage("Unable to read that image.");
      setField(kind, reader.result);
      kind === "logoUrl" ? setLogoName(file.name) : setBannerName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const submit = async () => {
    if (!form.name.trim()) return setMessage("Project name is required.");
    if (!form.description.trim()) return setMessage("Project description is required.");
    if (!form.chain) return setMessage("Project chain is required.");
    if (!form.logoUrl) return setMessage("Project logo is required.");
    if (!form.bannerUrl) return setMessage("Project banner is required.");
    if (nftMeta.supply && (!Number.isInteger(Number(nftMeta.supply)) || Number(nftMeta.supply) < 1)) return setMessage("Supply must be a positive whole number.");
    setBusy(true); setMessage("");
    try {
      const payload = { ...form, websiteUrl: normalizeUrl(form.websiteUrl), xUrl: normalizeUrl(form.xUrl), discordUrl: normalizeUrl(form.discordUrl) };
      const data = await api<{ project: { id: string; name: string } }>("/projects/", { method: "POST", body: JSON.stringify(payload) });
      await api(`/project-metadata/${data.project.id}`, { method: "PUT", body: JSON.stringify({ projectType: "NFT", metadata: { supply: nftMeta.supply ? Number(nftMeta.supply) : undefined, mintDate: nftMeta.mintDate.trim() || "TBD" } }) });
      setMessage(`NFT project “${data.project.name}” submitted. It will appear publicly after admin approval.`);
      setTimeout(() => router.push(`/dashboard/projects/${data.project.id}`), 700);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to submit project");
    } finally { setBusy(false); }
  };

  if (checking || !authorized) return <main className="min-h-screen bg-[#07070a] text-zinc-100"><div className="mx-auto flex min-h-screen max-w-xl items-center justify-center px-5"><div className="text-center"><div className="text-[9px] font-black tracking-[.2em] text-violet-300/70">PROJECT SUBMISSION</div><h1 className="mt-3 text-3xl font-medium">Checking access…</h1></div></div></main>;

  return <main className="min-h-screen bg-[#07070a] text-zinc-100">
    <header className="border-b border-white/10 px-5 py-5"><div className="mx-auto flex max-w-5xl items-center justify-between"><Link href="/" className="font-black tracking-[.18em]">RAVEN ORACLE</Link><Link href="/account" className="text-xs text-zinc-500 hover:text-zinc-300">Back to profile →</Link></div></header>
    <div className="mx-auto max-w-5xl px-5 py-12 sm:py-14">
      <div className="max-w-2xl"><span className="text-[9px] font-black tracking-[.2em] text-violet-300/60">PROJECT SUBMISSION</span><h1 className="mt-3 text-4xl font-medium tracking-tight sm:text-5xl">Submit an NFT project.</h1><p className="mt-4 text-sm leading-6 text-zinc-500">Add your project to Raven Oracle. Every submission is reviewed by our admin team before it becomes public.</p></div>
      <section className="mt-9 rounded-3xl border border-white/10 bg-[#0d0c11] p-6 sm:p-7">
        <div className="grid gap-5 md:grid-cols-2">
          <label className="text-xs text-zinc-400">Project name <span className="text-violet-300">*</span><input value={form.name} onChange={(e) => setField("name", e.target.value)} placeholder="Project name" /></label>
          <label className="text-xs text-zinc-400">Chain <span className="text-violet-300">*</span><select value={form.chain} onChange={(e) => setField("chain", e.target.value)}><option value="">Select chain</option>{chains.map((chain) => <option key={chain.id} value={chain.name}>{chain.name}</option>)}</select></label>
          <label className="md:col-span-2 text-xs text-zinc-400">Description <span className="text-violet-300">*</span><textarea value={form.description} onChange={(e) => setField("description", e.target.value)} placeholder="Short description of the project" /></label>
          <label className="text-xs text-zinc-400">Website <span className="text-zinc-600">(Optional)</span><input value={form.websiteUrl} onChange={(e) => setField("websiteUrl", e.target.value)} placeholder="https://example.com" /></label>
          <label className="text-xs text-zinc-400">X profile <span className="text-zinc-600">(Optional)</span><input value={form.xUrl} onChange={(e) => setField("xUrl", e.target.value)} placeholder="https://x.com/project" /></label>
          <label className="text-xs text-zinc-400 md:col-span-2">Discord invite <span className="text-zinc-600">(Optional)</span><input value={form.discordUrl} onChange={(e) => setField("discordUrl", e.target.value)} placeholder="https://discord.gg/project" /></label>
        </div>
        <div className="mt-6 rounded-2xl border border-violet-500/15 bg-violet-500/[.03] p-5"><div className="text-[9px] font-black tracking-[.2em] text-violet-300/70">NFT DETAILS</div><div className="mt-4 grid gap-4 md:grid-cols-2"><label className="text-xs text-zinc-400">WL / Supply <span className="text-zinc-600">(Optional)</span><input type="number" min="1" step="1" value={nftMeta.supply} onChange={(e) => setNftMeta((current) => ({ ...current, supply: e.target.value }))} placeholder="7000" /></label><label className="text-xs text-zinc-400">Mint date<input value={nftMeta.mintDate} onChange={(e) => setNftMeta((current) => ({ ...current, mintDate: e.target.value }))} placeholder="TBD" /><span className="mt-1 block text-[10px] text-zinc-600">Keep TBD when the date is not decided.</span></label></div></div>
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <div><div className="mb-2 text-[11px] text-zinc-500">Project logo <span className="text-violet-300">*</span></div>{!form.logoUrl ? <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-black/20 text-center"><input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => handleImage("logoUrl", e.target.files?.[0])}/><span className="text-sm font-medium text-zinc-200">Upload logo</span><span className="mt-1 text-xs text-zinc-600">PNG, JPG or WEBP · max 1 MB</span></label> : <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 p-3"><img src={form.logoUrl} alt="Logo preview" className="h-16 w-16 rounded-xl object-contain bg-white/5"/><p className="min-w-0 flex-1 truncate text-xs text-zinc-200">{logoName}</p><button type="button" onClick={() => { setField("logoUrl", ""); setLogoName(""); }} className="rounded-lg border border-red-500/20 px-3 py-2 text-xs text-red-300">Remove</button></div>}</div>
          <div><div className="mb-2 text-[11px] text-zinc-500">Project banner <span className="text-violet-300">*</span></div>{!form.bannerUrl ? <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-black/20 text-center"><input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => handleImage("bannerUrl", e.target.files?.[0])}/><span className="text-sm font-medium text-zinc-200">Upload banner</span><span className="mt-1 text-xs text-zinc-600">Wide artwork · PNG, JPG or WEBP · max 1 MB</span></label> : <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/20"><div className="flex min-h-32 items-center justify-center bg-[#111118]"><img src={form.bannerUrl} alt="Banner preview" className="max-h-40 w-full object-contain"/></div><div className="flex items-center justify-between gap-3 p-3"><p className="truncate text-xs text-zinc-200">{bannerName}</p><button type="button" onClick={() => { setField("bannerUrl", ""); setBannerName(""); }} className="rounded-lg border border-red-500/20 px-3 py-2 text-xs text-red-300">Remove</button></div></div>}</div>
        </div>
      </section>
      {message && <div className="mt-5 rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4 text-sm text-violet-200">{message}</div>}
      <button disabled={busy} onClick={() => void submit()} className="mt-6 w-full rounded-2xl bg-violet-600 py-4 text-sm font-black text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Submitting…" : "Submit NFT project"}</button>
    </div>
    <style jsx>{`input,textarea,select{width:100%;border:1px solid #292531;border-radius:10px;background:#08080b;color:#f5f5f7;padding:11px;font-size:12px;outline:none}textarea{min-height:110px;resize:vertical}`}</style>
  </main>;
}
