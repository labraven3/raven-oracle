"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import SiteHeader from "../../../../../components/SiteHeader";
import { API_BASE_URL } from "@/lib/api-config";

type ProjectType = "NFT" | "TOKEN" | "AIRDROP" | "OTHER";
type Project = { id: string; name: string; status: string; projectType?: ProjectType };
type Metadata = Record<string, string>;
type Issue = { code: string; field: string; message: string };
type Readiness = { ready: boolean; issues: Issue[] };

const fields: Record<ProjectType, string[]> = {
  NFT: ["collectionContractAddress", "supply", "standard"],
  TOKEN: ["symbol", "contractAddress", "tokenStandard", "decimals", "totalSupply", "explorerUrl", "launchDate"],
  AIRDROP: ["snapshotDate", "claimDate", "claimStatus", "allocation", "eligibility", "claimUrl"],
  OTHER: ["subtype", "externalUrl", "notes"],
};

const labels: Record<string, string> = {
  collectionContractAddress: "Collection contract address",
  supply: "Collection supply",
  standard: "NFT standard",
  symbol: "Token symbol",
  contractAddress: "Contract address",
  tokenStandard: "Token standard",
  decimals: "Decimals",
  totalSupply: "Total supply",
  explorerUrl: "Block explorer URL",
  launchDate: "Launch date",
  snapshotDate: "Snapshot date",
  claimDate: "Claim date",
  claimStatus: "Claim status",
  allocation: "Allocation per wallet",
  eligibility: "Eligibility rules",
  claimUrl: "Claim page URL",
  subtype: "Project type",
  externalUrl: "External project URL",
  notes: "Additional notes",
};

const help: Record<string, string> = {
  collectionContractAddress: "The verified NFT collection contract on the selected network.",
  supply: "Total number of NFTs in the collection.",
  standard: "Choose the token standard used by the collection.",
  tokenStandard: "Choose the token standard used by the token contract.",
  explorerUrl: "A public block-explorer page for the contract or token.",
  eligibility: "Explain who can claim and any snapshot or wallet requirements.",
  claimUrl: "Public page where eligible users can claim.",
};

const isDateField = (key: string) => key === "launchDate" || key === "snapshotDate" || key === "claimDate";
const toLocalDateTime = (value: unknown) => {
  if (typeof value !== "string" || !value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 16);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};
const toIsoIfDateField = (key: string, value: string) => {
  if (!isDateField(key) || !value) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
};

async function api<T>(path: string, options: RequestInit = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers: { "Content-Type": "application/json", ...(options.headers ?? {}) }, credentials: "include" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message ?? `Request failed (${response.status})`);
  return data as T;
}

