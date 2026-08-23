"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import SiteHeader from "../../../components/SiteHeader";
import RaffleCaptchaGate from "../../../components/RaffleCaptchaGate";
import { API_BASE_URL } from "@/lib/api-config";


type User = { id: string; displayName?: string | null; username?: string | null };
type Social = { id?: string; provider: "X" | "DISCORD"; providerUsername?: string | null; displayName?: string | null; isActive?: boolean };
type Wallet = { id: string; address: string; chain: "EVM" | "SOLANA"; network: string; status?: string };
type Project = { id?: string; name?: string | null; logoUrl?: string | null; bannerUrl?: string | null; websiteUrl?: string | null; xUrl?: string | null; discordUrl?: string | null };
type Raffle = { id: string; title: string; description?: string | null; prizeName: string; prizeDescription?: string | null; prizeQuantity: number; startsAt: string; endsAt: string; status: string; winnerCount?: number; entryRules?: unknown; project?: Project | null };
type Task = { id: string; type: "DISCORD_JOIN" | "X_FOLLOW" | "X_LIKE" | "X_REPOST"; title: string; description?: string | null; target: string; targetUrl?: string | null; isRequired: boolean };
type TaskResult = { taskId: string; type: Task["type"]; title: string; required: boolean; verified: boolean; reason?: string | null };
type Entry = { id: string; status: string; walletAddressSnapshot?: string | null; captchaPassed?: boolean | null; enteredAt: string; walletAddress?: { id?: string; chain: string; network: string; address?: string } | null };

async function api<T>(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers, credentials: "include", cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message ?? `Request failed (${response.status})`);
  return data as T;
}

