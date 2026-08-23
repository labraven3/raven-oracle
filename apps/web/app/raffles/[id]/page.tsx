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
type Raffle = { id: string; title: string; description?: string | null; prizeName: string; prizeDescription?: string | null; prizeQuantity: number; startsAt: string; endsAt: string; status: string; winnerCount?: number; entryRules?: unknown; project?: { id?: string; name?: string | null; logoUrl?: string | null } | null };
type Task = { id: string; type: "DISCORD_JOIN" | "X_FOLLOW" | "X_LIKE" | "X_REPOST"; title: string; description?: string | null; target: string; targetUrl?: string | null; isRequired: boolean };
type TaskResult = { taskId: string; type: Task["type"]; title: string; required: boolean; verified: boolean; reason?: string | null };
type EntryDetails = { id: string; status: string; walletAddressSnapshot?: string | null; captchaPassed?: boolean | null; eligibilityReasons?: unknown; riskLevel?: string | null; enteredAt: string; walletAddress?: { id?: string; chain: string; network: string; address?: string } | null };

async function api<T>(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers, credentials: "include", cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message ?? `Request failed (${response.status})`);
  return data as T;
}

function icon(type: Task["type"]) { return type === "DISCORD_JOIN" ? "◈" : type === "X_FOLLOW" ? "𝕏" : type === "X_LIKE" ? "♡" : "↻"; }
function provider(type: Task["type"]): "X" | "DISCORD" { return type === "DISCORD_JOIN" ? "DISCORD" : "X"; }
function label(type: Task["type"]) { return type === "DISCORD_JOIN" ? "Join Discord" : type === "X_FOLLOW" ? "Follow on X" : type === "X_LIKE" ? "Like on X" : "Repost on X"; }
function countdown(value: string) { const ms = new Date(value).getTime() - Date.now(); if (ms <= 0) return "Now"; const minutes = Math.floor(ms / 60000); if (minutes >= 1440) return `${Math.floor(minutes / 1440)}d ${Math.floor((minutes % 1440) / 60)}h`; return `${Math.floor(minutes / 60)}h ${minutes % 60}m`; }
function hasCaptcha(value: unknown) { return !!value && typeof value === "object" && !Array.isArray(value) && (value as Record<string, unknown>).captchaRequired === true; }

