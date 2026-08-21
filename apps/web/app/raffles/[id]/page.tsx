"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import SiteHeader from "../../../components/SiteHeader";
import { API_BASE_URL } from "@/lib/api-config";
import { useTheme } from "@/contexts/ThemeContext";

type User = { id: string; email?: string | null; displayName?: string | null; username?: string | null };
type Social = { provider: "X" | "DISCORD"; providerUsername?: string | null; isActive?: boolean };
type Wallet = { id: string; address: string; chain: "EVM" | "SOLANA"; network: string; status?: string };
type Raffle = { id: string; title: string; description?: string | null; prizeName: string; prizeDescription?: string | null; prizeQuantity: number; startsAt: string; endsAt: string; status: string; winnerCount?: number; project?: { id?: string; name?: string | null; logoUrl?: string | null } | null };
type Task = { id: string; type: "DISCORD_JOIN" | "X_FOLLOW" | "X_LIKE" | "X_REPOST"; title: string; description?: string | null; target: string; targetUrl?: string | null; isRequired: boolean };
type TaskResult = { taskId: string; type: Task["type"]; title: string; required: boolean; verified: boolean; reason?: string | null };
type EntryDetails = { id: string; status: string; walletAddressSnapshot: string; eligibilityReasons?: unknown; riskLevel?: string | null; enteredAt: string; walletAddress: { chain: string; network: string } };

async function api<T>(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers, credentials: "include" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message ?? `Request failed (${response.status})`);
  return data as T;
}