function isCaptchaRequired(value: unknown) {
  return !!value && typeof value === "object" && !Array.isArray(value) && (value as Record<string, unknown>).captchaRequired === true;
}
function shortAddress(value?: string | null) {
  if (!value) return "No wallet selected";
  return value.length > 14 ? `${value.slice(0, 6)}…${value.slice(-6)}` : value;
}
function timeLeft(value: string) {
  const ms = new Date(value).getTime() - Date.now();
  if (ms <= 0) return "Ended";
  const minutes = Math.floor(ms / 60000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  return days ? `${days}d ${hours}h` : `${hours}h ${minutes % 60}m`;
}
function taskIcon(type: Task["type"]) {
  if (type === "DISCORD_JOIN") return "◈";
  if (type === "X_FOLLOW") return "𝕏";
  if (type === "X_LIKE") return "♡";
  return "↻";
}
function taskProvider(type: Task["type"]) { return type === "DISCORD_JOIN" ? "DISCORD" : "X"; }

export default function RaffleEntryPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [raffle, setRaffle] = useState<Raffle | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [results, setResults] = useState<Record<string, TaskResult>>({});
  const [entry, setEntry] = useState<Entry | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [socials, setSocials] = useState<Social[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [walletId, setWalletId] = useState("");
  const [address, setAddress] = useState("");
  const [chain, setChain] = useState<"EVM" | "SOLANA">("EVM");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const loadAccount = useCallback(async () => {
    try {
      const me = await api<{ user: User }>("/auth/me");
      setUser(me.user);
      const [socialData, walletData] = await Promise.all([
        api<{ accounts: Social[] }>("/social-accounts/"),
        api<{ wallets: Wallet[] }>("/wallets/"),
      ]);
      setSocials(socialData.accounts ?? []);
      const active = (walletData.wallets ?? []).filter((w) => w.status !== "ARCHIVED");
      setWallets(active);
      setWalletId((current) => current || active[0]?.id || "");
    } catch {
      setUser(null);
      setSocials([]);
      setWallets([]);
      setWalletId("");
    }
  }, []);

  const loadPage = useCallback(async () => {
    if (!id) return;
    try {
      const [raffleData, taskData] = await Promise.all([
        api<{ raffle: Raffle }>(`/raffles/${id}`),
        api<{ tasks: Task[] }>(`/raffles/${id}/tasks`),
      ]);
      setRaffle(raffleData.raffle);
      setTasks(taskData.tasks ?? []);
      try {
        const entryData = await api<{ entry: Entry }>(`/raffles/${id}/entries/me`);
        setEntry(entryData.entry);
      } catch {
        setEntry(null);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load raffle");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void Promise.all([loadAccount(), loadPage()]); }, [loadAccount, loadPage]);

  const requiredTasks = useMemo(() => tasks.filter((task) => task.isRequired), [tasks]);
  const verifiedCount = requiredTasks.filter((task) => results[task.id]?.verified).length;
  const allTasksVerified = requiredTasks.length === 0 || verifiedCount === requiredTasks.length;
  const connected = (provider: "X" | "DISCORD") => socials.some((s) => s.provider === provider && s.isActive !== false);
  const captchaRequired = isCaptchaRequired(raffle?.entryRules);
  const activeWindow = raffle?.status === "ACTIVE" && Date.now() >= new Date(raffle.startsAt).getTime() && Date.now() <= new Date(raffle.endsAt).getTime();
  const walletRequired = !!raffle?.entryRules && typeof raffle.entryRules === "object" && !Array.isArray(raffle.entryRules) && (raffle.entryRules as Record<string, unknown>).walletRequired !== false;
  const readyToSubmit = !!entry && allTasksVerified && (!walletRequired || !!walletId || !!address.trim());
  const confirmed = entry?.status === "ELIGIBLE" && Boolean(entry.walletAddressSnapshot);

  const requireLogin = () => router.push(`/login?next=${encodeURIComponent(`/raffles/${id}`)}`);

  const connectSocial = async (provider: "x" | "discord") => {
    if (!user) return requireLogin();
    try {
      const returnTo = `/raffle-entry/${id}`;
      const data = await api<{ authorizationUrl: string }>(`/auth/${provider}/start?returnTo=${encodeURIComponent(returnTo)}`);
      window.location.href = data.authorizationUrl;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `Unable to connect ${provider}`);
    }
  };

  const startEntry = async () => {
    if (!user) return requireLogin();
    if (!activeWindow) {
      setMessage(raffle?.status === "SCHEDULED" ? `Raffle starts in ${timeLeft(raffle.startsAt)}.` : "This raffle is not accepting entries.");
      return;
    }
    if (entry) return;
    setBusy(true);
    try {
      const data = await api<{ entry: Entry }>(`/raffles/${id}/entries`, { method: "POST", body: JSON.stringify({}) });
      setEntry(data.entry);
      setMessage("Entry started. Complete every required task below.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to start raffle entry");
    } finally {
      setBusy(false);
    }
  };

  const verifyAll = async () => {
    if (!user) return requireLogin();
    if (!entry) return setMessage("Click Enter Raffle first.");
    setBusy(true);
    try {
      const data = await api<{ allRequiredTasksVerified: boolean; tasks: TaskResult[]; entry: Entry }>(`/raffles/${id}/entries/me/verify-tasks`, { method: "POST" });
      const next: Record<string, TaskResult> = {};
      for (const result of data.tasks ?? []) next[result.taskId] = result;
      setResults(next);
      setEntry(data.entry);
      setMessage(data.allRequiredTasksVerified ? "All required tasks verified." : "Some required tasks still need to be completed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Verification failed");
    } finally {
      setBusy(false);
    }
  };

  const verifyTask = async (task: Task) => {
    if (!user) return requireLogin();
    if (!entry) return setMessage("Click Enter Raffle first.");
    if (!connected(taskProvider(task.type))) {
      return connectSocial(taskProvider(task.type) === "X" ? "x" : "discord");
    }
    if (task.targetUrl) window.open(task.targetUrl, "_blank", "noopener,noreferrer");
    setBusy(true);
    try {
      const data = await api<{ verified?: boolean; result?: { verified: boolean; reason?: string | null }; reason?: string | null }>(`/raffles/${id}/tasks/${task.id}/verify`, { method: "POST" });
      const verified = data.verified === true || data.result?.verified === true;
      setResults((current) => ({ ...current, [task.id]: { taskId: task.id, type: task.type, title: task.title, required: task.isRequired, verified, reason: data.reason ?? data.result?.reason ?? null } }));
      setMessage(verified ? `${task.title} verified.` : (data.reason ?? data.result?.reason ?? "Task is not verified yet."));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Task verification failed");
    } finally {
      setBusy(false);
    }
  };

  const attachWallet = async (selectedWalletId: string) => {
    if (!user) return requireLogin();
    if (!entry) return setMessage("Enter the raffle first.");
    if (!allTasksVerified) return setMessage("Complete all required tasks first.");
    if (captchaRequired && entry.captchaPassed !== true) return setMessage("Complete the CAPTCHA before submitting your wallet.");
    setBusy(true);
    try {
      const data = await api<{ entry: Entry }>(`/raffles/${id}/entries/me/wallet`, { method: "PATCH", body: JSON.stringify({ walletAddressId: selectedWalletId }) });
      setWalletId(selectedWalletId);
      setEntry(data.entry);
      setMessage("Wallet attached. Running final eligibility checks…");
      await verifyAll();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to attach wallet");
    } finally {
      setBusy(false);
    }
  };

  const addWallet = async () => {
    if (!user) return requireLogin();
    if (!address.trim()) return setMessage("Paste your wallet address first.");
    if (!entry) return setMessage("Enter the raffle first.");
    if (!allTasksVerified) return setMessage("Complete all required tasks first.");
    if (captchaRequired && entry.captchaPassed !== true) return setMessage("Complete the CAPTCHA before submitting your wallet.");
    setBusy(true);
    try {
      const created = await api<{ wallet: Wallet }>("/wallets/", { method: "POST", body: JSON.stringify({ address: address.trim(), chain }) });
      setWallets((current) => [created.wallet, ...current]);
      setAddress("");
      await attachWallet(created.wallet.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to add wallet");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <main className="min-h-screen bg-[#07070a] text-white"><SiteHeader /><div className="mx-auto max-w-6xl px-5 py-16 text-sm text-zinc-500">Loading raffle…</div></main>;
  if (!raffle) return <main className="min-h-screen bg-[#07070a] text-white"><SiteHeader /><div className="mx-auto max-w-2xl px-5 py-20 text-sm text-zinc-400">{message || "Raffle not found"}</div></main>;

  const statusText = confirmed ? "ENTRY CONFIRMED" : entry ? `${verifiedCount}/${requiredTasks.length || 0} TASKS VERIFIED` : "READY TO ENTER";

  return (
    <main className="min-h-screen bg-[#07070a] text-zinc-100">
      <SiteHeader />
      <RaffleCaptchaGate raffleId={id}>
        <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
          <Link href="/raffles" className="text-xs font-medium text-zinc-500 transition hover:text-violet-400">← All Raffles</Link>

          <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_390px]">
            <section className="space-y-6">
              <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#0d0c12] shadow-2xl shadow-black/20">
                <div className="grid min-h-[300px] lg:grid-cols-[1fr_1.05fr]">
                  <div className="relative flex flex-col justify-between p-7 sm:p-9">
                    <div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-[9px] font-black tracking-[.2em] text-violet-300">NFT RAFFLE</span>
                        <span className={`rounded-full border px-3 py-1 text-[9px] font-black tracking-[.12em] ${raffle.status === "ACTIVE" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-white/10 text-zinc-400"}`}>{raffle.status}</span>
                      </div>
                      <h1 className="mt-9 text-3xl font-semibold tracking-tight sm:text-5xl">{raffle.title}</h1>
                      <p className="mt-4 max-w-xl text-sm leading-7 text-zinc-500">{raffle.description || raffle.prizeDescription || "Complete the required community tasks to enter this raffle."}</p>
                    </div>
                    {raffle.project && (
                      <Link href={raffle.project.id ? `/projects/${raffle.project.id}` : "#"} className="mt-8 inline-flex w-fit items-center gap-3 rounded-2xl border border-white/10 bg-white/[.03] px-3 py-2.5 hover:bg-white/[.06]">
                        <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-xl bg-black">
                          {raffle.project.logoUrl ? <img src={raffle.project.logoUrl} alt="" className="h-full w-full object-cover" /> : <span className="font-bold text-violet-300">R</span>}
                        </div>
                        <div><div className="text-[8px] uppercase tracking-[.18em] text-zinc-600">Created by</div><div className="text-xs font-semibold text-zinc-200">{raffle.project.name || "Project"}</div></div>
                      </Link>
                    )}
                  </div>
                  <div className="relative min-h-[260px] overflow-hidden bg-[radial-gradient(circle_at_50%_25%,rgba(139,92,246,.35),transparent_50%),linear-gradient(135deg,#17121f,#09090d)]">
                    {raffle.project?.bannerUrl ? <img src={raffle.project.bannerUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-90" /> : <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_25%,rgba(217,70,239,.28),transparent_35%),radial-gradient(circle_at_30%_80%,rgba(59,130,246,.22),transparent_45%)]" />}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#08080c] via-transparent to-black/10" />
                    <div className="absolute bottom-6 left-6 right-6 rounded-2xl border border-white/10 bg-black/35 p-4 backdrop-blur-xl">
                      <div className="text-[8px] font-black uppercase tracking-[.2em] text-zinc-500">Prize</div>
                      <div className="mt-1 text-lg font-semibold text-white">{raffle.prizeName}</div>
                      <div className="mt-1 text-xs text-zinc-400">{raffle.prizeQuantity} winner prize{raffle.prizeQuantity === 1 ? "" : "s"}</div>
                    </div>
                  </div>
                </div>

                <div className="grid border-t border-white/10 sm:grid-cols-3">
                  <div className="border-b border-white/10 p-5 sm:border-b-0 sm:border-r"><div className="text-[8px] font-black uppercase tracking-[.18em] text-zinc-600">Ends</div><div className="mt-2 text-sm font-semibold">{new Date(raffle.endsAt).toLocaleDateString()}</div><div className="mt-1 text-xs text-zinc-500">{timeLeft(raffle.endsAt)}</div></div>
                  <div className="border-b border-white/10 p-5 sm:border-b-0 sm:border-r"><div className="text-[8px] font-black uppercase tracking-[.18em] text-zinc-600">Winners</div><div className="mt-2 text-sm font-semibold">{raffle.winnerCount ?? 1}</div><div className="mt-1 text-xs text-zinc-500">selected after closing</div></div>
                  <div className="p-5"><div className="text-[8px] font-black uppercase tracking-[.18em] text-zinc-600">Entry status</div><div className={`mt-2 text-sm font-semibold ${confirmed ? "text-emerald-300" : "text-zinc-200"}`}>{statusText}</div><div className="mt-1 text-xs text-zinc-500">{entry ? "Your entry is saved" : "Not entered yet"}</div></div>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-[#0d0c12] p-6 sm:p-8">
                <div className="flex items-end justify-between gap-4"><div><div className="text-[9px] font-black uppercase tracking-[.2em] text-violet-400">Giveaway information</div><h2 className="mt-2 text-xl font-semibold">About this raffle</h2></div>{raffle.project?.websiteUrl && <a href={raffle.project.websiteUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold text-violet-300 hover:text-violet-200">Website ↗</a>}</div>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-white/[.025] p-4"><div className="text-[8px] uppercase tracking-[.18em] text-zinc-600">Type</div><div className="mt-2 text-sm font-medium">Raffle</div></div>
                  <div className="rounded-2xl border border-white/10 bg-white/[.025] p-4"><div className="text-[8px] uppercase tracking-[.18em] text-zinc-600">Prize</div><div className="mt-2 text-sm font-medium">{raffle.prizeName}</div></div>
                  <div className="rounded-2xl border border-white/10 bg-white/[.025] p-4"><div className="text-[8px] uppercase tracking-[.18em] text-zinc-600">Start</div><div className="mt-2 text-sm font-medium">{new Date(raffle.startsAt).toLocaleString()}</div></div>
                  <div className="rounded-2xl border border-white/10 bg-white/[.025] p-4"><div className="text-[8px] uppercase tracking-[.18em] text-zinc-600">End</div><div className="mt-2 text-sm font-medium">{new Date(raffle.endsAt).toLocaleString()}</div></div>
                </div>
                {raffle.prizeDescription && <p className="mt-6 border-t border-white/10 pt-6 text-sm leading-7 text-zinc-500">{raffle.prizeDescription}</p>}
              </div>
            </section>

            <aside className="lg:sticky lg:top-24 lg:self-start">
              <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#0d0c12] shadow-2xl shadow-black/20">
                <div className="border-b border-white/10 p-6">
                  <div className="flex items-center justify-between"><div><div className="text-[9px] font-black uppercase tracking-[.2em] text-violet-400">01 · Entry requirements</div><h2 className="mt-2 text-xl font-semibold">Secure your spot</h2></div><div className="rounded-full bg-white/[.04] px-2.5 py-1 text-[10px] font-semibold text-zinc-400">{verifiedCount}/{requiredTasks.length || 0}</div></div>
                  <p className="mt-3 text-xs leading-5 text-zinc-500">Complete every required task, then submit the wallet where your prize should be sent.</p>
                </div>

                <div className="p-5">
                  {!entry && (
                    <button onClick={startEntry} disabled={busy || !activeWindow} className="w-full rounded-2xl bg-violet-600 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-violet-900/20 transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Starting…" : activeWindow ? "Enter Raffle" : raffle.status === "SCHEDULED" ? `Starts in ${timeLeft(raffle.startsAt)}` : "Entry closed"}</button>
                  )}

                  {entry && <div className="mb-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/[.06] p-4"><div className="flex items-center gap-3"><div className="grid h-8 w-8 place-items-center rounded-full bg-emerald-500/15 text-emerald-300">✓</div><div><div className="text-xs font-semibold text-emerald-200">Entry started</div><div className="text-[10px] text-emerald-400/70">Your entry is saved. Finish the checks below.</div></div></div></div>}

                  <div className="space-y-3">
                    {tasks.map((task) => {
                      const result = results[task.id];
                      const verified = result?.verified === true;
                      const isConnected = connected(taskProvider(task.type));
                      return (
                        <div key={task.id} className={`rounded-2xl border p-4 transition ${verified ? "border-emerald-500/20 bg-emerald-500/[.04]" : "border-white/10 bg-white/[.02]"}`}>
                          <div className="flex items-start gap-3">
                            <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sm font-bold ${verified ? "bg-emerald-500/15 text-emerald-300" : "bg-white/[.06] text-zinc-300"}`}>{verified ? "✓" : taskIcon(task.type)}</div>
                            <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><div className="text-sm font-semibold text-zinc-100">{task.title}</div>{task.isRequired && <span className="text-[8px] font-black uppercase tracking-[.12em] text-violet-400">Required</span>}</div><div className="mt-1 text-[11px] leading-5 text-zinc-500">{task.description || `Complete this ${taskProvider(task.type)} requirement.`}</div></div>
                          </div>
                          {entry && !verified && <div className="mt-3 flex items-center justify-between gap-3"><span className={`text-[10px] ${isConnected ? "text-emerald-400" : "text-amber-400"}`}>{isConnected ? `✓ ${taskProvider(task.type)} connected` : `${taskProvider(task.type)} not connected`}</span><button onClick={() => verifyTask(task)} disabled={busy} className="rounded-xl border border-white/10 bg-white/[.04] px-3 py-2 text-[10px] font-bold text-zinc-200 hover:bg-white/[.08] disabled:opacity-50">{isConnected ? "Open & verify" : "Connect"}</button></div>}
                          {result?.reason && !verified && <div className="mt-3 rounded-xl border border-amber-500/15 bg-amber-500/[.04] px-3 py-2 text-[10px] leading-4 text-amber-300/80">{result.reason}</div>}
                        </div>
                      );
                    })}
                    {tasks.length === 0 && <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[.04] p-4 text-xs text-amber-300">This raffle has no tasks configured yet.</div>}
                  </div>

                  {entry && requiredTasks.length > 0 && <button onClick={verifyAll} disabled={busy} className="mt-4 w-full rounded-xl border border-white/10 bg-white/[.03] px-4 py-3 text-xs font-semibold text-zinc-300 hover:bg-white/[.06] disabled:opacity-50">{busy ? "Checking…" : "Refresh verification"}</button>}
                </div>

                {entry && walletRequired && (
                  <div className="border-t border-white/10 p-5">
                    <div className="text-[9px] font-black uppercase tracking-[.2em] text-violet-400">02 · Final entry</div>
                    <h3 className="mt-2 text-lg font-semibold">Choose your payout wallet</h3>
                    <p className="mt-2 text-xs leading-5 text-zinc-500">Use an existing wallet or paste a new address. The wallet is locked to this raffle entry.</p>

                    {wallets.length > 0 && <div className="mt-4"><label className="mb-2 block text-[10px] font-semibold text-zinc-500">Connected wallets</label><select value={walletId} onChange={(e) => setWalletId(e.target.value)} disabled={busy || !allTasksVerified} className="w-full rounded-xl border border-white/10 bg-[#09090d] px-3 py-3 text-xs text-zinc-200 outline-none focus:border-violet-500/50"><option value="">Select wallet</option>{wallets.map((wallet) => <option key={wallet.id} value={wallet.id}>{shortAddress(wallet.address)} · {wallet.network}</option>)}</select></div>}

                    {walletId && <button onClick={() => attachWallet(walletId)} disabled={busy || !allTasksVerified || (captchaRequired && entry.captchaPassed !== true)} className="mt-3 w-full rounded-xl bg-violet-600 px-4 py-3 text-xs font-bold text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40">{busy ? "Submitting…" : "Use selected wallet"}</button>}

                    <div className="my-4 flex items-center gap-3 text-[9px] uppercase tracking-[.15em] text-zinc-700"><span className="h-px flex-1 bg-white/10" />or paste a wallet<span className="h-px flex-1 bg-white/10" /></div>
                    <div className="grid grid-cols-[110px_1fr] gap-2"><select value={chain} onChange={(e) => setChain(e.target.value as "EVM" | "SOLANA")} disabled={busy || !allTasksVerified} className="rounded-xl border border-white/10 bg-[#09090d] px-3 py-3 text-xs text-zinc-300 outline-none"><option value="EVM">EVM</option><option value="SOLANA">Solana</option></select><input value={address} onChange={(e) => setAddress(e.target.value)} disabled={busy || !allTasksVerified} placeholder="0x… or Solana address" className="min-w-0 rounded-xl border border-white/10 bg-[#09090d] px-3 py-3 text-xs text-zinc-200 outline-none placeholder:text-zinc-700 focus:border-violet-500/50" /></div>
                    <button onClick={addWallet} disabled={busy || !allTasksVerified || !address.trim() || (captchaRequired && entry.captchaPassed !== true)} className="mt-3 w-full rounded-xl border border-violet-500/30 bg-violet-500/10 px-4 py-3 text-xs font-bold text-violet-200 hover:bg-violet-500/15 disabled:cursor-not-allowed disabled:opacity-40">Add wallet & submit entry</button>

                    {confirmed && <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/[.06] p-4"><div className="flex gap-3"><div className="text-emerald-300">✓</div><div><div className="text-xs font-semibold text-emerald-200">Entry confirmed</div><div className="mt-1 text-[10px] leading-4 text-emerald-400/70">Your tasks and payout wallet passed the current eligibility checks.</div></div></div></div>}
                    {message && <div className="mt-4 rounded-xl border border-white/10 bg-white/[.03] px-3 py-2 text-[10px] leading-4 text-zinc-400">{message}</div>}
                  </div>
                )}

                {!entry && message && <div className="border-t border-white/10 p-5"><div className="rounded-xl border border-white/10 bg-white/[.03] px-3 py-2 text-[10px] leading-4 text-zinc-400">{message}</div></div>}
              </div>
            </aside>
          </div>
        </div>
      </RaffleCaptchaGate>
    </main>
  );
}
