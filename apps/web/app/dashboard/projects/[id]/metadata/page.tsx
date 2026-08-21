"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import SiteHeader from "../../../../../components/SiteHeader";
import { API_BASE_URL } from "@/lib/api-config";

type ProjectType = "NFT" | "TOKEN" | "AIRDROP" | "OTHER";
type Project = { id: string; name: string; status: string; projectType?: ProjectType };

type Metadata = Record<string, string>;
const fields: Record<ProjectType, string[]> = {
  NFT: ["collectionContractAddress", "supply", "standard"],
  TOKEN: ["symbol", "contractAddress", "tokenStandard", "decimals", "launchDate"],
  AIRDROP: ["snapshotDate", "claimDate", "allocation", "eligibility", "claimUrl"],
  OTHER: ["subtype", "externalUrl", "notes"],
};
const labels: Record<string, string> = { collectionContractAddress: "Collection contract", supply: "Supply", standard: "Standard", symbol: "Symbol", contractAddress: "Contract address", tokenStandard: "Token standard", decimals: "Decimals", launchDate: "Launch date", snapshotDate: "Snapshot date", claimDate: "Claim date", allocation: "Allocation", eligibility: "Eligibility", claimUrl: "Claim URL", subtype: "Subtype", externalUrl: "External URL", notes: "Notes" };

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
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true); setError("");
    try {
      const [projectData, metadataData] = await Promise.all([
        api<{ project: Project }>(`/projects/${id}/manage`),
        api<{ projectType: ProjectType; metadata: Record<string, unknown> }>(`/project-metadata/${id}`),
      ]);
      setProject(projectData.project);
      const nextType = metadataData.projectType ?? projectData.project.projectType ?? "NFT";
      setType(nextType);
      const next: Metadata = {};
      for (const key of fields[nextType]) next[key] = metadataData.metadata?.[key] == null ? "" : String(metadataData.metadata[key]);
      setMetadata(next);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load project metadata"); }
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
        payload[key] = key === "supply" || key === "decimals" ? Number(value) : value;
      }
      await api(`/project-metadata/${project.id}`, { method: "PUT", body: JSON.stringify({ projectType: type, metadata: payload }) });
      setMessage("Project metadata saved successfully.");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save project metadata"); }
    finally { setBusy(false); }
  };

  return <main className="min-h-screen bg-[#06060a] text-zinc-100"><SiteHeader/><div className="mx-auto max-w-4xl px-5 py-10"><Link href={`/dashboard/projects/${id}`} className="text-xs text-zinc-500 hover:text-violet-300">← Project dashboard</Link><div className="mt-6"><span className="text-[9px] font-black tracking-[.2em] text-violet-300/60">PROJECT INFORMATION</span><h1 className="mt-2 text-4xl font-medium">Type-specific metadata.</h1><p className="mt-3 text-sm leading-6 text-zinc-500">Keep the public project information accurate. Changes are validated server-side.</p></div>{loading?<div className="py-20 text-center text-sm text-zinc-600">Loading metadata…</div>:<section className="mt-8 rounded-3xl border border-white/10 bg-[#0d0c11] p-6 sm:p-8"><div className="flex flex-wrap items-end justify-between gap-4"><div><span className="text-[9px] text-zinc-600">PROJECT</span><h2 className="mt-2 text-2xl font-semibold">{project?.name}</h2><p className="mt-1 text-xs text-zinc-600">Status: {project?.status}</p></div><select value={type} onChange={e=>{const next=e.target.value as ProjectType;setType(next);setMetadata(Object.fromEntries(fields[next].map(k=>[k,""])));}} disabled={project?.status === "APPROVED"} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs disabled:opacity-50"><option>NFT</option><option>TOKEN</option><option>AIRDROP</option><option>OTHER</option></select></div>{project?.status === "APPROVED" && <div className="mt-5 rounded-xl border border-yellow-500/15 bg-yellow-500/5 p-4 text-xs text-yellow-200">The project type is locked after approval. You can still update its metadata.</div>}{error&&<div className="mt-5 rounded-xl border border-red-900/50 bg-red-950/20 p-4 text-sm text-red-300">{error}</div>}{message&&<div className="mt-5 rounded-xl border border-emerald-900/50 bg-emerald-950/20 p-4 text-sm text-emerald-300">{message}</div>}<div className="mt-6 grid gap-4 sm:grid-cols-2">{visibleFields.map(key=><label key={key} className={key === "eligibility" || key === "notes" ? "sm:col-span-2" : "block"}><span className="text-[10px] font-bold text-zinc-500">{labels[key] ?? key}</span>{key === "eligibility" || key === "notes" ? <textarea rows={5} value={metadata[key] ?? ""} onChange={e=>setMetadata(m=>({...m,[key]:e.target.value}))} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm outline-none"/> : <input value={metadata[key] ?? ""} onChange={e=>setMetadata(m=>({...m,[key]:e.target.value}))} type={key === "supply" || key === "decimals" ? "number" : key.toLowerCase().includes("date") ? "datetime-local" : "text"} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm outline-none"/>}</label>)}</div><button disabled={busy} onClick={()=>void save()} className="mt-7 w-full rounded-xl bg-violet-500 py-3.5 text-xs font-black text-black disabled:opacity-40">{busy?"Saving…":"Save project information"}</button></section>}</div></main>;
}
