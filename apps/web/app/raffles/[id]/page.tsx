"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import SiteHeader from "../../../components/SiteHeader";
import RaffleCaptchaGate from "../../../components/RaffleCaptchaGate";
import { API_BASE_URL } from "@/lib/api-config";
import { useTheme } from "@/contexts/ThemeContext";

type User = { id: string; displayName?: string | null; username?: string | null };
type Social = { provider: "X" | "DISCORD"; providerUsername?: string | null; isActive?: boolean };
type Wallet = { id: string; address: string; chain: "EVM" | "SOLANA"; network: string; status?: string };
type Raffle = {
  id: string;
  title: string;
  description?: string | null;
  prizeName: string;
  prizeQuantity: number;
  startsAt: string;
  endsAt: string;
  status: string;
  winnerCount?: number;
  entryRules?: unknown;
  project?: { id?: string; name?: string | null; logoUrl?: string | null; bannerUrl?: string | null } | null;
};
type Task = { id: string; type: "DISCORD_JOIN" | "X_FOLLOW" | "X_LIKE" | "X_REPOST"; title: string; target: string; targetUrl?: string | null; isRequired: boolean };
type TaskResult = { taskId: string; type: Task["type"]; title: string; required: boolean; verified: boolean; reason?: string | null };
type EntryDetails = { id: string; status: string; walletAddressSnapshot?: string | null; captchaPassed?: boolean | null; enteredAt: string; walletAddress?: { id?: string; chain: string; network: string; address?: string } | null };

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

function taskIcon(type: Task["type"]) { return type === "DISCORD_JOIN" ? "◈" : type === "X_FOLLOW" ? "𝕏" : type === "X_LIKE" ? "♡" : "↻"; }
function provider(type: Task["type"]): "X" | "DISCORD" { return type === "DISCORD_JOIN" ? "DISCORD" : "X"; }
function taskLabel(type: Task["type"]) { return type === "DISCORD_JOIN" ? "Join Discord" : type === "X_FOLLOW" ? "Follow on X" : type === "X_LIKE" ? "Like on X" : "Repost on X"; }
function countdown(value: string) {
  const ms = new Date(value).getTime() - Date.now();
  if (ms <= 0) return "Ended";
  const minutes = Math.floor(ms / 60000);
  if (minutes >= 1440) return `${Math.floor(minutes / 1440)}d ${Math.floor((minutes % 1440) / 60)}h`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}
function entryRules(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {}; }
function raffleType(value: unknown) { return entryRules(value).raffleType === "FCFS" ? "FCFS" : "RAFFLE"; }
function hasCaptcha(value: unknown) { return entryRules(value).captchaRequired === true; }

