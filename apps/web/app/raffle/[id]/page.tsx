"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import SiteHeader from "../../../components/SiteHeader";
import RaffleCaptchaGate from "../../../components/RaffleCaptchaGate";
import { API_BASE_URL } from "@/lib/api-config";

type User = { username?: string | null; displayName?: string | null };
type Wallet = { id: string; address: string; chain: "EVM" | "SOLANA"; network: string; status?: string };
type Raffle = { id: string; title: string; description?: string | null; prizeName: string; prizeDescription?: string | null; prizeQuantity: number; startsAt: string; endsAt: string; status: string; winnerCount?: number; entryRules?: unknown; project?: { id?: string; name?: string | null; logoUrl?: string | null; bannerUrl?: string | null; xUrl?: string | null; discordUrl?: string | null } | null };
type Task = { id: string; type: "X_FOLLOW" | "X_LIKE" | "X_REPOST" | "DISCORD_JOIN"; title: string; description?: string | null; target: string; targetUrl?: string | null; isRequired: boolean; sortOrder?: number };
type Result = { taskId: string; verified: boolean; reason?: string | null };
type Entry = { id: string; status: string; walletAddressSnapshot?: string | null; captchaPassed?: boolean | null; enteredAt: string };

async function api<T>(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  const token = typeof window !== "undefined" ? localStorage.getItem("raven_token") : null;
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers, credentials: "include", cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message ?? `Request failed (${response.status})`);
  return data as T;
}

