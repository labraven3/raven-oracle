"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import SiteHeader from "../../../components/SiteHeader";
import RaffleCaptchaGate from "../../../components/RaffleCaptchaGate";
import { API_BASE_URL } from "@/lib/api-config";

type User = { id: string; displayName?: string | null; username?: string | null };
type Social = { id?: string; provider: "X" | "DISCORD"; providerUsername?: string | null; isActive?: boolean };
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
function isHttpUrl(value?: string | null) {
  return !!value && /^https?:\/\//i.test(value);
}
function taskProvider(type: Task["type"]) { return type === "DISCORD_JOIN" ? "DISCORD" : "X"; }
function taskIcon(type: Task["type"]) { return type === "DISCORD_JOIN" ? "◈" : type === "X_FOLLOW" ? "𝕏" : type === "X_LIKE" ? "♡" : "↻"; }
function shortAddress(value?: string | null) { return !value ? "No wallet selected" : value.length > 14 ? `${value.slice(0, 6)}…${value.slice(-6)}` : value; }
function timeLeft(value: string) { const ms = new Date(value).getTime() - Date.now(); if (ms <= 0) return "Ended"; const minutes = Math.floor(ms / 60000); const days = Math.floor(minutes / 1440); const hours = Math.floor((minutes % 1440) / 60); return days ? `${days}d ${hours}h` : `${hours}h ${minutes % 60}m`; }
function rules(value: unknown) { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }

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
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const [checkingTaskId, setCheckingTaskId] = useState<string | null>(null);
  const pendingRef = useRef<string | null>(null);

  const loadAccount = useCallback(async () => {
    try {
      const me = await api<{ user: User }>("/auth/me");
      setUser(me.user);
      const [socialData, walletData] = await Promise.all([
        api<{ accounts: Social[] }>("/social-accounts/"),
        api<{ wallets: Wallet[] }>("/wallets/"),
      ]);
      setSocials(socialData.accounts ?? []);
      const active = (walletData.wallets ?? []).filter((w) => w.status !== "ARCHIVED" && w.status !== "DELETED");
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

  useEffect(() => {
    pendingRef.current = pendingTaskId;
  }, [pendingTaskId]);

  useEffect(() => {
    const saved = sessionStorage.getItem("raven_pending_task");
    if (saved) setPendingTaskId(saved);
  }, []);

  const requireLogin = () => router.push(`/login?next=${encodeURIComponent(`/raffles/${id}`)}`);

  const connected = useCallback((provider: "X" | "DISCORD") => socials.some((s) => s.provider === provider && s.isActive !== false), [socials]);

  const requiredTasks = useMemo(() => tasks.filter((task) => task.isRequired), [tasks]);
  const verifiedCount = requiredTasks.filter((task) => results[task.id]?.verified).length;
  const allTasksVerified = requiredTasks.length === 0 || verifiedCount === requiredTasks.length;
  const captchaRequired = isCaptchaRequired(raffle?.entryRules);
  const raffleRules = rules(raffle?.entryRules);
  const activeWindow = raffle?.status === "ACTIVE" && Date.now() >= new Date(raffle.startsAt).getTime() && Date.now() <= new Date(raffle.endsAt).getTime();
  const walletRequired = raffleRules.walletRequired !== false;
  const confirmed = entry?.status === "ELIGIBLE" && Boolean(entry.walletAddressSnapshot);

  const taskLink = useCallback((task: Task) => {
    const raw = task.targetUrl || (task.type === "X_FOLLOW" ? raffle?.project?.xUrl : task.type === "DISCORD_JOIN" ? raffle?.project?.discordUrl : task.target) || task.target || "";
    if (isHttpUrl(raw)) return raw;
    if (task.type === "X_FOLLOW" && /^[A-Za-z0-9_]{1,15}$/.test(raw.replace(/^@/, ""))) return `https://x.com/${raw.replace(/^@/, "")}`;
    return null;
  }, [raffle]);

  const applyResults = useCallback((items: TaskResult[]) => {
    const next: Record<string, TaskResult> = {};
    for (const item of items) next[item.taskId] = item;
    setResults(next);
  }, []);

  const verifyTask = useCallback(async (task: Task, silent = false) => {
    if (!user) return requireLogin();
    if (!entry) return setMessage("Click Enter Raffle first.");
    setCheckingTaskId(task.id);
    try {
      const data = await api<{ verified?: boolean; reason?: string | null }>(`/raffles/${id}/tasks/${task.id}/verify`, { method: "POST" });
      const verified = data.verified === true;
      setResults((current) => ({ ...current, [task.id]: { taskId: task.id, type: task.type, title: task.title, required: task.isRequired, verified, reason: data.reason ?? null } }));
      if (!silent) setMessage(verified ? `${task.title} verified automatically.` : (data.reason || "Task is not verified yet."));
      return verified;
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Task verification failed";
      setResults((current) => ({ ...current, [task.id]: { taskId: task.id, type: task.type, title: task.title, required: task.isRequired, verified: false, reason } }));
      if (!silent) setMessage(reason);
      return false;
    } finally {
      setCheckingTaskId(null);
    }
  }, [entry, id, requireLogin, user]);

  const verifyAll = useCallback(async (silent = false) => {
    if (!user || !entry) return false;
    try {
      const data = await api<{ allRequiredTasksVerified: boolean; tasks: TaskResult[]; entry: Entry }>(`/raffles/${id}/entries/me/verify-tasks`, { method: "POST" });
      applyResults(data.tasks ?? []);
      setEntry(data.entry);
      if (!silent) setMessage(data.allRequiredTasksVerified ? "All required tasks verified." : "Some required tasks still need to be completed.");
      return data.allRequiredTasksVerified;
    } catch (error) {
      if (!silent) setMessage(error instanceof Error ? error.message : "Verification failed");
      return false;
    }
  }, [applyResults, entry, id, user]);

  useEffect(() => {
    void Promise.all([loadAccount(), loadPage()]);
  }, [loadAccount, loadPage]);

  useEffect(() => {
    if (!entry || !user) return;
    const restoreTaskId = sessionStorage.getItem("raven_pending_task");
    if (!restoreTaskId) return;
    const timer = window.setTimeout(async () => {
      const task = tasks.find((item) => item.id === restoreTaskId);
      if (task) await verifyTask(task, true);
      sessionStorage.removeItem("raven_pending_task");
      setPendingTaskId(null);
      await verifyAll(true);
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [entry, tasks, user, verifyAll, verifyTask]);

  useEffect(() => {
    if (!entry || !user) return;
    const onReturn = () => {
      const taskId = pendingRef.current;
      if (!taskId) return;
      const task = tasks.find((item) => item.id === taskId);
      if (!task) return;
      window.setTimeout(async () => {
        setMessage(`Checking ${task.title}…`);
        await verifyTask(task, false);
        await verifyAll(true);
        sessionStorage.removeItem("raven_pending_task");
        setPendingTaskId(null);
      }, 700);
    };
    window.addEventListener("focus", onReturn);
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") onReturn(); });
    return () => window.removeEventListener("focus", onReturn);
  }, [entry, tasks, user, verifyAll, verifyTask]);

  const connectSocial = async (provider: "x" | "discord", task?: Task) => {
    if (!user) return requireLogin();
    if (task) {
      sessionStorage.setItem("raven_pending_task", task.id);
      setPendingTaskId(task.id);
    }
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
    if (!activeWindow) return setMessage(raffle?.status === "SCHEDULED" ? `Raffle starts in ${timeLeft(raffle.startsAt)}.` : "This raffle is not accepting entries.");
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

  const openTask = async (task: Task) => {
    if (!user) return requireLogin();
    if (!entry) return setMessage("Click Enter Raffle first.");
    if (!connected(taskProvider(task.type))) return connectSocial(taskProvider(task.type) === "X" ? "x" : "discord", task);
    const url = taskLink(task);
    sessionStorage.setItem("raven_pending_task", task.id);
    setPendingTaskId(task.id);
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
      setMessage(`Complete ${task.title}, then come back here. We will verify it automatically.`);
    } else {
      setMessage("This task has no external link configured. Use Verify now after completing it.");
    }
  };

  const attachWallet = async (selectedWalletId: string) => {
    if (!user) return requireLogin();
    if (!entry) return setMessage("Enter the raffle first.");
    if (!allTasksVerified) return setMessage("Complete all required tasks first.");
    if (captchaRequired && entry.captchaPassed !== true) return setMessage("Complete the CAPTCHA before submitting the wallet.");
    setBusy(true);
    try {
      const data = await api<{ entry: Entry }>(`/raffles/${id}/entries/me/wallet`, { method: "PATCH", body: JSON.stringify({ walletAddressId: selectedWalletId }) });
      setWalletId(selectedWalletId);
      setEntry(data.entry);
      setMessage("Wallet attached. Running final eligibility checks…");
      await verifyAll();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to attach wallet"); }
    finally { setBusy(false); }
  };

  const addWallet = async () => {
    if (!user) return requireLogin();
    if (!address.trim()) return setMessage("Paste your wallet address first.");
    if (!entry) return setMessage("Enter the raffle first.");
    if (!allTasksVerified) return setMessage("Complete all required tasks first.");
    if (captchaRequired && entry.captchaPassed !== true) return setMessage("Complete the CAPTCHA before submitting the wallet.");
    setBusy(true);
    try {
      const created = await api<{ wallet: Wallet }>("/wallets/", { method: "POST", body: JSON.stringify({ address: address.trim(), chain }) });
      setWallets((current) => [created.wallet, ...current]);
      setAddress("");
      await attachWallet(created.wallet.id);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to add wallet"); }
    finally { setBusy(false); }
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
                      <div className="flex items-center justify-between gap-3"><span className="rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-[9px] font-black tracking-[.2em] text-violet-300">NFT RAFFLE</span><span className={`rounded-full border px-3 py-1 text-[9px] font-black ${raffle.status === "ACTIVE" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-white/10 text-zinc-400"}`}>{raffle.status}</span></div>
                      <h1 className="mt-9 text-3xl font-semibold tracking-tight sm:text-5xl">{raffle.title}</h1>
                      <p className="mt-4 max-w-xl text-sm leading-7 text-zinc-500">{raffle.description || raffle.prizeDescription || "Complete the required community tasks to enter this raffle."}</p>
                    </div>
                    {raffle.project && <Link href={raffle.project.id ? `/projects/${raffle.project.id}` : "#"} className="mt-8 inline-flex w-fit items-center gap-3 rounded-2xl border border-white/10 bg-white/[.03] px-3 py-2.5 hover:bg-white/[.06]"><div className="grid h-10 w-10 place-items-center overflow-hidden rounded-xl bg-black">{raffle.project.logoUrl ? <img src={raffle.project.logoUrl} alt="" className="h-full w-full object-cover" /> : <span className="font-bold text-violet-300">R</span>}</div><div><div className="text-[8px] uppercase tracking-[.18em] text-zinc-600">Created by</div><div className="text-xs font-semibold">{raffle.project.name || "Project"}</div></div></Link>}
                  </div>
                  <div className="relative min-h-[260px] overflow-hidden bg-[radial-gradient(circle_at_50%_25%,rgba(139,92,246,.35),transparent_50%),linear-gradient(135deg,#17121f,#09090d)]">{raffle.project?.bannerUrl && <img src={raffle.project.bannerUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-90" />}<div className="absolute inset-0 bg-gradient-to-t from-[#08080c] via-transparent to-black/10" /><div className="absolute bottom-6 left-6 right-6 rounded-2xl border border-white/10 bg-black/35 p-4 backdrop-blur-xl"><div className="text-[8px] font-black uppercase tracking-[.2em] text-zinc-500">Prize</div><div className="mt-1 text-lg font-semibold">{raffle.prizeName}</div><div className="mt-1 text-xs text-zinc-400">{raffle.prizeQuantity} winner prize{raffle.prizeQuantity === 1 ? "" : "s"}</div></div></div>
                </div>
                <div className="grid border-t border-white/10 sm:grid-cols-3"><div className="border-b border-white/10 p-5 sm:border-b-0 sm:border-r"><div className="text-[8px] font-black uppercase tracking-[.18em] text-zinc-600">Ends</div><div className="mt-2 text-sm font-semibold">{new Date(raffle.endsAt).toLocaleDateString()}</div><div className="mt-1 text-xs text-zinc-500">{timeLeft(raffle.endsAt)}</div></div><div className="border-b border-white/10 p-5 sm:border-b-0 sm:border-r"><div className="text-[8px] font-black uppercase tracking-[.18em] text-zinc-600">Winners</div><div className="mt-2 text-sm font-semibold">{raffle.winnerCount ?? 1}</div><div className="mt-1 text-xs text-zinc-500">selected after closing</div></div><div className="p-5"><div className="text-[8px] font-black uppercase tracking-[.18em] text-zinc-600">Entry status</div><div className={`mt-2 text-sm font-semibold ${confirmed ? "text-emerald-300" : "text-zinc-200"}`}>{statusText}</div><div className="mt-1 text-xs text-zinc-500">{entry ? "Your entry is saved" : "Not entered yet"}</div></div></div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-[#0d0c12] p-6 sm:p-8"><div className="text-[9px] font-black uppercase tracking-[.2em] text-violet-400">Giveaway information</div><h2 className="mt-2 text-xl font-semibold">About this raffle</h2><div className="mt-6 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl border border-white/10 bg-white/[.025] p-4"><div className="text-[8px] uppercase tracking-[.18em] text-zinc-600">Type</div><div className="mt-2 text-sm">Raffle</div></div><div className="rounded-2xl border border-white/10 bg-white/[.025] p-4"><div className="text-[8px] uppercase tracking-[.18em] text-zinc-600">Prize</div><div className="mt-2 text-sm">{raffle.prizeName}</div></div><div className="rounded-2xl border border-white/10 bg-white/[.025] p-4"><div className="text-[8px] uppercase tracking-[.18em] text-zinc-600">Start</div><div className="mt-2 text-sm">{new Date(raffle.startsAt).toLocaleString()}</div></div><div className="rounded-2xl border border-white/10 bg-white/[.025] p-4"><div className="text-[8px] uppercase tracking-[.18em] text-zinc-600">End</div><div className="mt-2 text-sm">{new Date(raffle.endsAt).toLocaleString()}</div></div></div>{raffle.prizeDescription && <p className="mt-6 border-t border-white/10 pt-6 text-sm leading-7 text-zinc-500">{raffle.prizeDescription}</p>}</div>
            </section>

            <aside className="lg:sticky lg:top-24 lg:self-start"><div className="overflow-hidden rounded-3xl border border-white/10 bg-[#0d0c12] shadow-2xl shadow-black/20">
              <div className="border-b border-white/10 p-6"><div className="flex items-center justify-between"><div><div className="text-[9px] font-black uppercase tracking-[.2em] text-violet-400">01 · Entry requirements</div><h2 className="mt-2 text-xl font-semibold">Secure your spot</h2></div><div className="rounded-full bg-white/[.04] px-2.5 py-1 text-[10px] font-semibold text-zinc-400">{verifiedCount}/{requiredTasks.length || 0}</div></div><p className="mt-3 text-xs leading-5 text-zinc-500">Open each task, complete it on X or Discord, come back, and Raven Oracle will automatically verify it. A manual verify button is always available.</p></div>
              <div className="p-5">
                {!entry && <button onClick={startEntry} disabled={busy || !activeWindow} className="w-full rounded-2xl bg-violet-600 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-violet-900/20 hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Starting…" : activeWindow ? "Enter Raffle" : raffle.status === "SCHEDULED" ? `Starts in ${timeLeft(raffle.startsAt)}` : "Entry closed"}</button>}
                {entry && <div className="mb-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/[.06] p-4"><div className="text-xs font-semibold text-emerald-200">✓ Entry started</div><div className="mt-1 text-[10px] text-emerald-400/70">Finish the tasks below. Verification happens automatically after you return.</div></div>}
                <div className="space-y-3">
                  {tasks.map((task) => {
                    const result = results[task.id];
                    const verified = result?.verified === true;
                    const checking = checkingTaskId === task.id;
                    const isConnected = connected(taskProvider(task.type));
                    const pending = pendingTaskId === task.id;
                    const link = taskLink(task);
                    return <div key={task.id} className={`rounded-2xl border p-4 ${verified ? "border-emerald-500/20 bg-emerald-500/[.04]" : "border-white/10 bg-white/[.02]"}`}>
                      <div className="flex items-start gap-3"><div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sm font-bold ${verified ? "bg-emerald-500/15 text-emerald-300" : "bg-white/[.06] text-zinc-300"}`}>{verified ? "✓" : taskIcon(task.type)}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><div className="text-sm font-semibold">{task.title}</div>{task.isRequired && <span className="text-[8px] font-black uppercase tracking-[.12em] text-violet-400">Required</span>}</div><div className="mt-1 text-[11px] leading-5 text-zinc-500">{task.description || `Complete this ${taskProvider(task.type)} requirement.`}</div></div></div>
                      {entry && !verified && <>
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><span className={`text-[10px] ${isConnected ? "text-emerald-400" : "text-amber-400"}`}>{isConnected ? `✓ ${taskProvider(task.type)} connected` : `${taskProvider(task.type)} not connected`}</span><div className="flex gap-2"><button onClick={() => openTask(task)} disabled={busy || checking} className="rounded-xl bg-white/[.06] px-3 py-2 text-[10px] font-bold text-zinc-200 hover:bg-white/[.1]">{link ? "Open task" : "Task info"}</button><button onClick={() => verifyTask(task, false)} disabled={busy || checking} className="rounded-xl border border-violet-500/30 px-3 py-2 text-[10px] font-bold text-violet-300 hover:bg-violet-500/10">{checking ? "Checking…" : "Verify now"}</button></div></div>
                        {pending && <div className="mt-2 text-[10px] text-violet-300">Waiting for you to return — automatic verification is armed.</div>}
                      </>}
                      {result?.reason && !verified && <div className="mt-3 rounded-xl border border-amber-500/15 bg-amber-500/[.04] px-3 py-2 text-[10px] leading-4 text-amber-300/80">{result.reason}</div>}
                      {verified && <div className="mt-3 text-[10px] font-semibold text-emerald-300">Verified ✓</div>}
                    </div>;
                  })}
                  {tasks.length === 0 && <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[.04] p-4 text-xs text-amber-300">No tasks configured for this raffle.</div>}
                </div>
                {entry && <button onClick={() => void verifyAll(false)} disabled={busy} className="mt-4 w-full rounded-xl border border-white/10 bg-white/[.03] px-4 py-3 text-xs font-semibold text-zinc-300 hover:bg-white/[.06]">{busy ? "Checking…" : "Verify all tasks"}</button>}
              </div>

              {entry && walletRequired && <div className="border-t border-white/10 p-5"><div className="text-[9px] font-black uppercase tracking-[.2em] text-violet-400">02 · Final entry</div><h3 className="mt-2 text-lg font-semibold">Choose your payout wallet</h3><p className="mt-2 text-xs leading-5 text-zinc-500">Only available after all required tasks are verified.</p>{wallets.length > 0 && <select value={walletId} onChange={(e) => setWalletId(e.target.value)} disabled={busy || !allTasksVerified} className="mt-4 w-full rounded-xl border border-white/10 bg-[#09090d] px-3 py-3 text-xs text-zinc-200"><option value="">Select wallet</option>{wallets.map((wallet) => <option key={wallet.id} value={wallet.id}>{shortAddress(wallet.address)} · {wallet.network}</option>)}</select>}{walletId && <button onClick={() => void attachWallet(walletId)} disabled={busy || !allTasksVerified || (captchaRequired && entry.captchaPassed !== true)} className="mt-3 w-full rounded-xl bg-violet-600 px-4 py-3 text-xs font-bold disabled:opacity-40">{busy ? "Submitting…" : "Use selected wallet"}</button>}<div className="my-4 flex items-center gap-3 text-[9px] uppercase tracking-[.15em] text-zinc-700"><span className="h-px flex-1 bg-white/10" />or paste a wallet<span className="h-px flex-1 bg-white/10" /></div><div className="grid grid-cols-[110px_1fr] gap-2"><select value={chain} onChange={(e) => setChain(e.target.value as "EVM" | "SOLANA")} disabled={busy || !allTasksVerified} className="rounded-xl border border-white/10 bg-[#09090d] px-3 py-3 text-xs text-zinc-300"><option value="EVM">EVM</option><option value="SOLANA">Solana</option></select><input value={address} onChange={(e) => setAddress(e.target.value)} disabled={busy || !allTasksVerified} placeholder="0x… or Solana address" className="min-w-0 rounded-xl border border-white/10 bg-[#09090d] px-3 py-3 text-xs text-zinc-200" /></div><button onClick={addWallet} disabled={busy || !allTasksVerified || !address.trim() || (captchaRequired && entry.captchaPassed !== true)} className="mt-3 w-full rounded-xl border border-violet-500/30 bg-violet-500/10 px-4 py-3 text-xs font-bold text-violet-200 disabled:opacity-40">Add wallet & submit entry</button>{confirmed && <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/[.06] p-4"><div className="text-xs font-semibold text-emerald-200">✓ Entry confirmed</div><div className="mt-1 text-[10px] text-emerald-400/70">Your tasks and payout wallet passed the current eligibility checks.</div></div>}{message && <div className="mt-4 rounded-xl border border-white/10 bg-white/[.03] px-3 py-2 text-[10px] leading-4 text-zinc-400">{message}</div>}</div>}
            </div></aside>
          </div>
        </div>
      </RaffleCaptchaGate>
    </main>
  );
}