export default function ProjectMetadataEditor() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [type, setType] = useState<ProjectType>("NFT");
  const [metadata, setMetadata] = useState<Metadata>({});
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true); setError("");
    try {
      const [projectData, metadataData, readinessData] = await Promise.all([
        api<{ project: Project }>(`/projects/${id}/manage`),
        api<{ projectType: ProjectType; metadata: Record<string, unknown> }>(`/project-metadata/${id}`),
        api<Readiness>(`/project-approval/${id}`),
      ]);
      setProject(projectData.project);
      const nextType = metadataData.projectType ?? projectData.project.projectType ?? "NFT";
      setType(nextType);
      const next: Metadata = {};
      for (const key of fields[nextType]) {
        const raw = metadataData.metadata?.[key];
        next[key] = isDateField(key) ? toLocalDateTime(raw) : raw == null ? "" : String(raw);
      }
      setMetadata(next); setReadiness(readinessData);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load project information"); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [id]);
  const visibleFields = useMemo(() => fields[type], [type]);

  const save = async () => {
    if (!project) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const payload: Record<string, unknown> = {};
      for (const key of visibleFields) {
        const value = metadata[key] ?? "";
        if (!value) continue;
        payload[key] = key === "supply" || key === "decimals" ? Number(value) : toIsoIfDateField(key, value);
      }
      await api(`/project-metadata/${project.id}`, { method: "PUT", body: JSON.stringify({ projectType: type, metadata: payload }) });
      const nextReadiness = await api<Readiness>(`/project-approval/${project.id}`);
      setReadiness(nextReadiness);
      setMessage(nextReadiness.ready ? "Saved. Your project is ready for admin review." : `Saved. ${nextReadiness.issues.length} item${nextReadiness.issues.length === 1 ? "" : "s"} still need attention.`);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save project information"); }
    finally { setBusy(false); }
  };

  const fieldControl = (key: string) => {
    const common = "mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-zinc-100 outline-none transition focus:border-violet-400/50";
    if (key === "standard") return <select value={metadata[key] ?? ""} onChange={e => setMetadata(m => ({ ...m, [key]: e.target.value }))} className={common}><option value="">Select standard</option><option value="ERC-721">ERC-721</option><option value="ERC-1155">ERC-1155</option></select>;
    if (key === "tokenStandard") return <select value={metadata[key] ?? ""} onChange={e => setMetadata(m => ({ ...m, [key]: e.target.value }))} className={common}><option value="">Select standard</option><option value="ERC-20">ERC-20</option><option value="SPL">SPL</option><option value="Other">Other</option></select>;
    if (key === "claimStatus") return <select value={metadata[key] ?? ""} onChange={e => setMetadata(m => ({ ...m, [key]: e.target.value }))} className={common}><option value="">Not specified</option><option value="UPCOMING">Upcoming</option><option value="LIVE">Live</option><option value="ENDED">Ended</option></select>;
    if (key === "eligibility" || key === "notes") return <textarea rows={5} value={metadata[key] ?? ""} onChange={e => setMetadata(m => ({ ...m, [key]: e.target.value }))} className={common} placeholder={key === "eligibility" ? "Describe wallet, snapshot or other eligibility requirements" : "Anything else participants should know"} />;
    return <input value={metadata[key] ?? ""} onChange={e => setMetadata(m => ({ ...m, [key]: e.target.value }))} type={key === "supply" || key === "decimals" ? "number" : isDateField(key) ? "datetime-local" : "text"} min={key === "supply" || key === "decimals" ? "0" : undefined} placeholder={key === "collectionContractAddress" || key === "contractAddress" ? "0x…" : undefined} className={common} />;
  };

  return <main className="min-h-screen bg-[#06060a] text-zinc-100"><SiteHeader /><div className="mx-auto max-w-4xl px-5 py-10">
    <Link href={`/dashboard/projects/${id}`} className="text-xs text-zinc-500 hover:text-violet-300">← Project dashboard</Link>
    <div className="mt-6"><span className="text-[9px] font-black tracking-[.2em] text-violet-300/60">PROJECT INFORMATION</span><h1 className="mt-2 text-4xl font-medium tracking-tight">Project details</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500">Add the technical details participants need to understand your project. Only provide information you can verify.</p></div>
    {loading ? <div className="py-20 text-center text-sm text-zinc-600">Loading project information…</div> : <section className="mt-8 rounded-3xl border border-white/10 bg-[#0d0c11] p-6 sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-5"><div><span className="text-[9px] font-black tracking-[.16em] text-zinc-600">PROJECT</span><h2 className="mt-2 text-2xl font-semibold">{project?.name}</h2><p className="mt-1 text-xs text-zinc-600">Current status: {project?.status}</p></div><label className="min-w-44 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Project category<select value={type} onChange={e => { const next = e.target.value as ProjectType; setType(next); setMetadata(Object.fromEntries(fields[next].map(k => [k, ""]))); }} disabled={project?.status === "APPROVED"} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-xs text-zinc-100 disabled:opacity-50"><option value="NFT">NFT collection</option><option value="TOKEN">Token</option><option value="AIRDROP">Airdrop</option><option value="OTHER">Other</option></select></label></div>
      {project?.status === "APPROVED" && <div className="mt-5 rounded-xl border border-yellow-500/15 bg-yellow-500/5 p-4 text-xs text-yellow-200">The project category is locked after approval. You can still update its supporting information.</div>}
      {readiness && <div className={`mt-5 rounded-xl border p-4 ${readiness.ready ? "border-emerald-500/20 bg-emerald-500/5" : "border-amber-500/15 bg-amber-500/5"}`}><div className="flex flex-wrap items-center justify-between gap-3"><div><span className="text-[9px] font-black tracking-[.16em] text-zinc-500">REVIEW STATUS</span><p className="mt-1 text-sm text-zinc-200">{readiness.ready ? "Ready for admin review" : `${readiness.issues.length} item${readiness.issues.length === 1 ? "" : "s"} need attention`}</p></div><Link href={`/dashboard/projects/${id}/approval`} className="text-xs font-bold text-violet-300">View review checklist →</Link></div></div>}
      {error && <div className="mt-5 rounded-xl border border-red-900/50 bg-red-950/20 p-4 text-sm text-red-300">{error}</div>}{message && <div className="mt-5 rounded-xl border border-emerald-900/50 bg-emerald-950/20 p-4 text-sm text-emerald-300">{message}</div>}
      <div className="mt-7 grid gap-5 sm:grid-cols-2">{visibleFields.map(key => <label key={key} className={key === "eligibility" || key === "notes" ? "sm:col-span-2" : "block"}><span className="text-[10px] font-bold text-zinc-400">{labels[key] ?? key}</span>{fieldControl(key)}{help[key] && <span className="mt-1.5 block text-[10px] leading-4 text-zinc-600">{help[key]}</span>}</label>)}</div>
      <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-end"><button type="button" onClick={() => void load()} disabled={busy} className="rounded-xl border border-white/10 px-5 py-3 text-xs font-bold text-zinc-400 hover:text-zinc-200 disabled:opacity-40">Discard changes</button><button type="button" disabled={busy} onClick={() => void save()} className="rounded-xl bg-violet-500 px-6 py-3 text-xs font-black text-black disabled:opacity-40">{busy ? "Saving…" : "Save project details"}</button></div>
    </section>}
  </div></main>;
}