export default function RafflePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const dark = theme === "dark";
  const page = dark ? "bg-[#06060a] text-zinc-100" : "bg-[#f7f8fb] text-zinc-900";
  const card = dark ? "border-white/10 bg-[#0d0c11]" : "border-zinc-200 bg-white";
  const soft = dark ? "border-white/10 bg-white/[.025]" : "border-zinc-200 bg-zinc-50";
  const muted = dark ? "text-zinc-500" : "text-zinc-600";
  const faint = dark ? "text-zinc-600" : "text-zinc-500";

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
      setUser(null); setSocials([]); setWallets([]); setWalletId("");
    }
  }, []);

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
      } catch { setEntry(null); }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load raffle");
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { void Promise.all([loadAccount(), loadRaffle()]); }, [loadAccount, loadRaffle]);

  const required = useMemo(() => tasks.filter((task) => task.isRequired), [tasks]);
  const verifiedRequired = required.filter((task) => results[task.id]?.verified).length;
  const allRequiredVerified = required.length > 0 && verifiedRequired === required.length;
  const canEnter = raffle?.status === "ACTIVE" && Date.now() >= new Date(raffle.startsAt).getTime() && Date.now() <= new Date(raffle.endsAt).getTime();
  const connected = (p: "X" | "DISCORD") => socials.some((social) => social.provider === p && social.isActive !== false);
  const captchaRequired = hasCaptcha(raffle?.entryRules);
  const confirmed = entry?.status === "ELIGIBLE" && Boolean(entry.walletAddressSnapshot);

  const requireLogin = () => router.push(`/login?next=${encodeURIComponent(`/raffles/${id}`)}`);

  const connectSocial = async (p: "x" | "discord") => {
    if (!user) return requireLogin();
    try {
      const returnTo = `/raffles/${id}`;
      const data = await api<{ authorizationUrl: string }>(`/auth/${p}/start?returnTo=${encodeURIComponent(returnTo)}`);
      window.location.href = data.authorizationUrl;
    } catch (error) { setMessage(error instanceof Error ? error.message : `Unable to connect ${p}`); }
  };

  const startEntry = async () => {
    if (!user) return requireLogin();
    if (!canEnter) return setMessage(raffle?.status === "SCHEDULED" ? `Starts in ${countdown(raffle.startsAt)}.` : "This raffle is not accepting entries.");
    if (entry) return entry;
    setBusy(true);
    try {
      const data = await api<{ entry: EntryDetails }>(`/raffles/${id}/entries`, { method: "POST", body: JSON.stringify({}) });
      setEntry(data.entry);
      setMessage("Entry started. Complete every required task below.");
      return data.entry;
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to start raffle entry"); return null; }
    finally { setBusy(false); }
  };

  const refreshVerification = async () => {
    if (!user || !entry) return;
    try {
      const data = await api<{ allRequiredTasksVerified: boolean; tasks: TaskResult[]; entry: EntryDetails }>(`/raffles/${id}/entries/me/verify-tasks`, { method: "POST" });
      const next: Record<string, TaskResult> = {};
      for (const result of data.tasks ?? []) next[result.taskId] = result;
      setResults(next); setEntry(data.entry);
      if (data.allRequiredTasksVerified && data.entry.status === "ELIGIBLE") setMessage("All tasks verified. Your entry is eligible.");
      else if (data.allRequiredTasksVerified) setMessage("All tasks verified. Submit your payout wallet to finish entry.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Verification refresh failed"); }
  };

  const verifyTask = async (task: Task) => {
    if (!user) return requireLogin();
    if (!entry) return setMessage("Click Enter Raffle first, then complete the required tasks.");
    if (task.targetUrl) window.open(task.targetUrl, "_blank", "noopener,noreferrer");
    setBusy(true);
    try {
      const data = await api<{ verified?: boolean; result?: { verified: boolean; reason?: string | null }; reason?: string | null }>(`/raffles/${id}/tasks/${task.id}/verify`, { method: "POST" });
      const verified = data.verified === true || data.result?.verified === true;
      setResults((current) => ({ ...current, [task.id]: { taskId: task.id, type: task.type, title: task.title, required: task.isRequired, verified, reason: data.reason ?? data.result?.reason ?? null } }));
    } catch (error) {
      setResults((current) => ({ ...current, [task.id]: { taskId: task.id, type: task.type, title: task.title, required: task.isRequired, verified: false, reason: error instanceof Error ? error.message : "Verification failed" } }));
    } finally { setBusy(false); }
    await refreshVerification();
  };

  const addAndAttachWallet = async () => {
    if (!user) return requireLogin();
    if (!entry) return setMessage("Enter the raffle first.");
    if (!allRequiredVerified) return setMessage("Complete all required tasks first.");
    if (captchaRequired && entry?.captchaPassed !== true) return setMessage("Complete the CAPTCHA above before submitting your wallet.");
    if (!address.trim()) return setMessage("Paste your payout wallet address.");
    setBusy(true);
    try {
      const created = await api<{ wallet: Wallet }>("/wallets/", { method: "POST", body: JSON.stringify({ address: address.trim(), chain }) });
      const attached = await api<{ entry: EntryDetails }>(`/raffles/${id}/entries/me/wallet`, { method: "PATCH", body: JSON.stringify({ walletAddressId: created.wallet.id }) });
      setWallets((items) => [created.wallet, ...items]);
      setWalletId(created.wallet.id); setAddress(""); setEntry(attached.entry);
      setMessage("Wallet submitted. Running final eligibility checks…");
      await refreshVerification();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to submit wallet"); }
    finally { setBusy(false); }
  };

  const attachExistingWallet = async () => {
    if (!user || !walletId) return;
    if (!entry) return setMessage("Enter the raffle first.");
    if (!allRequiredVerified) return setMessage("Complete all required tasks first.");
    if (captchaRequired && entry?.captchaPassed !== true) return setMessage("Complete the CAPTCHA above before submitting your wallet.");
    setBusy(true);
    try {
      const attached = await api<{ entry: EntryDetails }>(`/raffles/${id}/entries/me/wallet`, { method: "PATCH", body: JSON.stringify({ walletAddressId: walletId }) });
      setEntry(attached.entry); setMessage("Wallet submitted. Running final eligibility checks…"); await refreshVerification();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to submit wallet"); }
    finally { setBusy(false); }
  };

  if (loading) return <main className={`min-h-screen ${page}`}><SiteHeader /><div className={`mx-auto max-w-6xl p-10 ${muted}`}>Loading raffle…</div></main>;
  if (!raffle) return <main className={`min-h-screen ${page}`}><SiteHeader /><div className={`mx-auto max-w-2xl px-5 py-20 ${muted}`}>{message || "Raffle not found"}</div></main>;

  return <main className={`min-h-screen ${page}`}>
    <SiteHeader />
    <RaffleCaptchaGate raffleId={id}>
      <div className="mx-auto max-w-6xl px-5 py-8 sm:py-10">
        <Link href="/raffles" className={`text-xs ${muted} hover:text-violet-500`}>← All Raffles</Link>
        <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_370px]">
          <section>
            <div className={`overflow-hidden rounded-3xl border ${card}`}>
              <div className="relative min-h-[260px] bg-[radial-gradient(circle_at_70%_30%,rgba(139,92,246,.25),transparent_45%),radial-gradient(circle_at_20%_80%,rgba(59,130,246,.14),transparent_40%)] p-7 sm:p-9">
                <div className="flex items-start justify-between gap-4"><span className="rounded-full bg-violet-500/10 px-3 py-1 text-[9px] font-black tracking-[.18em] text-violet-400">NFT RAFFLE</span><span className={`rounded-full border px-3 py-1 text-[9px] font-black ${raffle.status === "ACTIVE" ? "border-emerald-500/30 text-emerald-400" : "border-white/10 text-zinc-400"}`}>{raffle.status}</span></div>
                <h1 className="mt-8 max-w-3xl text-3xl font-semibold tracking-tight sm:text-5xl">{raffle.title}</h1>
                <p className={`mt-4 max-w-2xl text-sm leading-7 ${muted}`}>{raffle.description || "Complete the verified community tasks to enter this raffle."}</p>
                {raffle.project && <Link href={`/projects/${raffle.project.id}`} className={`mt-7 inline-flex items-center gap-3 rounded-xl border px-3 py-2.5 ${soft}`}><div className="grid h-9 w-9 place-items-center overflow-hidden rounded-lg bg-black/20">{raffle.project.logoUrl ? <img src={raffle.project.logoUrl} alt="" className="h-full w-full object-cover" /> : "R"}</div><div><span className={`block text-[8px] uppercase tracking-[.15em] ${faint}`}>Project</span><b className="block text-xs">{raffle.project.name}</b></div></Link>}
              </div>
              <div className={`grid border-t sm:grid-cols-3 ${dark ? "border-white/10" : "border-zinc-200"}`}>
                <div className={`p-5 ${soft}`}><span className={`text-[8px] font-black tracking-[.16em] ${faint}`}>PRIZE</span><b className="mt-2 block text-lg">{raffle.prizeName}</b><span className={`text-xs ${muted}`}>{raffle.prizeQuantity} available</span></div>
                <div className={`border-t p-5 sm:border-l sm:border-t-0 ${dark ? "border-white/10" : "border-zinc-200"}`}><span className={`text-[8px] font-black tracking-[.16em] ${faint}`}>WINNERS</span><b className="mt-2 block text-lg">{raffle.winnerCount ?? 1}</b></div>
                <div className={`border-t p-5 sm:border-l sm:border-t-0 ${dark ? "border-white/10" : "border-zinc-200"}`}><span className={`text-[8px] font-black tracking-[.16em] ${faint}`}>ENDS</span><b className="mt-2 block text-lg">{countdown(raffle.endsAt)}</b></div>
              </div>
            </div>

            <div className={`mt-6 rounded-3xl border p-6 sm:p-7 ${card}`}>
              <div className="flex items-end justify-between gap-4"><div><span className={`text-[9px] font-black tracking-[.2em] ${faint}`}>01 · COMMUNITY TASKS</span><h2 className="mt-2 text-2xl font-semibold">Complete the requirements</h2></div><span className={`text-xs ${muted}`}>{verifiedRequired}/{required.length} required</span></div>
              {!entry && canEnter && <div className="mt-5 rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4"><b className="text-sm">Ready to enter?</b><p className={`mt-1 text-xs ${muted}`}>Click Enter Raffle to create your entry. You can then complete the tasks below.</p><button onClick={() => void startEntry()} disabled={busy} className="mt-3 w-full rounded-xl bg-violet-500 px-5 py-3 text-xs font-black text-white disabled:opacity-50">{busy ? "Entering…" : "Enter Raffle"}</button></div>}
              <div className="mt-6 space-y-3">
                {tasks.map((task) => {
                  const result = results[task.id];
                  const p = provider(task.type);
                  const isConnected = connected(p);
                  return <div key={task.id} className={`rounded-2xl border p-4 transition ${result?.verified ? "border-emerald-500/30 bg-emerald-500/5" : dark ? "border-white/10 bg-black/10" : "border-zinc-200 bg-zinc-50"}`}>
                    <div className="flex items-center gap-4"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-violet-500/10 text-lg text-violet-400">{icon(task.type)}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><b className="text-sm">{task.title}</b>{task.isRequired && <span className="text-[8px] font-black tracking-[.12em] text-violet-400">REQUIRED</span>}</div><p className={`mt-1 text-xs ${faint}`}>{task.description || label(task.type)} · {task.target}</p>{result?.reason && !result.verified && <p className="mt-2 text-[10px] text-red-400">{result.reason}</p>}</div>{result?.verified ? <span className="shrink-0 text-xs font-bold text-emerald-400">✓ Verified</span> : !isConnected ? <button onClick={() => connectSocial(p.toLowerCase() as "x" | "discord")} disabled={busy} className="shrink-0 rounded-lg bg-violet-500 px-3 py-2 text-[9px] font-black text-white">Connect {p === "X" ? "X" : "Discord"}</button> : <button onClick={() => void verifyTask(task)} disabled={busy || !entry} className="shrink-0 rounded-lg border border-violet-500/30 px-3 py-2 text-[9px] font-black text-violet-400 hover:bg-violet-500/10 disabled:opacity-40">{entry ? (task.targetUrl ? "Open & verify" : "Verify") : "Enter raffle first"}</button>}</div>
                  </div>;
                })}
              </div>
              {tasks.length === 0 && <div className={`mt-5 rounded-xl border border-dashed p-8 text-center text-sm ${muted}`}>No tasks have been configured for this raffle.</div>}
            </div>
          </section>

          <aside className="lg:sticky lg:top-6 lg:self-start">
            <div className={`rounded-3xl border p-6 ${card}`}>
              <span className={`text-[9px] font-black tracking-[.2em] ${faint}`}>02 · FINAL ENTRY</span>
              <h2 className="mt-2 text-2xl font-semibold">Secure your spot</h2>
              <p className={`mt-2 text-xs leading-5 ${muted}`}>{entry ? "Finish the tasks, then paste the wallet address where your prize should be sent." : "Enter the raffle first, then complete the required tasks."}</p>

              <div className="mt-6 space-y-3">
                <div className={`flex items-center justify-between rounded-xl border p-3 ${soft}`}><span className={`text-xs ${muted}`}>Entry</span><b className={entry ? "text-emerald-400" : "text-zinc-500"}>{entry ? "Started" : "Not entered"}</b></div>
                <div className={`flex items-center justify-between rounded-xl border p-3 ${soft}`}><span className={`text-xs ${muted}`}>Required tasks</span><b className={allRequiredVerified ? "text-emerald-400" : "text-zinc-400"}>{verifiedRequired}/{required.length}</b></div>
                <div className={`flex items-center justify-between rounded-xl border p-3 ${soft}`}><span className={`text-xs ${muted}`}>X account</span><b className={connected("X") ? "text-emerald-400" : "text-zinc-500"}>{connected("X") ? "Connected" : "Needed"}</b></div>
                <div className={`flex items-center justify-between rounded-xl border p-3 ${soft}`}><span className={`text-xs ${muted}`}>Discord</span><b className={connected("DISCORD") ? "text-emerald-400" : "text-zinc-500"}>{connected("DISCORD") ? "Connected" : "Needed if required"}</b></div>
              </div>

              {!entry && <div className="mt-5"><button onClick={() => void startEntry()} disabled={busy || !canEnter} className="w-full rounded-xl bg-violet-500 px-5 py-3 text-xs font-black text-white disabled:opacity-40">{busy ? "Entering…" : canEnter ? "Enter Raffle" : raffle.status === "SCHEDULED" ? `Starts in ${countdown(raffle.startsAt)}` : "Entry closed"}</button></div>}

              {entry && allRequiredVerified && !confirmed && <div className="mt-5 rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4"><div className="text-[9px] font-black tracking-[.16em] text-violet-400">WALLET SUBMISSION</div><p className={`mt-1 text-xs ${muted}`}>No wallet connection is required. Paste the payout address below.</p><div className="mt-4 grid grid-cols-2 gap-2"><button onClick={() => setChain("EVM")} className={`rounded-lg border px-3 py-2 text-[9px] font-black ${chain === "EVM" ? "border-violet-500 bg-violet-500 text-white" : "border-white/10 text-zinc-400"}`}>EVM</button><button onClick={() => setChain("SOLANA")} className={`rounded-lg border px-3 py-2 text-[9px] font-black ${chain === "SOLANA" ? "border-violet-500 bg-violet-500 text-white" : "border-white/10 text-zinc-400"}`}>SOLANA</button></div><input value={address} onChange={(e) => setAddress(e.target.value)} placeholder={chain === "EVM" ? "0x…" : "Solana address…"} className={`mt-3 w-full rounded-xl border bg-transparent px-3 py-3 text-xs outline-none focus:border-violet-500 ${dark ? "border-white/10" : "border-zinc-200"}`} /><button onClick={() => void addAndAttachWallet()} disabled={busy || !address.trim()} className="mt-3 w-full rounded-xl bg-violet-500 px-4 py-3 text-xs font-black text-white disabled:opacity-40">Submit Wallet & Enter</button>{wallets.length > 0 && <><div className={`my-3 text-center text-[9px] ${faint}`}>or use saved wallet</div><select value={walletId} onChange={(e) => setWalletId(e.target.value)} className={`w-full rounded-xl border bg-transparent px-3 py-3 text-xs outline-none ${dark ? "border-white/10" : "border-zinc-200"}`}>{wallets.map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.chain} · {wallet.address.slice(0, 8)}…{wallet.address.slice(-6)}</option>)}</select><button onClick={() => void attachExistingWallet()} disabled={busy || !walletId} className="mt-2 w-full rounded-xl border border-violet-500/30 px-4 py-3 text-xs font-black text-violet-400 disabled:opacity-40">Use Saved Wallet</button></>}</div>}

              {confirmed && <div className="mt-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4"><b className="text-sm text-emerald-400">✓ Entry confirmed</b><p className={`mt-1 text-xs ${muted}`}>Your tasks and payout wallet passed the current eligibility checks.</p></div>}
              {entry?.walletAddressSnapshot && !confirmed && <div className={`mt-5 rounded-xl border p-3 ${soft}`}><span className={`block text-[8px] font-black tracking-[.15em] ${faint}`}>PAYOUT WALLET</span><span className="mt-1 block truncate text-xs">{entry.walletAddressSnapshot}</span></div>}
              {message && <div className="mt-4 rounded-xl border border-violet-500/20 bg-violet-500/5 p-3 text-xs text-violet-300">{message}</div>}
            </div>
          </aside>
        </div>
      </div>
    </RaffleCaptchaGate>
  </main>;
}