function icon(task: Task) {
  return task.type === "DISCORD_JOIN" ? "◉" : task.type === "X_FOLLOW" ? "𝕏" : task.type === "X_LIKE" ? "♡" : "↻";
}
function label(task: Task) {
  return task.type === "DISCORD_JOIN" ? "Join Discord" : task.type === "X_FOLLOW" ? "Follow on X" : task.type === "X_LIKE" ? "Like on X" : "Repost on X";
}
function taskUrl(task: Task, raffle: Raffle) {
  const raw = task.targetUrl || (task.type === "X_FOLLOW" ? raffle.project?.xUrl : task.type === "DISCORD_JOIN" ? raffle.project?.discordUrl : task.target) || task.target || "";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (task.type === "X_FOLLOW" && /^[A-Za-z0-9_]{1,15}$/.test(raw.replace(/^@/, ""))) return `https://x.com/${raw.replace(/^@/, "")}`;
  return "";
}
function timeLeft(value: string) {
  const minutes = Math.floor((new Date(value).getTime() - Date.now()) / 60000);
  if (minutes <= 0) return "Ended";
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  return days ? `${days}d ${hours}h` : `${hours}h ${minutes % 60}m`;
}
function dateLabel(value: string) { return new Date(value).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" }); }
function rules(value: unknown) { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }

export default function FastRafflePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [raffle, setRaffle] = useState<Raffle | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [results, setResults] = useState<Record<string, Result>>({});
  const [entry, setEntry] = useState<Entry | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [walletId, setWalletId] = useState("");
  const [address, setAddress] = useState("");
  const [chain, setChain] = useState<"EVM" | "SOLANA">("EVM");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState<string | null>(null);
  const [readyToVerify, setReadyToVerify] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
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
      } catch { setEntry(null); }
      try {
        const walletData = await api<{ wallets: Wallet[] }>("/wallets/");
        const active = (walletData.wallets ?? []).filter((wallet) => wallet.status !== "ARCHIVED" && wallet.status !== "DELETED");
        setWallets(active);
        setWalletId(active[0]?.id ?? "");
      } catch { setWallets([]); }
      try {
        const me = await api<{ user: User }>("/auth/me");
        setUser(me.user);
      } catch { setUser(null); }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load raffle");
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const required = useMemo(() => tasks.filter((task) => task.isRequired).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)), [tasks]);
  const verifiedCount = required.filter((task) => results[task.id]?.verified).length;
  const allVerified = required.length === 0 || verifiedCount === required.length;
  const active = raffle?.status === "ACTIVE" && Date.now() >= new Date(raffle.startsAt).getTime() && Date.now() <= new Date(raffle.endsAt).getTime();
  const captchaRequired = rules(raffle?.entryRules).captchaRequired === true;
  const confirmed = entry?.status === "ELIGIBLE" && Boolean(entry.walletAddressSnapshot);

  const refreshEligibility = useCallback(async () => {
    if (!user || !entry) return;
    try {
      const data = await api<{ allRequiredTasksVerified: boolean; tasks: Result[]; entry: Entry }>(`/raffles/${id}/entries/me/verify-tasks`, { method: "POST" });
      const next: Record<string, Result> = {};
      for (const result of data.tasks ?? []) next[result.taskId] = result;
      setResults(next);
      setEntry(data.entry);
    } catch { /* Task verification itself already succeeded; eligibility refresh is best-effort. */ }
  }, [id, user, entry]);

  const start = async () => {
    if (!user) return router.push(`/login?next=${encodeURIComponent(`/raffles/${id}`)}`);
    if (!active) return setMessage(raffle?.status === "SCHEDULED" ? `Starts in ${timeLeft(raffle.startsAt)}` : "Entry closed");
    setBusy(true);
    try {
      const data = await api<{ entry: Entry }>(`/raffles/${id}/entries`, { method: "POST", body: JSON.stringify({}) });
      setEntry(data.entry);
      setMessage("Entry started. Open each task in order.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to enter raffle"); }
    finally { setBusy(false); }
  };

  const verifyTask = async (task: Task) => {
    if (!user) return router.push(`/login?next=${encodeURIComponent(`/raffles/${id}`)}`);
    if (!entry) return setMessage("Click Enter Giveaway first.");
    const index = required.findIndex((item) => item.id === task.id);
    if (task.isRequired && index > 0 && !results[required[index - 1].id]?.verified) {
      return setMessage(`Complete the previous task first: ${required[index - 1].title}`);
    }
    if (checking) return;

    if (readyToVerify !== task.id) {
      const url = taskUrl(task, raffle!);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
      setReadyToVerify(null);
      setChecking(task.id);
      setMessage(`Complete ${label(task)} in the opened tab…`);
      window.setTimeout(() => {
        setChecking(null);
        setReadyToVerify(task.id);
        setMessage(`Come back here and click Verify ${label(task)}.`);
      }, 2000);
      return;
    }

    setChecking(task.id);
    setMessage(`Verifying ${label(task)}…`);
    try {
      const data = await api<{ verified?: boolean; reason?: string }>(`/raffles/${id}/tasks/${task.id}/verify`, { method: "POST" });
      const verified = data.verified === true;
      setResults((current) => ({ ...current, [task.id]: { taskId: task.id, verified, reason: data.reason ?? null } }));
      setReadyToVerify(null);
      if (verified) setMessage(`${label(task)} completed ✓`);
      else setMessage(data.reason || "Task could not be verified.");
      if (verified) await refreshEligibility();
    } catch (error) {
      setResults((current) => ({ ...current, [task.id]: { taskId: task.id, verified: false, reason: error instanceof Error ? error.message : "Verification failed" } }));
      setMessage(error instanceof Error ? error.message : "Verification failed");
    } finally { setChecking(null); }
  };

  const submitWallet = async () => {
    if (!user) return router.push(`/login?next=${encodeURIComponent(`/raffles/${id}`)}`);
    if (!entry) return setMessage("Enter the giveaway first.");
    if (!allVerified) return setMessage("Complete all required tasks first.");
    if (captchaRequired && entry.captchaPassed !== true) return setMessage("Complete the CAPTCHA before submitting your payout wallet.");
    if (!walletId && !address.trim()) return setMessage("Select or paste a payout wallet.");
    setBusy(true);
    try {
      let selected = walletId;
      if (!selected) {
        const created = await api<{ wallet: Wallet }>("/wallets/", { method: "POST", body: JSON.stringify({ address: address.trim(), chain }) });
        selected = created.wallet.id;
        setWallets((items) => [created.wallet, ...items]);
        setWalletId(selected);
        setAddress("");
      }
      const data = await api<{ entry: Entry }>(`/raffles/${id}/entries/me/wallet`, { method: "PATCH", body: JSON.stringify({ walletAddressId: selected }) });
      setEntry(data.entry);
      setMessage("Wallet submitted. Your entry is complete.");
      await refreshEligibility();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to submit wallet"); }
    finally { setBusy(false); }
  };

  if (loading || !raffle) return <main className="min-h-screen bg-[#f5f6f8] dark:bg-[#07070a]"><SiteHeader /><div className="mx-auto max-w-6xl px-5 py-16 text-sm text-slate-500">{message || "Loading raffle…"}</div></main>;

  return (
    <main className="min-h-screen bg-[#f5f6f8] text-[#17181d] dark:bg-[#07070a] dark:text-zinc-100">
      <SiteHeader />
      <RaffleCaptchaGate raffleId={id}>
        <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
          <Link href="/raffles" className="text-xs text-slate-500">Home / All Raffles / {raffle.title}</Link>
          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_360px]">
            <section className="space-y-4">
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#0d0c11]">
                <div className="grid md:grid-cols-2">
                  <div className="flex min-h-[330px] flex-col items-center justify-center border-b border-slate-200 p-8 text-center dark:border-white/10 md:border-b-0 md:border-r">
                    <div className="h-20 w-20 overflow-hidden rounded-xl border border-slate-200">{raffle.project?.logoUrl ? <img src={raffle.project.logoUrl} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-2xl font-black">R</div>}</div>
                    <div className="mt-4 text-[9px] font-black uppercase tracking-[.18em] text-slate-400">{raffle.status}</div>
                    <h1 className="mt-2 text-3xl font-semibold">{raffle.project?.name || raffle.title}</h1>
                    <p className="mt-1 text-sm text-slate-500">{raffle.title}</p>
                    <div className="mt-4 flex gap-3 text-xs text-slate-400"><span>{required.length} tasks</span><span>•</span><span>{raffle.winnerCount || 1} winners</span></div>
                  </div>
                  <div className="relative min-h-[330px] overflow-hidden bg-slate-200 dark:bg-[#17131f]">{raffle.project?.bannerUrl ? <img src={raffle.project.bannerUrl} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full bg-gradient-to-br from-slate-300 to-violet-600" />}<div className="absolute bottom-5 left-5 right-5 rounded-xl bg-black/40 p-4 text-white backdrop-blur"><div className="text-[9px] uppercase tracking-[.18em] text-white/60">Prize</div><div className="mt-1 text-lg font-semibold">{raffle.prizeName}</div></div></div>
                </div>
                <div className="grid border-t border-slate-200 sm:grid-cols-3 dark:border-white/10"><div className="p-5"><div className="text-[9px] uppercase tracking-[.15em] text-slate-400">Ends</div><div className="mt-1 text-sm font-semibold">{dateLabel(raffle.endsAt)}</div></div><div className="border-t border-slate-200 p-5 sm:border-x sm:border-t-0 dark:border-white/10"><div className="text-[9px] uppercase tracking-[.15em] text-slate-400">Time left</div><div className="mt-1 text-sm font-semibold">{timeLeft(raffle.endsAt)}</div></div><div className="border-t border-slate-200 p-5 sm:border-t-0 dark:border-white/10"><div className="text-[9px] uppercase tracking-[.15em] text-slate-400">Winners</div><div className="mt-1 text-sm font-semibold">{raffle.winnerCount || 1}</div></div></div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-[#0d0c11]"><div className="text-[9px] font-black uppercase tracking-[.18em] text-violet-500">Giveaway information</div><h2 className="mt-2 text-xl font-semibold">About this giveaway</h2>{raffle.description && <p className="mt-4 text-sm leading-7 text-slate-500">{raffle.description}</p>}{raffle.prizeDescription && <p className="mt-3 text-sm leading-7 text-slate-500">{raffle.prizeDescription}</p>}</div>
            </section>

            <aside className="lg:sticky lg:top-24 lg:self-start">
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#0d0c11]">
                <div className="border-b border-slate-200 p-5 dark:border-white/10"><div className="text-[9px] font-black uppercase tracking-[.18em] text-slate-400">01 · ENTRY REQUIREMENTS</div><div className="mt-2 flex items-center justify-between"><h2 className="text-xl font-semibold">Secure your spot</h2><span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-black text-slate-500">{verifiedCount}/{required.length}</span></div></div>
                <div className="p-4">
                  {!entry && <button onClick={() => void start()} disabled={busy || !active} className="mb-3 w-full rounded-xl bg-[#3f7cff] py-3 text-sm font-bold text-white disabled:opacity-40">{active ? "Enter Giveaway" : raffle.status === "SCHEDULED" ? `Starts in ${timeLeft(raffle.startsAt)}` : "Entry closed"}</button>}
                  {entry && <div className="mb-3 rounded-xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-700">✓ Entry started</div>}
                  <div className="space-y-2">
                    {tasks.map((task, index) => {
                      const result = results[task.id];
                      const requiredIndex = required.findIndex((item) => item.id === task.id);
                      const previousDone = !task.isRequired || requiredIndex <= 0 || Boolean(results[required[requiredIndex - 1].id]?.verified);
                      const locked = Boolean(entry) && task.isRequired && !previousDone;
                      const checkingThis = checking === task.id;
                      return <div key={task.id} className={`rounded-xl border p-3 transition ${result?.verified ? "border-emerald-300 bg-emerald-50/60 dark:border-emerald-500/30 dark:bg-emerald-500/5" : locked ? "border-slate-200 bg-slate-50 opacity-60 dark:border-white/10 dark:bg-white/[.02]" : "border-slate-200 dark:border-white/10"}`}>
                        <div className="flex items-center gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-violet-500/10 text-sm text-violet-500">{icon(task)}</span><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><b className="text-xs">{label(task)}</b>{task.isRequired && <span className="text-[7px] font-black uppercase tracking-wider text-violet-500">Required</span>}</div><p className="mt-1 truncate text-[10px] text-slate-500">{task.type === "X_FOLLOW" ? `@${task.target.replace(/^@/, "")}` : task.target}</p></div><button onClick={() => void verifyTask(task)} disabled={!entry || busy || (Boolean(checking) && checking !== task.id) || locked || Boolean(result?.verified)} className={`shrink-0 rounded-lg px-3 py-2 text-[9px] font-black disabled:cursor-not-allowed disabled:opacity-40 ${result?.verified ? "text-emerald-600" : "border border-violet-300 text-violet-700 dark:border-violet-400/30 dark:text-violet-300"}`}>{result?.verified ? "✓ Completed" : checkingThis ? "Opening…" : readyToVerify === task.id ? "Verify" : locked ? "Locked" : "Open task"}</button></div>
                        {result?.reason && !result.verified && <p className="mt-2 text-[10px] text-red-500">{result.reason}</p>}
                      </div>;
                    })}
                  </div>
                  {message && <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50 p-3 text-[10px] text-violet-800 dark:border-white/10 dark:bg-white/[.03] dark:text-zinc-300">{message}</div>}
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#0d0c11]"><div className="text-[9px] font-black uppercase tracking-[.18em] text-slate-400">02 · FINAL ENTRY</div><h2 className="mt-2 text-xl font-semibold">Payout wallet</h2><p className="mt-2 text-xs leading-5 text-slate-500">Available after all required tasks are verified.</p>
                {entry && allVerified && !confirmed && <div className="mt-4"><div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setChain("EVM")} className={`rounded-lg border px-3 py-2 text-[9px] font-black ${chain === "EVM" ? "border-violet-600 bg-violet-600 text-white" : "border-slate-200 text-slate-600 dark:border-white/10 dark:text-zinc-300"}`}>EVM</button><button type="button" onClick={() => setChain("SOLANA")} className={`rounded-lg border px-3 py-2 text-[9px] font-black ${chain === "SOLANA" ? "border-violet-600 bg-violet-600 text-white" : "border-slate-200 text-slate-600 dark:border-white/10 dark:text-zinc-300"}`}>SOLANA</button></div><input value={address} onChange={(event) => setAddress(event.target.value)} placeholder={chain === "EVM" ? "0x…" : "Solana address…"} className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs outline-none focus:border-violet-500 dark:border-white/10 dark:bg-black/20" /><button onClick={() => void submitWallet()} disabled={busy || (!walletId && !address.trim())} className="mt-3 w-full rounded-xl bg-violet-600 px-4 py-3 text-xs font-black text-white disabled:opacity-40">Submit Wallet</button>{wallets.length > 0 && <><div className="my-3 text-center text-[9px] text-slate-400">or use saved wallet</div><select value={walletId} onChange={(event) => setWalletId(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs dark:border-white/10 dark:bg-black/20">{wallets.map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.address.slice(0, 7)}…{wallet.address.slice(-5)} · {wallet.chain}</option>)}</select><button onClick={() => void submitWallet()} disabled={busy || !walletId} className="mt-3 w-full rounded-xl border border-violet-500/30 px-4 py-3 text-xs font-black text-violet-600 disabled:opacity-40 dark:text-violet-300">Use Saved Wallet</button></>}</div>}
                {entry && !allVerified && <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-500 dark:bg-white/[.03]">Complete {required.length - verifiedCount} more required task{required.length - verifiedCount === 1 ? "" : "s"} first.</div>}
                {confirmed && <div className="mt-4 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-xs font-semibold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/5 dark:text-emerald-400">✓ Entry confirmed</div>}
              </div>
            </aside>
          </div>
        </div>
      </RaffleCaptchaGate>
    </main>
  );
}