function icon(type: Task["type"]) { return type === "DISCORD_JOIN" ? "◈" : type === "X_FOLLOW" ? "𝕏" : type === "X_LIKE" ? "♡" : "↻"; }
function taskProvider(type: Task["type"]): "X" | "DISCORD" { return type === "DISCORD_JOIN" ? "DISCORD" : "X"; }
function taskLabel(type: Task["type"]) { return type === "DISCORD_JOIN" ? "Discord join" : type === "X_FOLLOW" ? "X follow" : type === "X_LIKE" ? "X like" : "X repost"; }
function countdown(value: string) { const ms = new Date(value).getTime() - Date.now(); if (ms <= 0) return "Now"; const minutes = Math.floor(ms / 60000); return minutes >= 1440 ? `${Math.floor(minutes / 1440)}d ${Math.floor((minutes % 1440) / 60)}h` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`; }

export default function RafflePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const dark = theme === "dark";
  const page = dark ? "bg-[#06060a] text-zinc-100" : "bg-white text-zinc-900";
  const card = dark ? "border-white/10 bg-[#0d0c11]" : "border-zinc-200 bg-white";
  const softCard = dark ? "border-white/10 bg-black/20" : "border-zinc-200 bg-zinc-50";
  const muted = dark ? "text-zinc-500" : "text-zinc-600";
  const faint = dark ? "text-zinc-600" : "text-zinc-500";
  const border = dark ? "border-white/10" : "border-zinc-200";

  const [raffle, setRaffle] = useState<Raffle | null>(null), [tasks, setTasks] = useState<Task[]>([]), [results, setResults] = useState<Record<string, TaskResult>>({}), [entry, setEntry] = useState<EntryDetails | null>(null), [user, setUser] = useState<User | null>(null), [socials, setSocials] = useState<Social[]>([]), [wallets, setWallets] = useState<Wallet[]>([]), [walletId, setWalletId] = useState(""), [address, setAddress] = useState(""), [chain, setChain] = useState<"EVM" | "SOLANA">("EVM"), [walletModal, setWalletModal] = useState(false), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [message, setMessage] = useState("");

  const loadAccount = useCallback(async () => {
    try {
      const me = await api<{ user: User }>("/auth/me");
      setUser(me.user);
      const [socialData, walletData] = await Promise.all([api<{ accounts: Social[] }>("/social-accounts/"), api<{ wallets: Wallet[] }>("/wallets/")]);
      setSocials(socialData.accounts ?? []);
      const activeWallets = (walletData.wallets ?? []).filter((wallet) => wallet.status !== "DELETED");
      setWallets(activeWallets); setWalletId((current) => current || activeWallets[0]?.id || "");
    } catch { setUser(null); setSocials([]); setWallets([]); setWalletId(""); }
  }, []);

  const loadRaffle = useCallback(async () => {
    if (!id) return;
    try {
      const [raffleData, taskData] = await Promise.all([api<{ raffle: Raffle }>(`/raffles/${id}`), api<{ tasks: Task[] }>(`/raffles/${id}/tasks`)]);
      setRaffle(raffleData.raffle); setTasks(taskData.tasks ?? []);
      try { const entryData = await api<{ entry: EntryDetails }>(`/raffles/${id}/entries/me`); setEntry(entryData.entry); } catch { setEntry(null); }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to load raffle"); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { void Promise.all([loadAccount(), loadRaffle()]); }, [loadAccount, loadRaffle]);

  const required = useMemo(() => tasks.filter((task) => task.isRequired), [tasks]);
  const verifiedRequired = required.filter((task) => results[task.id]?.verified).length;
  const allRequiredVerified = required.length > 0 && verifiedRequired === required.length;
  const connected = (provider: "X" | "DISCORD") => socials.some((social) => social.provider === provider && social.isActive !== false);
  const canEnter = raffle?.status === "ACTIVE" && Date.now() >= new Date(raffle.startsAt).getTime() && Date.now() <= new Date(raffle.endsAt).getTime();

  const requireLogin = () => router.push(`/login?next=${encodeURIComponent(`/raffles/${id}`)}`);
  const connectSocial = async (provider: "x" | "discord") => {
    if (!user) return requireLogin();
    try { const data = await api<{ authorizationUrl: string }>(`/auth/${provider}/start`); window.location.href = data.authorizationUrl; }
    catch (error) { setMessage(error instanceof Error ? error.message : `Unable to connect ${provider}`); }
  };

  const addWallet = async () => {
    if (!user) return requireLogin();
    if (!address.trim()) return setMessage("Enter a wallet address.");
    setBusy(true);
    try {
      const data = await api<{ wallet: Wallet }>("/wallets/", { method: "POST", body: JSON.stringify({ address: address.trim(), chain }) });
      setWallets((items) => [data.wallet, ...items]); setWalletId(data.wallet.id); setAddress(""); setWalletModal(false);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save wallet"); }
    finally { setBusy(false); }
  };

  const verifyAll = async () => {
    if (!user) return requireLogin();
    if (!entry) return setMessage("Enter the raffle first.");
    setBusy(true);
    try {
      const data = await api<{ allRequiredTasksVerified: boolean; tasks: TaskResult[]; entry: EntryDetails }>(`/raffles/${id}/entries/me/verify-tasks`, { method: "POST" });
      const nextResults: Record<string, TaskResult> = {}; for (const result of data.tasks ?? []) nextResults[result.taskId] = result;
      setResults(nextResults); setEntry(data.entry);
      setMessage(data.allRequiredTasksVerified ? "All required tasks verified. You are eligible." : "Entry is pending. Complete every required task to become eligible.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Verification failed"); }
    finally { setBusy(false); }
  };

  const enter = async () => {
    if (!user) return requireLogin();
    if (!canEnter) return setMessage(raffle?.status === "SCHEDULED" ? `Starts in ${countdown(raffle.startsAt)}.` : "Entries are closed.");
    if (!walletId) return setWalletModal(true);
    setBusy(true);
    try {
      const data = await api<{ entry: EntryDetails }>(`/raffles/${id}/entries`, { method: "POST", body: JSON.stringify({ walletAddressId: walletId }) });
      setEntry(data.entry); setMessage("Entry created as PENDING. Checking required tasks…");
      setBusy(false); await verifyAll();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to enter raffle"); setBusy(false); }
  };

  const verifyTask = async (task: Task) => {
    if (!user) return requireLogin();
    if (!entry) return setMessage("Enter the raffle first.");
    setBusy(true);
    try {
      const data = await api<{ verified?: boolean; status?: string; result?: { verified: boolean; reason?: string | null }; reason?: string | null }>(`/raffles/${id}/tasks/${task.id}/verify`, { method: "POST" });
      const verifiedNow = data.verified === true || data.status === "VERIFIED" || data.result?.verified === true;
      setResults((current) => ({ ...current, [task.id]: { taskId: task.id, type: task.type, title: task.title, required: task.isRequired, verified: verifiedNow, reason: data.reason ?? data.result?.reason ?? null } }));
      setBusy(false); await verifyAll();
    } catch (error) {
      setResults((current) => ({ ...current, [task.id]: { taskId: task.id, type: task.type, title: task.title, required: task.isRequired, verified: false, reason: error instanceof Error ? error.message : "Verification failed" } }));
      setBusy(false);
    }
  };

  if (loading) return <main className={`min-h-screen ${page}`}><SiteHeader /><div className={`mx-auto max-w-6xl p-10 ${muted}`}>Loading raffle…</div></main>;
  if (!raffle) return <main className={`min-h-screen ${page}`}><SiteHeader /><div className={`mx-auto max-w-2xl px-5 py-20 ${muted}`}>{message || "Raffle not found"}</div></main>;

  return <main className={`min-h-screen ${page}`}>
    <SiteHeader />
    <div className="mx-auto max-w-6xl px-5 py-10">
      <Link href="/raffles" className={`text-xs ${muted} hover:opacity-80`}>← All NFT Raffles</Link>
      <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_360px]">
        <section>
          <div className={`rounded-3xl border p-7 sm:p-9 ${card}`}>
            <div className="flex flex-wrap items-start justify-between gap-5"><div><span className="rounded-full bg-violet-500/10 px-3 py-1 text-[9px] font-black tracking-[.15em] text-violet-500">NFT RAFFLE</span><h1 className="mt-5 text-4xl font-medium tracking-tight">{raffle.title}</h1><p className={`mt-4 max-w-2xl text-sm leading-7 ${muted}`}>{raffle.description || "Complete the verified requirements to enter this NFT whitelist raffle."}</p></div><span className={`rounded-full border px-3 py-1 text-[9px] font-black ${border}`}>{raffle.status}</span></div>
            {raffle.project && <Link href={raffle.project.id ? `/projects/${raffle.project.id}` : "/projects"} className={`mt-7 flex items-center gap-3 rounded-xl border p-3 hover:opacity-80 ${border}`}><div className={`grid h-11 w-11 place-items-center overflow-hidden rounded-lg ${dark ? "bg-black" : "bg-zinc-100"}`}>{raffle.project.logoUrl ? <img src={raffle.project.logoUrl} alt={raffle.project.name ?? ""} className="h-full w-full object-cover" /> : "R"}</div><div><small className={`text-[8px] tracking-[.15em] ${faint}`}>PROJECT</small><b className="mt-1 block text-sm">{raffle.project.name}</b></div><span className={`ml-auto text-xs ${faint}`}>View →</span></Link>}
            <div className="mt-5 grid gap-3 sm:grid-cols-3"><div className={`rounded-xl border p-4 ${softCard}`}><small className={`text-[8px] tracking-[.16em] ${faint}`}>PRIZE</small><b className="mt-2 block text-lg">{raffle.prizeName}</b></div><div className={`rounded-xl border p-4 ${softCard}`}><small className={`text-[8px] tracking-[.16em] ${faint}`}>WINNERS</small><b className="mt-2 block text-lg">{raffle.winnerCount ?? 1}</b></div><div className={`rounded-xl border p-4 ${softCard}`}><small className={`text-[8px] tracking-[.16em] ${faint}`}>ENDS</small><b className="mt-2 block text-sm">{new Date(raffle.endsAt).toLocaleDateString()}</b></div></div>
          </div>

          <div className={`mt-6 rounded-3xl border p-7 ${card}`}>
            <div className="flex flex-wrap items-end justify-between gap-4"><div><span className={`text-[9px] font-black tracking-[.2em] ${faint}`}>ENTRY REQUIREMENTS</span><h2 className="mt-2 text-2xl">Verify your tasks</h2></div><span className={`text-xs ${muted}`}>{verifiedRequired}/{required.length} required</span></div>
            <div className="mt-6 space-y-3">{tasks.length === 0 ? <div className={`rounded-xl border border-dashed p-10 text-center text-sm ${border} ${muted}`}>No tasks configured.</div> : tasks.map((task) => { const result = results[task.id]; const provider = taskProvider(task.type); const providerConnected = connected(provider); return <div key={task.id} className={`rounded-xl border p-4 ${result?.verified ? "border-emerald-500/30 bg-emerald-500/5" : border}`}><div className="flex items-center gap-4"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-lg ${dark ? "bg-white/[.04]" : "bg-zinc-100"}`}>{icon(task.type)}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><b className="text-sm">{task.title}</b><span className={`text-[8px] ${faint}`}>{task.isRequired ? "REQUIRED" : "OPTIONAL"}</span></div><p className={`mt-1 truncate text-xs ${faint}`}>{task.description || taskLabel(task.type)} · {task.target}</p>{result?.reason && !result.verified && <p className="mt-2 text-[10px] text-red-500">{result.reason}</p>}</div>{result?.verified ? <span className="shrink-0 text-xs font-bold text-emerald-500">✓ Verified</span> : providerConnected ? <div className="flex shrink-0 gap-2">{task.targetUrl && <a href={task.targetUrl} target="_blank" rel="noreferrer" className={`rounded-lg border px-3 py-2 text-[10px] ${border}`}>Open</a>}<button disabled={!entry || busy} onClick={() => void verifyTask(task)} className="rounded-lg bg-violet-500 px-3 py-2 text-[10px] font-black text-white disabled:opacity-40">Verify</button></div> : <button disabled={busy} onClick={() => void connectSocial(provider.toLowerCase() as "x" | "discord")} className="shrink-0 rounded-lg border border-violet-500/20 bg-violet-500/10 px-3 py-2 text-[10px] font-bold text-violet-500 disabled:opacity-40">Connect {provider}</button>}</div></div>; })}</div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row"><button disabled={busy || !entry} onClick={() => void verifyAll()} className={`flex-1 rounded-xl border py-3 text-xs font-black disabled:opacity-40 ${border}`}>Verify all</button><button disabled={busy || !canEnter || !!entry} onClick={() => void enter()} className="flex-1 rounded-xl bg-violet-500 py-3 text-xs font-black text-white disabled:opacity-40">{entry ? (allRequiredVerified ? "Eligible ✓" : "Entry pending") : raffle.status === "SCHEDULED" ? `Starts in ${countdown(raffle.startsAt)}` : raffle.status === "ACTIVE" ? "Enter raffle" : "Entries closed"}</button></div>
            {message && <div className={`mt-4 rounded-xl border p-3 text-xs ${border} ${muted}`}>{message}</div>}
          </div>

          {entry && <div className={`mt-6 rounded-3xl border p-7 ${card}`}><span className={`text-[9px] font-black tracking-[.2em] ${faint}`}>YOUR ENTRY</span><h2 className="mt-2 text-2xl">Entry Details</h2><div className="mt-5 space-y-3"><div className={`rounded-xl border p-4 ${softCard}`}><div className="flex items-center justify-between"><span className={`text-xs ${faint}`}>Status</span><span className={`rounded-full px-3 py-1 text-[9px] font-black ${entry.status === "ELIGIBLE" ? "bg-emerald-500/10 text-emerald-500" : entry.status === "PENDING" ? "bg-amber-500/10 text-amber-500" : "bg-zinc-500/10 text-zinc-500"}`}>{entry.status}</span></div></div><div className={`rounded-xl border p-4 ${softCard}`}><span className={`text-xs ${faint}`}>Wallet Address</span><p className={`mt-2 break-all font-mono text-[10px] ${muted}`}>{entry.walletAddressSnapshot}</p><p className={`mt-1 text-[9px] ${faint}`}>{entry.walletAddress.chain} · {entry.walletAddress.network}</p></div><div className={`rounded-xl border p-4 ${softCard}`}><div className="flex items-center justify-between"><span className={`text-xs ${faint}`}>Entered At</span><span className={`text-[10px] ${muted}`}>{new Date(entry.enteredAt).toLocaleString()}</span></div></div></div></div>}
        </section>

        <aside className="space-y-4">
          <div className={`rounded-2xl border p-6 ${card}`}><span className={`text-[9px] font-black tracking-[.18em] ${faint}`}>RAVEN ACCOUNT</span>{user ? <div className="mt-4"><b className="text-sm">{user.displayName || user.username || "Raven member"}</b><p className={`mt-1 text-xs ${muted}`}>{user.email}</p><p className="mt-2 text-[10px] text-emerald-500">✓ Signed in</p></div> : <button onClick={requireLogin} className="mt-4 w-full rounded-xl bg-violet-500 py-3 text-xs font-black text-white">Sign in with Gmail</button>}</div>
          {(["X", "DISCORD"] as const).map((provider) => <div key={provider} className={`rounded-2xl border p-6 ${card}`}><span className={`text-[9px] font-black tracking-[.18em] ${faint}`}>{provider}</span>{connected(provider) ? <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-emerald-500">✓ {provider === "X" ? "X" : "Discord"} connected{socials.find((social) => social.provider === provider)?.providerUsername ? ` · @${socials.find((social) => social.provider === provider)?.providerUsername}` : ""}</div> : <button disabled={!user || busy} onClick={() => void connectSocial(provider.toLowerCase() as "x" | "discord")} className="mt-4 w-full rounded-xl border border-violet-500/20 bg-violet-500/10 py-3 text-xs font-bold text-violet-500 disabled:opacity-40">{user ? `Connect ${provider}` : "Sign in first"}</button>}</div>)}
          <div className={`rounded-2xl border p-6 ${card}`}><div className="flex items-center justify-between"><span className={`text-[9px] font-black tracking-[.18em] ${faint}`}>WHITELIST WALLET</span>{user && <button onClick={() => setWalletModal(true)} className="text-[10px] font-bold text-violet-500">+ Add</button>}</div>{wallets.length === 0 ? <p className={`mt-4 text-xs leading-5 ${muted}`}>Add the wallet address the NFT project should whitelist.</p> : <div className="mt-4 space-y-2">{wallets.map((wallet) => <button key={wallet.id} onClick={() => setWalletId(wallet.id)} className={`w-full rounded-xl border p-3 text-left ${walletId === wallet.id ? "border-violet-500/40 bg-violet-500/5" : border}`}><b className="block text-[10px]">{wallet.chain}</b><span className={`mt-1 block truncate font-mono text-[10px] ${muted}`}>{wallet.address}</span></button>)}</div>}</div>
        </aside>
      </div>
    </div>

    {walletModal && <div className="fixed inset-0 z-[100] grid place-items-center bg-black/70 p-5"><div className={`w-full max-w-md rounded-3xl border p-7 ${card}`}><span className="text-[9px] font-black tracking-[.2em] text-violet-500">WHITELIST ADDRESS</span><h2 className="mt-3 text-2xl">Add wallet</h2><input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="0x… or Solana address" className={`mt-5 w-full rounded-xl border px-4 py-3 font-mono text-sm outline-none ${border} ${dark ? "bg-black/20" : "bg-zinc-50"}`} /><select value={chain} onChange={(event) => setChain(event.target.value as "EVM" | "SOLANA")} className={`mt-3 w-full rounded-xl border px-4 py-3 text-sm outline-none ${border} ${dark ? "bg-black/20" : "bg-zinc-50"}`}><option value="EVM">EVM</option><option value="SOLANA">Solana</option></select><div className="mt-4 flex gap-2"><button onClick={() => setWalletModal(false)} className={`flex-1 rounded-xl border py-3 text-xs ${border}`}>Cancel</button><button disabled={busy} onClick={() => void addWallet()} className="flex-1 rounded-xl bg-violet-500 py-3 text-xs font-black text-white disabled:opacity-40">Save wallet</button></div></div></div>}
  </main>;
}
