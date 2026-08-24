"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { API_BASE_URL } from "@/lib/api-config";

const MAX_IMAGE_BYTES = 1 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];
type Chain = { id: string; name: string; slug: string };
type ProjectType = "NFT" | "TOKEN" | "AIRDROP" | "OTHER";

async function api<T>(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  const token = localStorage.getItem("raven_token");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers, credentials: "include" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message ?? `Request failed (${response.status})`);
  return data as T;
}

function isoOrUndefined(value: string) {
  if (!value) return undefined;
  return new Date(`${value}T00:00:00.000Z`).toISOString();
}

function normalizeUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export default function NewProject() {
  const router = useRouter();
  const [chains, setChains] = useState<Chain[]>([]);
  const [form, setForm] = useState({ name: "", description: "", websiteUrl: "", xUrl: "", discordUrl: "", logoUrl: "", bannerUrl: "", projectType: "NFT" as ProjectType, chain: "" });
  const [tokenMeta, setTokenMeta] = useState({ symbol: "", contractAddress: "", tokenStandard: "", decimals: "", launchDate: "" });
  const [airdropMeta, setAirdropMeta] = useState({ snapshotDate: "", claimDate: "", allocation: "", eligibility: "", claimUrl: "" });
  const [otherMeta, setOtherMeta] = useState({ subtype: "", externalUrl: "", notes: "" });
  const [nftMeta, setNftMeta] = useState({ supply: "", mintDate: "TBD" });
  const [logoName, setLogoName] = useState("");
  const [bannerName, setBannerName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch(`${API_BASE_URL}/chains`, { cache: "no-store" })
      .then(async (r) => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.message ?? "Unable to load chains"); return d as { chains?: Chain[] }; })
      .then((d) => { setChains(d.chains ?? []); if (d.chains?.[0]) setForm((f) => ({ ...f, chain: f.chain || d.chains![0].name })); })
      .catch((e) => setMessage(e instanceof Error ? e.message : "Unable to load chains"));
  }, []);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((current) => ({ ...current, [key]: value }));
  const handleImage = (kind: "logoUrl" | "bannerUrl", file: File | undefined) => {
    setMessage("");
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) return setMessage("Image must be PNG, JPG or WEBP.");
    if (file.size > MAX_IMAGE_BYTES) return setMessage("Image must be 1 MB or smaller.");
    const reader = new FileReader();
    reader.onload = () => { if (typeof reader.result !== "string") return setMessage("Unable to read that image."); set(kind, reader.result); kind === "logoUrl" ? setLogoName(file.name) : setBannerName(file.name); };
    reader.readAsDataURL(file);
  };

  const metadataForType = () => {
    if (form.projectType === "TOKEN") return {
      symbol: tokenMeta.symbol,
      contractAddress: tokenMeta.contractAddress,
      tokenStandard: tokenMeta.tokenStandard,
      decimals: tokenMeta.decimals ? Number(tokenMeta.decimals) : undefined,
      launchDate: isoOrUndefined(tokenMeta.launchDate),
    };
    if (form.projectType === "AIRDROP") return {
      snapshotDate: isoOrUndefined(airdropMeta.snapshotDate),
      claimDate: isoOrUndefined(airdropMeta.claimDate),
      allocation: airdropMeta.allocation,
      eligibility: airdropMeta.eligibility,
      claimUrl: airdropMeta.claimUrl,
    };
    if (form.projectType === "OTHER") return otherMeta;
    return {
      supply: nftMeta.supply ? Number(nftMeta.supply) : undefined,
      mintDate: nftMeta.mintDate.trim() || "TBD",
    };
  };

  const submit = async () => {
    if (!form.name.trim()) return setMessage("Project name is required.");
    if (!form.description.trim()) return setMessage("Project description is required.");
    if (!form.chain) return setMessage("Project chain is required.");
    if (!form.logoUrl) return setMessage("Project logo is required.");
    if (!form.bannerUrl) return setMessage("Project cover image is required.");
    if (form.projectType === "TOKEN" && (!tokenMeta.symbol.trim() || !tokenMeta.contractAddress.trim())) return setMessage("Token symbol and contract address are required.");
    setBusy(true); setMessage("");
    try {
      const payload = {
        ...form,
        websiteUrl: normalizeUrl(form.websiteUrl),
        xUrl: normalizeUrl(form.xUrl),
        discordUrl: normalizeUrl(form.discordUrl),
      };

      const data = await api<{ project: { id: string; name: string; projectType: ProjectType } }>("/projects/", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      await api(`/project-metadata/${data.project.id}`, { method: "PUT", body: JSON.stringify({ projectType: data.project.projectType, metadata: metadataForType() }) });
      setMessage(`Project “${data.project.name}” (${data.project.projectType}) submitted for approval.`);
      setTimeout(() => router.push(`/dashboard/projects/${data.project.id}`), 400);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to create project"); }
    finally { setBusy(false); }
  };

  return <main className="min-h-screen bg-[#07070a] text-zinc-100">
    <header className="border-b border-white/10 px-5 py-5"><div className="mx-auto flex max-w-5xl items-center justify-between"><Link href="/" className="font-black tracking-[.18em]">RAVEN ORACLE</Link><Link href="/dashboard" className="text-xs text-zinc-500">My Dashboard →</Link></div></header>
    <div className="mx-auto max-w-5xl px-5 py-14">
      <div className="max-w-2xl"><span className="text-[9px] font-black tracking-[.2em] text-violet-300/60">PROJECT ONBOARDING</span><h1 className="mt-3 text-5xl font-medium tracking-tight">Create a project.</h1><p className="mt-4 text-sm leading-6 text-zinc-500">List an NFT, token, airdrop, or other Web3 project. Type-specific data helps Raven Oracle present accurate project details.</p></div>
      <section className="mt-10 rounded-2xl border border-white/10 bg-[#0d0c11] p-6">
        <div className="grid gap-5 md:grid-cols-2">
          <label>Project name <span className="text-violet-300">*</span><input value={form.name} onChange={e => set("name", e.target.value)} placeholder="Project name" /></label>
          <label>Project type <span className="text-violet-300">*</span><select value={form.projectType} onChange={e => set("projectType", e.target.value as ProjectType)}>{(["NFT", "TOKEN", "AIRDROP", "OTHER"] as ProjectType[]).map(item => <option key={item}>{item}</option>)}</select></label>
          <label className="md:col-span-2">Description <span className="text-violet-300">*</span><textarea value={form.description} onChange={e => set("description", e.target.value)} placeholder="Short description of the project" /></label>
          <label>Chain <span className="text-violet-300">*</span><select value={form.chain} onChange={e => set("chain", e.target.value)}><option value="">Select chain</option>{chains.map(item => <option key={item.id} value={item.name}>{item.name}</option>)}</select></label>
          <label>Website <span className="text-zinc-600">(Optional)</span><input value={form.websiteUrl} onChange={e => set("websiteUrl", e.target.value)} placeholder="https://example.com" /></label>
          <label>X profile <span className="text-zinc-600">(Optional)</span><input value={form.xUrl} onChange={e => set("xUrl", e.target.value)} placeholder="https://x.com/project" /></label>
          <label>Discord invite <span className="text-zinc-600">(Optional)</span><input value={form.discordUrl} onChange={e => set("discordUrl", e.target.value)} placeholder="https://discord.gg/project" /></label>
        </div>

        <div className="mt-6 rounded-xl border border-violet-500/15 bg-violet-500/[.03] p-5">
          <div className="text-[9px] font-black tracking-[.2em] text-violet-300/70">TYPE-SPECIFIC DATA</div>
          {form.projectType === "NFT" && <div className="mt-4 grid gap-4 md:grid-cols-2"><label>Supply<input type="number" min="1" value={nftMeta.supply} onChange={e => setNftMeta({ ...nftMeta, supply: e.target.value })} placeholder="10000" /></label><label>Mint date<input value={nftMeta.mintDate} onChange={e => setNftMeta({ ...nftMeta, mintDate: e.target.value })} placeholder="TBD or 2026-09-01" /></label></div>}
          {form.projectType === "TOKEN" && <div className="mt-4 grid gap-4 md:grid-cols-2"><label>Symbol <span className="text-violet-300">*</span><input value={tokenMeta.symbol} onChange={e => setTokenMeta({ ...tokenMeta, symbol: e.target.value })} placeholder="RAVEN" /></label><label>Contract address <span className="text-violet-300">*</span><input value={tokenMeta.contractAddress} onChange={e => setTokenMeta({ ...tokenMeta, contractAddress: e.target.value })} placeholder="0x… / token address" /></label><label>Token standard<input value={tokenMeta.tokenStandard} onChange={e => setTokenMeta({ ...tokenMeta, tokenStandard: e.target.value })} placeholder="ERC-20 / SPL" /></label><label>Decimals<input type="number" min="0" max="36" value={tokenMeta.decimals} onChange={e => setTokenMeta({ ...tokenMeta, decimals: e.target.value })} placeholder="18" /></label><label>Launch date<input type="date" value={tokenMeta.launchDate} onChange={e => setTokenMeta({ ...tokenMeta, launchDate: e.target.value })} /></label></div>}
          {form.projectType === "AIRDROP" && <div className="mt-4 grid gap-4 md:grid-cols-2"><label>Snapshot date<input type="date" value={airdropMeta.snapshotDate} onChange={e => setAirdropMeta({ ...airdropMeta, snapshotDate: e.target.value })} /></label><label>Claim date<input type="date" value={airdropMeta.claimDate} onChange={e => setAirdropMeta({ ...airdropMeta, claimDate: e.target.value })} /></label><label>Allocation<input value={airdropMeta.allocation} onChange={e => setAirdropMeta({ ...airdropMeta, allocation: e.target.value })} placeholder="100M tokens / 5% supply" /></label><label>Claim URL<input value={airdropMeta.claimUrl} onChange={e => setAirdropMeta({ ...airdropMeta, claimUrl: e.target.value })} placeholder="https://project.com/claim" /></label><label className="md:col-span-2">Eligibility<textarea value={airdropMeta.eligibility} onChange={e => setAirdropMeta({ ...airdropMeta, eligibility: e.target.value })} placeholder="Who qualifies and what actions are required?" /></label></div>}
          {form.projectType === "OTHER" && <div className="mt-4 grid gap-4 md:grid-cols-2"><label>Subtype<input value={otherMeta.subtype} onChange={e => setOtherMeta({ ...otherMeta, subtype: e.target.value })} placeholder="Tool, Game, Community…" /></label><label>External URL<input value={otherMeta.externalUrl} onChange={e => setOtherMeta({ ...otherMeta, externalUrl: e.target.value })} placeholder="https://example.com" /></label><label className="md:col-span-2">Notes<textarea value={otherMeta.notes} onChange={e => setOtherMeta({ ...otherMeta, notes: e.target.value })} placeholder="Additional project details" /></label></div>}
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <div><div className="mb-2 text-[11px] text-zinc-500">Project logo <span className="text-violet-300">*</span></div>{!form.logoUrl ? <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-white/15 bg-black/20 text-center"><input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e => handleImage("logoUrl", e.target.files?.[0])}/><span className="text-sm font-medium text-zinc-200">Upload logo</span><span className="mt-1 text-xs text-zinc-600">PNG, JPG or WEBP · max 1 MB</span></label> : <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-3"><img src={form.logoUrl} alt="Logo preview" className="h-16 w-16 rounded-xl object-cover"/><p className="min-w-0 flex-1 truncate text-xs text-zinc-200">{logoName}</p><button type="button" onClick={() => { set("logoUrl", ""); setLogoName(""); }} className="rounded-lg border border-red-500/20 px-3 py-2 text-xs text-red-300">Remove</button></div>}</div>
          <div><div className="mb-2 text-[11px] text-zinc-500">Project cover / banner <span className="text-violet-300">*</span></div>{!form.bannerUrl ? <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-white/15 bg-black/20 text-center"><input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e => handleImage("bannerUrl", e.target.files?.[0])}/><span className="text-sm font-medium text-zinc-200">Upload cover image</span><span className="mt-1 text-xs text-zinc-600">Use a wide artwork · PNG, JPG or WEBP · max 1 MB</span></label> : <div className="overflow-hidden rounded-xl border border-white/10 bg-black/20"><img src={form.bannerUrl} alt="Banner preview" className="h-24 w-full object-cover"/><div className="flex items-center justify-between p-3"><p className="truncate text-xs text-zinc-200">{bannerName}</p><button type="button" onClick={() => { set("bannerUrl", ""); setBannerName(""); }} className="rounded-lg border border-red-500/20 px-3 py-2 text-xs text-red-300">Remove</button></div></div>}</div>
        </div>
      </section>
      {message && <div className="mt-5 rounded-xl border border-violet-900/50 bg-violet-950/20 p-4 text-sm text-violet-200">{message}</div>}
      <button disabled={busy} onClick={() => void submit()} className="mt-6 w-full rounded-xl bg-violet-500 py-4 text-sm font-black disabled:opacity-50">{busy ? "Submitting project…" : "Create project"}</button>
    </div>
    <style jsx>{`label{display:block;font-size:11px;color:#77717f}input,textarea,select{display:block;width:100%;margin-top:8px;border:1px solid #292531;border-radius:8px;background:#08080b;color:#f5f5f7;padding:11px;font-size:12px;outline:none}textarea{min-height:90px;resize:vertical}input:focus,textarea:focus,select:focus{border-color:#7651ad}`}</style>
  </main>;
}