export default function RafflePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const dark = theme === "dark";
  const page = dark ? "bg-[#06060a] text-zinc-100" : "bg-[#f6f7fb] text-zinc-950";
  const card = dark ? "border-white/10 bg-[#0d0c11]" : "border-zinc-200 bg-white";
  const soft = dark ? "border-white/10 bg-white/[.025]" : "border-zinc-200 bg-zinc-50";
  const muted = dark ? "text-zinc-400" : "text-zinc-600";
  const faint = "text-zinc-500";
  const input = dark ? "border-white/10 bg-black/20 text-white placeholder:text-zinc-600" : "border-zinc-300 bg-white text-zinc-950 placeholder:text-zinc-400";

  const [raffle, setRaffle] = useState<Raffle | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [results, setResults] = useState<Record<string, TaskResult>>({});
  const [entry, setEntry] = useState<EntryDetails | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [socials, setSocials] = useState<Social[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [walletId, setWalletId] = useState("");
  const [address, setAddress] = useState("");
  const [chain, setChain] = useState<"EVM" | "SOLANA">("EVM");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const loadRaffle = useCallback(async () => {
    if (!id) return;
    try {
      const [raffleData, taskData] = await Promise.all([
        api<{ raffle: Raffle }>(`/raffles/${id}`),
        api<{ tasks: Task[] }>(`/raffles/${id}/tasks`),
      ]);
      setRaffle(raffleData.raffle);
      setTasks(taskData.tasks ?? []);
      try {
        const entryData = await api<{ entry: EntryDetails }>(`/raffles/${id}/entries/me`);
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

  const loadAccount = useCallback(async () => {
    try {
      const me = await api<{ user: User }>("/auth/me");
      setUser(me.user);
      const [socialData, walletData] = await Promise.all([
        api<{ accounts: Social[] }>("/social-accounts/"),
        api<{ wallets: Wallet[] }>("/wallets/"),
      ]);
      setSocials(socialData.accounts ?? []);
      const active = (walletData.wallets ?? []).filter((wallet) => wallet.status !== "DELETED");
      setWallets(active);
      setWalletId((current) => current || active[0]?.id || "");
    } catch {
      setUser(null);
      setSocials([]);
      setWallets([]);
      setWalletId("");
    }
  }, []);

  useEffect(() => {
    void loadRaffle();
    void loadAccount();
  }, [loadRaffle, loadAccount]);

  const required = useMemo(() => tasks.filter((task) => task.isRequired), [tasks]);
  const verifiedRequired = required.filter((task) => results[task.id]?.verified).length;
  const allRequiredVerified = required.length > 0 && verifiedRequired === required.length;
  const canEnter = raffle?.status === "ACTIVE" && Date.now() >= new Date(raffle.startsAt).getTime() && Date.now() <= new Date(raffle.endsAt).getTime();
  const connected = (which: "X" | "DISCORD") => socials.some((social) => social.provider === which && social.isActive !== false);
  const captchaRequired = hasCaptcha(raffle?.entryRules);
  const confirmed = entry?.status === "ELIGIBLE" && Boolean(entry.walletAddressSnapshot);
  const type = raffleType(raffle?.entryRules);
  const requireLogin = () => router.push(`/login?next=${encodeURIComponent(`/raffles/${id}`)}`);

  const refreshVerification = useCallback(async () => {
    if (!user || !entry) return;
    try {
      const data = await api<{ allRequiredTasksVerified: boolean; tasks: TaskResult[]; entry: EntryDetails }>(`/raffles/${id}/entries/me/verify-tasks`, { method: "POST" });
      const next: Record<string, TaskResult> = {};
      for (const item of data.tasks ?? []) next[item.taskId] = item;
      setResults(next);
      setEntry(data.entry);
      if (data.allRequiredTasksVerified && data.entry.status === "ELIGIBLE") setMessage("All tasks verified. Your entry is eligible.");
      else if (data.allRequiredTasksVerified) setMessage("All tasks verified. Submit your payout wallet to finish entry.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Verification refresh failed");
    }
  }, [id, user, entry]);

  const connectSocial = async (which: "x" | "discord") => {
    if (!user) return requireLogin();
    try {
      const returnTo = `/raffles/${id}`;
      const data = await api<{ authorizationUrl: string }>(`/auth/${which}/start?returnTo=${encodeURIComponent(returnTo)}`);
      window.location.href = data.authorizationUrl;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `Unable to connect ${which}`);
    }
  };

  const startEntry = async () => {
    if (!user) return requireLogin();
    if (!canEnter) return setMessage(raffle?.status === "SCHEDULED" ? `Starts in ${countdown(raffle.startsAt)}.` : "This raffle is not accepting entries.");
    if (entry) return entry;
    setBusy(true);
    try {
      const data = await api<{ entry: EntryDetails }>(`/raffles/${id}/entries`, { method: "POST", body: JSON.stringify({}) });
      setEntry(data.entry);
      setMessage("Entry started. Complete the required tasks below.");
      return data.entry;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to start raffle entry");
      return null;
    } finally {
      setBusy(false);
    }
  };

  const verifyTask = async (task: Task) => {
    if (!user) return requireLogin();
    if (!entry) return setMessage("Enter the raffle first, then complete the tasks.");
    if (task.targetUrl) window.open(task.targetUrl, "_blank", "noopener,noreferrer");
    setBusy(true);
    try {
      const data = await api<{ verified?: boolean; result?: { verified: boolean; reason?: string | null }; reason?: string | null }>(`/raffles/${id}/tasks/${task.id}/verify`, { method: "POST" });
      const verified = data.verified === true || data.result?.verified === true;
      setResults((current) => ({ ...current, [task.id]: { taskId: task.id, type: task.type, title: task.title, required: task.isRequired, verified, reason: data.reason ?? data.result?.reason ?? null } }));
    } catch (error) {
      setResults((current) => ({ ...current, [task.id]: { taskId: task.id, type: task.type, title: task.title, required: task.isRequired, verified: false, reason: error instanceof Error ? error.message : "Verification failed" } }));
    } finally {
      setBusy(false);
    }
    await refreshVerification();
  };

  const addAndAttachWallet = async () => {
    if (!user) return requireLogin();
    if (!entry) return setMessage("Enter the raffle first.");
    if (!allRequiredVerified) return setMessage("Complete all required tasks first.");
    if (captchaRequired && entry.captchaPassed !== true) return setMessage("Complete the CAPTCHA before submitting your wallet.");
    if (!address.trim()) return setMessage("Paste your payout wallet address.");
    setBusy(true);
    try {
      const created = await api<{ wallet: Wallet }>("/wallets/", { method: "POST", body: JSON.stringify({ address: address.trim(), chain }) });
      const attached = await api<{ entry: EntryDetails }>(`/raffles/${id}/entries/me/wallet`, { method: "PATCH", body: JSON.stringify({ walletAddressId: created.wallet.id }) });
      setWallets((items) => [created.wallet, ...items]);
      setWalletId(created.wallet.id);
      setAddress("");
      setEntry(attached.entry);
      setMessage("Wallet submitted. Running final eligibility checks…");
      await refreshVerification();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to submit wallet");
    } finally {
      setBusy(false);
    }
  };

  const attachExistingWallet = async () => {
    if (!user || !walletId) return;
    if (!entry) return setMessage("Enter the raffle first.");
    if (!allRequiredVerified) return setMessage("Complete all required tasks first.");
    if (captchaRequired && entry.captchaPassed !== true) return setMessage("Complete the CAPTCHA before submitting your wallet.");
    setBusy(true);
    try {
      const attached = await api<{ entry: EntryDetails }>(`/raffles/${id}/entries/me/wallet`, { method: "PATCH", body: JSON.stringify({ walletAddressId: walletId }) });
      setEntry(attached.entry);
      setMessage("Wallet submitted. Running final eligibility checks…");
      await refreshVerification();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to submit wallet");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <main className={`min-h-screen ${page}`}><SiteHeader /><div className={`mx-auto max-w-6xl px-5 py-16 ${muted}`}>Loading raffle…</div></main>;
  if (!raffle) return <main className={`min-h-screen ${page}`}><SiteHeader /><div className={`mx-auto max-w-2xl px-5 py-20 text-center ${muted}`}>{message || "Raffle not found"}</div></main>;

  const banner = raffle.project?.bannerUrl;
  const statusTone = raffle.status === "ACTIVE" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "border-black/10 bg-black/5 text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300";

  return (
    <main className={`min-h-screen ${page}`}>
      <SiteHeader />
      <RaffleCaptchaGate raffleId={id}>
        <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
          <Link href="/raffles" className={`text-xs font-medium ${muted} hover:text-violet-500`}>← All Raffles</Link>
          <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <section className="min-w-0">
              <article className={`overflow-hidden rounded-3xl border shadow-sm ${card}`}>
                <div className={`relative flex min-h-[260px] items-center justify-center overflow-hidden p-3 sm:min-h-[340px] sm:p-5 ${dark ? "bg-[#111018]" : "bg-zinc-100"}`}>
                  {banner ? <img src={banner} alt={`${raffle.project?.name ?? "Project"} banner`} className="max-h-[420px] w-full object-contain" loading="eager" decoding="async" /> : <div className="flex min-h-[260px] w-full items-center justify-center bg-[radial-gradient(circle_at_30%_20%,rgba(139,92,246,.35),transparent_35%),radial-gradient(circle_at_80%_80%,rgba(59,130,246,.22),transparent_40%)] p-10 text-center sm:min-h-[340px]"><span className="text-4xl font-black tracking-tight text-white/80 sm:text-6xl">{raffle.title}</span></div>}
                  <div className="absolute left-5 top-5 flex flex-wrap gap-2"><span className="rounded-full border border-white/15 bg-black/65 px-3 py-1.5 text-[9px] font-black tracking-[.16em] text-white backdrop-blur">{type}</span><span className={`rounded-full border px-3 py-1.5 text-[9px] font-black backdrop-blur ${statusTone}`}>{raffle.status}</span></div>
                </div>
                <div className="p-6 sm:p-8">
                  <div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><div className={`text-[9px] font-black tracking-[.2em] ${faint}`}>{raffle.project?.name ?? "Raven Oracle"}</div><h1 className="mt-2 break-words text-3xl font-semibold tracking-tight sm:text-5xl">{raffle.title}</h1></div>{raffle.project?.id && <Link href={`/projects/${raffle.project.id}`} className={`shrink-0 rounded-xl border px-3 py-2 text-xs font-bold ${soft}`}>View Project →</Link>}</div>
                  <p className={`mt-4 max-w-3xl text-sm leading-7 ${muted}`}>{raffle.description || "Complete the community tasks to enter this giveaway."}</p>
                  <div className="mt-7 grid gap-3 sm:grid-cols-4">
                    <div className={`rounded-2xl border p-4 ${soft}`}><span className={`text-[8px] font-black tracking-[.16em] ${faint}`}>PRIZE</span><b className="mt-2 block break-words text-lg">{raffle.prizeName}</b></div>
                    <div className={`rounded-2xl border p-4 ${soft}`}><span className={`text-[8px] font-black tracking-[.16em] ${faint}`}>WL SPOTS</span><b className="mt-2 block text-lg">{raffle.prizeQuantity}</b></div>
                    <div className={`rounded-2xl border p-4 ${soft}`}><span className={`text-[8px] font-black tracking-[.16em] ${faint}`}>{type === "FCFS" ? "FORMAT" : "WINNERS"}</span><b className="mt-2 block text-lg">{type === "FCFS" ? "First eligible" : raffle.winnerCount ?? 1}</b></div>
                    <div className={`rounded-2xl border p-4 ${soft}`}><span className={`text-[8px] font-black tracking-[.16em] ${faint}`}>ENDS IN</span><b className="mt-2 block text-lg">{countdown(raffle.endsAt)}</b></div>
                  </div>
                </div>
              </article>

              <section className={`mt-6 rounded-3xl border p-6 shadow-sm sm:p-7 ${card}`}>
                <div className="flex flex-wrap items-end justify-between gap-4"><div><div className={`text-[9px] font-black tracking-[.2em] ${faint}`}>01 · COMMUNITY TASKS</div><h2 className="mt-2 text-2xl font-semibold">Complete the requirements</h2></div><span className={`text-xs font-semibold ${muted}`}>{verifiedRequired}/{required.length} required</span></div>
                {!entry && canEnter && <div className={`mt-5 rounded-2xl border p-4 ${soft}`}><b className="text-sm">Ready to enter?</b><p className={`mt-1 text-xs ${muted}`}>Start your entry, complete each required task, then submit your payout wallet.</p><button onClick={() => void startEntry()} disabled={busy} className="mt-3 rounded-xl bg-violet-600 px-5 py-3 text-xs font-black text-white shadow-lg shadow-violet-500/20 disabled:opacity-50">{busy ? "Starting…" : "Enter Giveaway"}</button></div>}
                {message && <div className={`mt-5 rounded-2xl border p-4 text-xs ${dark ? "border-white/10 bg-white/[.03] text-zinc-300" : "border-violet-200 bg-violet-50 text-violet-900"}`}>{message}</div>}
                <div className="mt-6 space-y-3">
                  {tasks.map((task) => { const result = results[task.id]; const which = provider(task.type); const isConnected = connected(which); return <div key={task.id} className={`rounded-2xl border p-4 transition ${result?.verified ? "border-emerald-500/30 bg-emerald-500/5" : soft}`}><div className="flex items-center gap-4"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-violet-500/10 text-lg text-violet-500">{taskIcon(task.type)}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><b className="text-sm">{taskLabel(task.type)}</b>{task.isRequired && <span className="rounded-full bg-violet-500/10 px-2 py-1 text-[7px] font-black tracking-[.12em] text-violet-600 dark:text-violet-300">REQUIRED</span>}</div><p className={`mt-1 break-all text-xs ${muted}`}>{task.type === "X_FOLLOW" ? `@${task.target.replace(/^@/, "")}` : task.target}</p>{result?.reason && !result.verified && <p className="mt-2 text-[10px] text-red-500">{result.reason}</p>}</div><div className="shrink-0">{result?.verified ? <span className="text-xs font-bold text-emerald-500">✓ Verified</span> : !isConnected ? <button onClick={() => void connectSocial(which.toLowerCase() as "x" | "discord")} disabled={busy} className="rounded-lg bg-violet-600 px-3 py-2 text-[9px] font-black text-white disabled:opacity-50">Connect {which === "X" ? "X" : "Discord"}</button> : <button onClick={() => void verifyTask(task)} disabled={busy || !entry} className={`rounded-lg border px-3 py-2 text-[9px] font-black ${dark ? "border-violet-400/30 text-violet-300" : "border-violet-300 text-violet-700"} disabled:opacity-40`}>{task.targetUrl ? "Open task" : "Verify"}</button>}</div></div></div>; })}
                </div>
                {tasks.length === 0 && <div className={`mt-5 rounded-2xl border border-dashed p-10 text-center text-sm ${muted}`}>No tasks have been configured for this giveaway.</div>}
              </section>
            </section>

            <aside className="lg:sticky lg:top-6 lg:self-start"><section className={`rounded-3xl border p-6 shadow-sm ${card}`}><div className={`text-[9px] font-black tracking-[.2em] ${faint}`}>02 · FINAL ENTRY</div><h2 className="mt-2 text-2xl font-semibold">Secure your spot</h2><p className={`mt-2 text-xs leading-5 ${muted}`}>Complete every required task, then submit the payout wallet for your prize.</p>
              <div className="mt-5 space-y-2"><div className={`flex items-center justify-between rounded-xl border p-3 ${soft}`}><span className={`text-xs ${muted}`}>Entry</span><b className={entry ? "text-emerald-500" : faint}>{entry ? "Started" : "Not entered"}</b></div><div className={`flex items-center justify-between rounded-xl border p-3 ${soft}`}><span className={`text-xs ${muted}`}>Required tasks</span><b className={allRequiredVerified ? "text-emerald-500" : muted}>{verifiedRequired}/{required.length}</b></div><div className={`flex items-center justify-between rounded-xl border p-3 ${soft}`}><span className={`text-xs ${muted}`}>X account</span><b className={connected("X") ? "text-emerald-500" : muted}>{connected("X") ? "Connected" : "Needed if required"}</b></div><div className={`flex items-center justify-between rounded-xl border p-3 ${soft}`}><span className={`text-xs ${muted}`}>Discord</span><b className={connected("DISCORD") ? "text-emerald-500" : muted}>{connected("DISCORD") ? "Connected" : "Needed if required"}</b></div></div>
              {!entry && <button onClick={() => void startEntry()} disabled={busy || !canEnter} className="mt-5 w-full rounded-xl bg-violet-600 px-5 py-3.5 text-xs font-black text-white shadow-lg shadow-violet-500/20 disabled:opacity-40">{busy ? "Starting…" : canEnter ? "Enter Giveaway" : raffle.status === "SCHEDULED" ? `Starts in ${countdown(raffle.startsAt)}` : "Entry closed"}</button>}
              {entry && allRequiredVerified && !confirmed && <div className={`mt-5 rounded-2xl border p-4 ${soft}`}><div className="text-[9px] font-black tracking-[.16em] text-violet-600 dark:text-violet-300">PAYOUT WALLET</div><p className={`mt-1 text-xs ${muted}`}>No wallet connection required. Paste the address where the prize should be sent.</p><div className="mt-4 grid grid-cols-2 gap-2"><button type="button" onClick={() => setChain("EVM")} className={`rounded-lg border px-3 py-2 text-[9px] font-black ${chain === "EVM" ? "border-violet-600 bg-violet-600 text-white" : input}`}>EVM</button><button type="button" onClick={() => setChain("SOLANA")} className={`rounded-lg border px-3 py-2 text-[9px] font-black ${chain === "SOLANA" ? "border-violet-600 bg-violet-600 text-white" : input}`}>SOLANA</button></div><input value={address} onChange={(event) => setAddress(event.target.value)} placeholder={chain === "EVM" ? "0x…" : "Solana address…"} className={`mt-3 w-full rounded-xl border px-3 py-3 text-xs outline-none focus:border-violet-500 ${input}`} /><button onClick={() => void addAndAttachWallet()} disabled={busy || !address.trim()} className="mt-3 w-full rounded-xl bg-violet-600 px-4 py-3 text-xs font-black text-white disabled:opacity-40">Submit Wallet</button>{wallets.length > 0 && <><div className={`my-3 text-center text-[9px] ${faint}`}>or use saved wallet</div><select value={walletId} onChange={(event) => setWalletId(event.target.value)} className={`w-full rounded-xl border px-3 py-3 text-xs outline-none ${input}`}>{wallets.map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.address.slice(0, 7)}…{wallet.address.slice(-5)} · {wallet.chain}</option>)}</select><button onClick={() => void attachExistingWallet()} disabled={busy || !walletId} className="mt-3 w-full rounded-xl border border-violet-500/30 px-4 py-3 text-xs font-black text-violet-600 dark:text-violet-300 disabled:opacity-40">Use Saved Wallet</button></>}</div>}
              {confirmed && <div className="mt-5 rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-4"><div className="text-xs font-black text-emerald-600 dark:text-emerald-400">✓ Entry confirmed</div><p className={`mt-1 text-xs ${muted}`}>Your tasks and payout wallet passed the current eligibility checks.</p></div>}
            </section></aside>
          </div>
        </div>
      </RaffleCaptchaGate>
    </main>
  );
}
