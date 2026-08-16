"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

type User = { id: string; email: string; displayName?: string | null; username?: string | null };
type Social = { provider: "X" | "DISCORD"; providerUsername?: string | null; displayName?: string | null };
type Wallet = { id: string; address: string; chain: "EVM" | "SOLANA"; network: string; status?: string };
type Project = { id?: string; name?: string | null; description?: string | null; websiteUrl?: string | null; xUrl?: string | null; discordUrl?: string | null; logoUrl?: string | null; category?: string };
type Raffle = { id: string; title: string; description?: string | null; prizeName: string; prizeDescription?: string | null; prizeQuantity: number; startsAt: string; endsAt: string; status: string; project?: Project | null };
type Task = { id: string; type: "DISCORD_JOIN" | "X_FOLLOW" | "X_LIKE" | "X_REPOST"; title: string; description?: string | null; target: string; targetUrl?: string | null; isRequired: boolean; sortOrder: number };
type TaskResult = { taskId: string; type: Task["type"]; title: string; required: boolean; verified: boolean; reason?: string | null };

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("raven_token");
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }
  const response = await fetch(`${API}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message ?? `Request failed (${response.status})`);
  return data as T;
}

function shortAddress(value: string) { return value.length > 16 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value; }
function taskIcon(type: Task["type"]) { return type === "DISCORD_JOIN" ? "◈" : type === "X_FOLLOW" ? "𝕏" : type === "X_LIKE" ? "♡" : "↻"; }
function taskLabel(type: Task["type"]) { return type === "DISCORD_JOIN" ? "Discord" : type === "X_FOLLOW" ? "X follow" : type === "X_LIKE" ? "X like" : "X repost"; }

export default function RafflePage() {
  const params = useParams<{ id: string }>();
  const raffleId = params.id;
  const [raffle, setRaffle] = useState<Raffle | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [entry, setEntry] = useState<any>(null);
  const [results, setResults] = useState<Record<string, TaskResult>>({});
  const [user, setUser] = useState<User | null>(null);
  const [socials, setSocials] = useState<Social[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [walletId, setWalletId] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [walletChain, setWalletChain] = useState<"EVM" | "SOLANA">("EVM");
  const [modal, setModal] = useState<"login" | "wallet" | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const loadAccount = useCallback(async () => {
    if (!localStorage.getItem("raven_token")) return;
    try {
      const [me, social, wallet] = await Promise.all([
        api<{ user: User }>("/auth/me"),
        api<{ accounts: Social[] }>("/social-accounts/"),
        api<{ wallets: Wallet[] }>("/wallets/"),
      ]);
      setUser(me.user);
      setSocials(social.accounts);
      setWallets(wallet.wallets.filter((w) => w.status !== "DELETED"));
      setWalletId((current) => current || wallet.wallets.find((w) => w.status !== "DELETED")?.id || "");
    } catch {
      localStorage.removeItem("raven_token");
      setUser(null);
    }
  }, []);

  const loadRaffle = useCallback(async () => {
    if (!raffleId) return;
    setLoading(true);
    try {
      const [detail, taskData] = await Promise.all([
        api<{ raffle: Raffle }>(`/raffles/${raffleId}`),
        api<{ tasks: Task[] }>(`/raffles/${raffleId}/tasks`),
      ]);
      setRaffle(detail.raffle);
      setTasks(taskData.tasks);
      if (localStorage.getItem("raven_token")) {
        const mine = await api<{ entry: any }>(`/raffles/${raffleId}/entries/me`).catch(() => null);
        if (mine?.entry) setEntry(mine.entry);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load raffle");
    } finally { setLoading(false); }
  }, [raffleId]);

  useEffect(() => { void loadAccount(); void loadRaffle(); }, [loadAccount, loadRaffle]);

  const connected = (provider: "X" | "DISCORD") => socials.some((account) => account.provider === provider);
  const requiredTasks = useMemo(() => tasks.filter((task) => task.isRequired), [tasks]);
  const verifiedRequired = requiredTasks.filter((task) => results[task.id]?.verified).length;
  const allVerified = requiredTasks.length > 0 && verifiedRequired === requiredTasks.length;
  const ended = raffle ? new Date(raffle.endsAt).getTime() <= Date.now() : false;

  const login = async () => {
    if (!loginEmail.trim()) return setMessage("Enter your Raven Oracle email.");
    setBusy(true); setMessage("");
    try {
      const data = await api<{ token: string; user: User }>("/auth/login", { method: "POST", body: JSON.stringify({ email: loginEmail.trim() }) });
      localStorage.setItem("raven_token", data.token);
      setUser(data.user); setModal(null); setLoginEmail(""); await loadAccount();
      const mine = await api<{ entry: any }>(`/raffles/${raffleId}/entries/me`).catch(() => null);
      if (mine?.entry) setEntry(mine.entry);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Login failed"); }
    finally { setBusy(false); }
  };

  const connectSocial = async (provider: "x" | "discord") => {
    if (!user) return setModal("login");
    try {
      const data = await api<{ authorizationUrl: string }>(`/auth/${provider}/start`);
      window.location.href = data.authorizationUrl;
    } catch (error) { setMessage(error instanceof Error ? error.message : `Unable to connect ${provider}`); }
  };

  const addWallet = async () => {
    if (!walletAddress.trim()) return setMessage("Enter a wallet address.");
    setBusy(true);
    try {
      const data = await api<{ wallet: Wallet }>("/wallets/", { method: "POST", body: JSON.stringify({ address: walletAddress.trim(), chain: walletChain }) });
      setWallets((current) => [data.wallet, ...current]); setWalletId(data.wallet.id); setWalletAddress(""); setModal(null);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to add wallet"); }
    finally { setBusy(false); }
  };

  const enter = async () => {
    if (!raffle || ended) return;
    if (!user) return setModal("login");
    if (!walletId) return setModal("wallet");
    setBusy(true); setMessage("");
    try {
      const data = await api<{ entry: any }>(`/raffles/${raffle.id}/entries`, { method: "POST", body: JSON.stringify({ walletAddressId: walletId }) });
      setEntry(data.entry);
      setMessage("Entry created. Now verify every requirement below.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to enter raffle"); }
    finally { setBusy(false); }
  };

  const verifyTask = async (task: Task) => {
    if (!user || !entry) return setMessage("Enter the raffle first.");
    try {
      const result = await api<{ verified?: boolean; reason?: string | null }>(`/raffles/${raffleId}/tasks/${task.id}/verify`, { method: "POST" });
      setResults((current) => ({ ...current, [task.id]: { taskId: task.id, type: task.type, title: task.title, required: task.isRequired, verified: result.verified === true, reason: result.reason ?? null } }));
    } catch (error) {
      setResults((current) => ({ ...current, [task.id]: { taskId: task.id, type: task.type, title: task.title, required: task.isRequired, verified: false, reason: error instanceof Error ? error.message : "Verification failed" } }));
    }
  };

  const verifyAll = async () => {
    if (!user) return setModal("login");
    if (!entry) return setMessage("Enter the raffle before verifying requirements.");
    setBusy(true); setMessage("");
    try {
      const result = await api<{ eligible?: boolean; tasks?: TaskResult[] }>(`/raffles/${raffleId}/entries/me/verify`, { method: "POST" });
      const next: Record<string, TaskResult> = {};
      for (const item of result.tasks ?? []) next[item.taskId] = item;
      setResults(next);
      setEntry((current: any) => current ? { ...current, socialVerifiedAtEntry: result.eligible === true } : current);
      setMessage(result.eligible ? "All required requirements are verified. You are eligible." : "Some required requirements still need to be completed.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Verification failed"); }
    finally { setBusy(false); }
  };

  if (loading) return <main className="min-h-screen bg-[#07070a] p-10 text-zinc-500">Loading raffle…</main>;
  if (!raffle) return <main className="min-h-screen bg-[#07070a] p-10 text-zinc-400"><a href="/" className="text-violet-300">← Back</a><div className="mx-auto mt-20 max-w-xl rounded-2xl border border-red-900/40 bg-red-950/10 p-8">{message || "Raffle not found"}</div></main>;

  return <main className="min-h-screen bg-[#07070a] text-zinc-100">
    <header className="border-b border-white/10 bg-[#07070a]/90 backdrop-blur"><div className="mx-auto flex min-h-[72px] max-w-6xl items-center justify-between px-5"><a href="/" className="font-black tracking-[.18em]">RAVEN ORACLE</a><button onClick={() => user ? setModal("wallet") : setModal("login")} className="rounded-lg border border-white/10 px-4 py-2 text-xs font-bold">{user ? (user.username ?? user.email) : "Connect account"}</button></div></header>
    <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 lg:grid-cols-[1fr_380px]">
      <section>
        <a href="/" className="text-xs text-zinc-600 hover:text-zinc-300">← Back to raffles</a>
        <div className="mt-6 rounded-3xl border border-white/10 bg-[#0d0c11] p-7 sm:p-9">
          <div className="flex items-start justify-between gap-5"><div><span className="text-[9px] font-black tracking-[.2em] text-violet-300/60">COMMUNITY GIVEAWAY</span><h1 className="mt-3 text-4xl font-medium tracking-tight sm:text-5xl">{raffle.title}</h1><p className="mt-3 text-sm leading-6 text-zinc-500">{raffle.description || "Complete the verified requirements below to enter this community raffle."}</p></div><span className="rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1 text-[9px] font-black text-emerald-300">{raffle.status}</span></div>
          <div className="mt-8 rounded-2xl border border-white/10 bg-black/20 p-6"><span className="text-[9px] tracking-[.18em] text-zinc-600">PRIZE</span><div className="mt-2 text-2xl font-bold">{raffle.prizeName}</div>{raffle.prizeDescription && <p className="mt-2 text-sm text-zinc-500">{raffle.prizeDescription}</p>}<div className="mt-5 flex gap-5 text-xs text-zinc-500"><span>{raffle.prizeQuantity} prize{raffle.prizeQuantity === 1 ? "" : "s"}</span><span>Ends {new Date(raffle.endsAt).toLocaleString()}</span></div></div>
          {raffle.project && <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-white/10 p-4"><span className="text-[9px] tracking-[.18em] text-zinc-600">PROJECT</span><b>{raffle.project.name}</b>{raffle.project.websiteUrl && <a href={raffle.project.websiteUrl} target="_blank" rel="noreferrer" className="text-xs text-violet-300">Website ↗</a>}</div>}
        </div>
        <div className="mt-6 rounded-3xl border border-white/10 bg-[#0d0c11] p-7 sm:p-9"><div className="flex items-end justify-between"><div><span className="text-[9px] font-black tracking-[.2em] text-zinc-600">ELIGIBILITY</span><h2 className="mt-2 text-2xl">Complete requirements</h2></div><span className="text-xs text-zinc-500">{verifiedRequired}/{requiredTasks.length} required</span></div>
          {tasks.length === 0 ? <div className="mt-7 rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-zinc-600">No verification tasks have been configured for this raffle.</div> : <div className="mt-7 space-y-3">{tasks.map((task) => { const state = results[task.id]; return <div key={task.id} className={`rounded-xl border p-4 ${state?.verified ? "border-emerald-500/30 bg-emerald-500/[.04]" : "border-white/10 bg-black/10"}`}><div className="flex items-center gap-4"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white/[.04] text-lg">{taskIcon(task.type)}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><b className="text-sm">{task.title}</b>{task.isRequired && <span className="text-[8px] font-black tracking-wider text-violet-300">REQUIRED</span>}</div><p className="mt-1 text-xs text-zinc-600">{task.description || taskLabel(task.type)}{state?.reason && !state.verified ? ` · ${state.reason}` : ""}</p></div>{state?.verified ? <span className="text-xs font-bold text-emerald-300">✓ Verified</span> : <div className="flex gap-2">{task.targetUrl && <a href={task.targetUrl} target="_blank" rel="noreferrer" className="rounded-lg border border-white/10 px-3 py-2 text-[10px] font-bold">Open ↗</a>}<button disabled={!entry || busy} onClick={() => void verifyTask(task)} className="rounded-lg bg-white px-3 py-2 text-[10px] font-black text-black disabled:opacity-40">Verify</button></div>}</div></div>})}</div>}
          {message && <div className={`mt-5 rounded-xl border p-4 text-xs ${allVerified ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-300" : "border-violet-500/20 bg-violet-500/5 text-violet-200"}`}>{message}</div>}
          <button disabled={busy || !entry} onClick={() => void verifyAll()} className="mt-5 w-full rounded-xl border border-white/10 py-3 text-xs font-black disabled:cursor-not-allowed disabled:opacity-40">{busy ? "Checking…" : "Verify all requirements"}</button>
        </div>
      </section>
      <aside className="lg:sticky lg:top-24 lg:h-fit"><div className="rounded-3xl border border-white/10 bg-[#0d0c11] p-6"><span className="text-[9px] font-black tracking-[.2em] text-zinc-600">YOUR ENTRY</span><h2 className="mt-2 text-2xl">Ready to enter?</h2><p className="mt-3 text-xs leading-5 text-zinc-600">Connect your account and wallet, create your entry, then Raven Oracle verifies the required social actions.</p>
        <div className="mt-6 space-y-2"><div className={`flex justify-between rounded-lg border p-3 text-xs ${connected("X") ? "border-emerald-500/20" : "border-white/10"}`}><span>X account</span>{connected("X") ? <b className="text-emerald-300">✓ Connected</b> : <button onClick={() => void connectSocial("x")} className="text-violet-300">Connect →</button>}</div><div className={`flex justify-between rounded-lg border p-3 text-xs ${connected("DISCORD") ? "border-emerald-500/20" : "border-white/10"}`}><span>Discord account</span>{connected("DISCORD") ? <b className="text-emerald-300">✓ Connected</b> : <button onClick={() => void connectSocial("discord")} className="text-violet-300">Connect →</button>}</div><div className="rounded-lg border border-white/10 p-3 text-xs"><div className="flex justify-between"><span>Wallet</span><button onClick={() => setModal("wallet")} className="text-violet-300">{walletId ? "Change" : "Add →"}</button></div>{walletId && <p className="mt-2 text-zinc-500">{shortAddress(wallets.find((w) => w.id === walletId)?.address ?? "")}</p>}</div></div>
        {entry ? <div className="mt-5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4"><b className="text-sm text-emerald-300">Entry created</b><p className="mt-1 text-xs text-zinc-500">{entry.socialVerifiedAtEntry ? "You are currently eligible." : "Finish the requirements to become eligible."}</p></div> : <button disabled={busy || ended} onClick={() => void enter()} className="mt-5 w-full rounded-xl bg-violet-500 py-4 text-sm font-black disabled:opacity-40">{ended ? "Raffle ended" : busy ? "Entering…" : "Enter raffle"}</button>}
        {entry && allVerified && <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-center text-xs font-bold text-emerald-300">✓ Eligible for the draw</div>}
      </div></aside>
    </div>
    {modal && <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-5 backdrop-blur-sm"><div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0d0c11] p-6 shadow-2xl"><div className="flex justify-between"><div><span className="text-[9px] font-black tracking-[.18em] text-zinc-600">RAVEN ORACLE ACCOUNT</span><h3 className="mt-2 text-xl font-bold">{modal === "login" ? "Connect your account" : "Add a wallet"}</h3></div><button onClick={() => setModal(null)} className="text-zinc-500">×</button></div>{modal === "login" ? <><p className="mt-3 text-xs leading-5 text-zinc-600">Sign in with your Raven Oracle email. After login you can connect X and Discord and enter raffles.</p><input value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="you@example.com" className="mt-5 w-full rounded-lg border border-white/10 bg-black p-3 text-sm outline-none" onKeyDown={(e) => { if (e.key === "Enter") void login(); }} /><button disabled={busy} onClick={() => void login()} className="mt-3 w-full rounded-lg bg-violet-500 py-3 text-sm font-black">{busy ? "Connecting…" : "Continue"}</button></> : <><p className="mt-3 text-xs text-zinc-600">An active wallet is required to create the raffle entry.</p><input value={walletAddress} onChange={(e) => setWalletAddress(e.target.value)} placeholder="Wallet address" className="mt-5 w-full rounded-lg border border-white/10 bg-black p-3 text-sm outline-none" /><select value={walletChain} onChange={(e) => setWalletChain(e.target.value as "EVM" | "SOLANA")} className="mt-3 w-full rounded-lg border border-white/10 bg-black p-3 text-sm"><option value="EVM">EVM</option><option value="SOLANA">Solana</option></select><button disabled={busy} onClick={() => void addWallet()} className="mt-3 w-full rounded-lg bg-violet-500 py-3 text-sm font-black">{busy ? "Saving…" : "Add wallet"}</button></>}</div></div>}
  </main>;
}
