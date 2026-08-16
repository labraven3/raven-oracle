"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type User = { id: string; email: string; displayName?: string | null; username?: string | null };
type Social = { provider: "X" | "DISCORD"; providerUsername?: string | null; displayName?: string | null };
type Wallet = { id: string; address: string; chain: "EVM" | "SOLANA"; network: string };
type Project = { name?: string | null; xUrl?: string | null; discordUrl?: string | null; logoUrl?: string | null };
type Raffle = {
  id: string; title: string; description?: string | null; prizeName: string;
  prizeDescription?: string | null; prizeQuantity: number; startsAt: string; endsAt: string;
  status: string; entryRules?: { tasks?: Task[] } | null; project?: Project | null;
};
type Task = {
  id: string; type: "DISCORD_JOIN" | "X_FOLLOW" | "X_LIKE" | "X_REPOST";
  title: string; description?: string | null; target: string; targetUrl?: string | null;
  isRequired: boolean; sortOrder: number;
};

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("raven_token");
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }
  const res = await fetch(`${API}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message ?? `Request failed (${res.status})`);
  return data as T;
}

function shortAddress(address: string) { return address.length > 14 ? `${address.slice(0, 7)}…${address.slice(-5)}` : address; }
function remaining(end: string) {
  const ms = new Date(end).getTime() - Date.now();
  if (ms <= 0) return "Ended";
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
  return h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h left` : `${h}h ${m}m left`;
}
function taskSymbol(type: Task["type"]) { return type === "DISCORD_JOIN" ? "◈" : type === "X_FOLLOW" ? "𝕏" : type === "X_LIKE" ? "♡" : "↻"; }

export default function Home() {
  const [raffles, setRaffles] = useState<Raffle[]>([]);
  const [selected, setSelected] = useState<Raffle | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskState, setTaskState] = useState<Record<string, "idle" | "checking" | "passed" | "failed">>({});
  const [user, setUser] = useState<User | null>(null);
  const [socials, setSocials] = useState<Social[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [walletId, setWalletId] = useState("");
  const [entry, setEntry] = useState<any>(null);
  const [modal, setModal] = useState<"login" | "wallet" | null>(null);
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [chain, setChain] = useState<"EVM" | "SOLANA">("EVM");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (typeof window === "undefined" || !localStorage.getItem("raven_token")) return;
    try {
      const [me, social, wallet] = await Promise.all([
        api<{ user: User }>("/auth/me"), api<{ accounts: Social[] }>("/social-accounts/"), api<{ wallets: Wallet[] }>("/wallets/"),
      ]);
      setUser(me.user); setSocials(social.accounts); setWallets(wallet.wallets);
      setWalletId((current) => current || wallet.wallets[0]?.id || "");
    } catch { localStorage.removeItem("raven_token"); setUser(null); }
  }, []);

  const loadRaffles = useCallback(async () => {
    try { const data = await api<{ raffles: Raffle[] }>("/raffles/"); setRaffles(data.raffles.filter((r) => r.status === "ACTIVE" || r.status === "SCHEDULED")); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to load raffles"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); void loadRaffles(); }, [refresh, loadRaffles]);

  const openRaffle = async (raffle: Raffle) => {
    setSelected(raffle); setEntry(null); setTaskState({});
    try {
      const detail = await api<{ raffle: Raffle }>(`/raffles/${raffle.id}`);
      const taskResult = await api<{ tasks: Task[] }>(`/raffles/${raffle.id}/tasks`).catch(() => ({ tasks: [] }));
      setSelected(detail.raffle);
      setTasks(taskResult.tasks.length ? taskResult.tasks : (detail.raffle.entryRules?.tasks ?? []));
      if (user) { const mine = await api<{ entry: any }>(`/raffles/${raffle.id}/entries/me`).catch(() => null); if (mine?.entry) setEntry(mine.entry); }
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to open raffle"); }
  };

  const connected = (provider: "X" | "DISCORD") => socials.some((s) => s.provider === provider);

  const connectSocial = async (provider: "x" | "discord") => {
    if (!user) { setModal("login"); return; }
    try { const data = await api<{ authorizationUrl: string }>(`/auth/${provider}/start`); window.location.href = data.authorizationUrl; }
    catch (e) { setError(e instanceof Error ? e.message : `Unable to connect ${provider}`); }
  };

  const login = async () => {
    if (!email.trim()) return;
    setBusy(true);
    try { const data = await api<{ token: string; user: User }>("/auth/login", { method: "POST", body: JSON.stringify({ email: email.trim() }) }); localStorage.setItem("raven_token", data.token); setUser(data.user); setModal(null); setEmail(""); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Login failed"); }
    finally { setBusy(false); }
  };

  const addWallet = async () => {
    if (!address.trim()) return;
    setBusy(true);
    try { const data = await api<{ wallet: Wallet }>("/wallets/", { method: "POST", body: JSON.stringify({ address: address.trim(), chain }) }); setWallets((w) => [data.wallet, ...w]); setWalletId(data.wallet.id); setAddress(""); setModal(null); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to save address"); }
    finally { setBusy(false); }
  };

  const verifyTask = async (task: Task) => {
    if (!selected || !user) { setModal("login"); return; }
    setTaskState((s) => ({ ...s, [task.id]: "checking" }));
    try {
      const result = await api<{ verified?: boolean; status?: string; result?: { status?: string } }>(`/raffles/${selected.id}/tasks/${task.id}/verify`, { method: "POST" });
      const ok = result.verified === true || result.status === "VERIFIED" || result.result?.status === "VERIFIED";
      setTaskState((s) => ({ ...s, [task.id]: ok ? "passed" : "failed" }));
    } catch { setTaskState((s) => ({ ...s, [task.id]: "failed" })); }
  };

  const verifyAll = async () => {
    if (!selected || !user) return setModal("login");
    setBusy(true);
    try {
      const result = await api<{ entry?: any; results?: Array<{ taskId: string; status: string }> }>(`/raffles/${selected.id}/entries/me/verify-tasks`, { method: "POST" });
      if (result.entry) setEntry(result.entry);
      for (const item of result.results ?? []) setTaskState((s) => ({ ...s, [item.taskId]: item.status === "VERIFIED" ? "passed" : "failed" }));
      if (!result.results?.length) for (const task of tasks) await verifyTask(task);
    } catch (e) { setError(e instanceof Error ? e.message : "Verification failed"); }
    finally { setBusy(false); }
  };

  const enter = async () => {
    if (!selected) return;
    if (!user) return setModal("login");
    if (!walletId) return setModal("wallet");
    setBusy(true);
    try {
      const data = await api<{ entry: any }>(`/raffles/${selected.id}/entries`, { method: "POST", body: JSON.stringify({ walletAddressId: walletId }) });
      setEntry(data.entry); await verifyAll();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to enter raffle"); }
    finally { setBusy(false); }
  };

  const required = tasks.filter((t) => t.isRequired);
  const passed = required.filter((t) => taskState[t.id] === "passed").length;
  const eligible = required.length > 0 && passed === required.length;
  const active = useMemo(() => raffles, [raffles]);

  return (
    <main className="min-h-screen bg-[#07070a] text-zinc-100">
      <nav className="sticky top-0 z-30 border-b border-white/10 bg-[#07070a]/85 backdrop-blur-xl">
        <div className="mx-auto flex min-h-[72px] w-[min(1160px,calc(100%-32px))] items-center justify-between gap-5">
          <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl border border-violet-400/25 bg-violet-950/20 text-lg font-black text-violet-200">R</div><div><b className="block text-sm tracking-[.18em]">RAVEN ORACLE</b><small className="text-[9px] tracking-[.16em] text-zinc-600">COMMUNITY RAFFLE PLATFORM</small></div></div>
          <div className="hidden gap-8 text-sm text-zinc-500 md:flex"><a href="#raffles" className="hover:text-white">Raffles</a><a href="#how" className="hover:text-white">How it works</a><a href="#about" className="hover:text-white">About</a></div>
          <button onClick={() => setModal("login")} className="rounded-lg bg-white px-4 py-2.5 text-xs font-black text-black">{user ? (user.username ?? user.displayName ?? user.email.split("@")[0]) : "Connect Account"}</button>
        </div>
      </nav>

      <section className="relative mx-auto grid min-h-[590px] w-[min(1160px,calc(100%-32px))] items-center gap-14 py-20 lg:grid-cols-[1.2fr_.8fr]">
        <div className="absolute left-20 top-0 h-80 w-[600px] rounded-full bg-violet-600/10 blur-[120px]" />
        <div className="relative"><span className="rounded-full border border-white/10 bg-white/[.02] px-3 py-2 text-[9px] font-black tracking-[.18em] text-zinc-500">THE COMMUNITY RAFFLE PLATFORM</span><h1 className="mt-7 text-6xl font-medium leading-[.94] tracking-[-.06em] sm:text-8xl">Fair raffles.<br /><span className="text-violet-300">Real communities.</span></h1><p className="mt-7 max-w-2xl text-base leading-7 text-zinc-500">Discover giveaways, connect your socials, complete verified eligibility tasks and enter raffles from one place.</p><div className="mt-8 flex flex-wrap gap-3"><button onClick={() => document.getElementById("raffles")?.scrollIntoView({ behavior: "smooth" })} className="rounded-lg bg-violet-500 px-5 py-3 text-sm font-black shadow-lg shadow-violet-500/10">Explore Raffles ↓</button><button onClick={() => setModal("login")} className="rounded-lg border border-white/10 bg-white/[.03] px-5 py-3 text-sm font-bold">Connect Account</button></div><div className="mt-6 flex flex-wrap gap-5 text-[10px] text-zinc-600"><span>✓ Automated verification</span><span>✓ Fair draw</span><span>✓ No wallet connection required</span></div></div>
        <div className="rounded-2xl border border-violet-300/20 bg-gradient-to-br from-violet-950/30 to-black p-6 shadow-2xl shadow-violet-950/10"><div className="flex justify-between text-[9px] tracking-[.18em] text-zinc-600"><span>RAFFLE ENGINE</span><b className="text-emerald-400">● LIVE</b></div><div className="py-12 text-center text-[150px] font-black leading-none">R</div>{[["Eligibility","Automated"],["X + Discord","Verified"],["Winner replacement","Enabled"]].map(([a,b]) => <div key={a} className="flex justify-between border-t border-white/10 py-4 text-xs text-zinc-500"><span>{a}</span><b className="text-zinc-200">{b}</b></div>)}</div>
      </section>

      <section id="how" className="grid border-y border-white/10 sm:grid-cols-2 lg:grid-cols-4">{[["01","Connect socials","Link X and Discord once."],["02","Complete tasks","Follow, like, repost and join."],["03","Auto verify","Raven Oracle checks eligibility."],["04","Enter fairly","Eligible entries reach the draw."]].map(([n,t,d]) => <div key={n} className="border-r border-white/10 px-7 py-7"><b className="text-xs text-violet-300">{n}</b><span className="mt-2 block font-bold">{t}</span><small className="mt-1 block text-xs text-zinc-600">{d}</small></div>)}</section>

      <section id="raffles" className="mx-auto w-[min(1160px,calc(100%-32px))] py-20">
        <div className="mb-7 flex items-end justify-between"><div><span className="text-[9px] font-black tracking-[.18em] text-zinc-600">LIVE OPPORTUNITIES</span><h2 className="mt-2 text-3xl tracking-tight">Active Raffles</h2></div><button onClick={() => void loadRaffles()} className="rounded-lg border border-white/10 bg-white/[.02] px-3 py-2 text-xs font-bold text-zinc-400">Refresh</button></div>
        {error && <button onClick={() => setError("")} className="mb-5 w-full rounded-lg border border-red-900/50 bg-red-950/20 p-3 text-left text-xs text-red-300">{error} ×</button>}
        {loading ? <div className="rounded-2xl border border-dashed border-white/10 p-14 text-center text-zinc-600">Loading live raffles…</div> : active.length === 0 ? <div className="rounded-2xl border border-dashed border-white/10 p-14 text-center text-zinc-600">No active raffles yet.</div> : <div className="grid gap-4 lg:grid-cols-2">{active.map((r) => <article key={r.id} className="grid min-h-[205px] overflow-hidden rounded-2xl border border-white/10 bg-[#0d0c11] sm:grid-cols-[145px_1fr_auto]"><div className="grid min-h-36 place-items-center bg-[radial-gradient(circle,#3d216e,#120d1a_65%)] text-3xl font-black text-violet-200">{(r.project?.name ?? r.title).slice(0,2).toUpperCase()}</div><div className="p-6"><span className="text-[9px] font-black tracking-[.18em] text-violet-300/60">COMMUNITY GIVEAWAY</span><h3 className="mt-2 text-xl font-bold">{r.title}</h3><p className="mt-2 text-xs leading-5 text-zinc-600">{r.description ?? "Complete the required community tasks to become eligible."}</p><div className="mt-4 flex flex-wrap gap-2 text-[9px] text-zinc-500"><span className="rounded bg-white/5 px-2 py-1">✓ Fair draw</span><span className="rounded bg-white/5 px-2 py-1">✓ Automated</span><span className="rounded bg-white/5 px-2 py-1">{remaining(r.endsAt)}</span></div><b className="mt-4 block text-sm">{r.prizeName}{r.prizeQuantity > 1 ? ` × ${r.prizeQuantity}` : ""}</b></div><button onClick={() => void openRaffle(r)} className="m-5 self-end rounded-lg bg-white px-4 py-2.5 text-xs font-black text-black">View Raffle</button></article>)}</div>}
      </section>

      <footer id="about" className="grid gap-10 border-t border-white/10 px-5 py-14 text-sm text-zinc-600 md:grid-cols-3 md:px-[max(20px,calc((100%-1160px)/2))]"><div><b className="text-zinc-200">RAVEN ORACLE</b><p className="mt-3 max-w-md leading-6">Built for projects and communities that want transparent, automated raffle eligibility.</p></div><div><b className="text-zinc-300">Verification</b><p className="mt-3">X follows, likes and reposts<br />Discord membership<br />Payout address validation</p></div><div><b className="text-zinc-300">Contact</b><p className="mt-3">Project submissions<br />Partnerships<br />Community</p></div></footer>

      {selected && <div className="fixed inset-0 z-40 grid place-items-center bg-black/80 p-4 backdrop-blur-md" onMouseDown={(e) => e.target === e.currentTarget && setSelected(null)}><div className="relative max-h-[92vh] w-[min(760px,100%)] overflow-auto rounded-2xl border border-violet-300/20 bg-[#0d0c11] p-7 shadow-2xl"><button onClick={() => setSelected(null)} className="absolute right-5 top-3 text-3xl text-zinc-500">×</button><span className="text-[9px] font-black tracking-[.18em] text-zinc-600">RAFFLE DETAILS</span><h2 className="mt-2 text-3xl font-bold">{selected.title}</h2><p className="mt-2 text-sm leading-6 text-zinc-500">{selected.description ?? "Complete the requirements below to enter."}</p><div className="my-6 rounded-xl border border-white/10 bg-white/[.02] p-4"><span className="text-[9px] font-black tracking-[.18em] text-zinc-600">PRIZE</span><b className="mt-2 block text-lg">{selected.prizeName}</b><small className="text-zinc-600">{selected.prizeDescription ?? `${selected.prizeQuantity} winner${selected.prizeQuantity === 1 ? "" : "s"}`}</small></div><div className="mb-7 flex flex-wrap gap-2"><button onClick={() => void connectSocial("x")} className={connected("X") ? "rounded-lg border border-emerald-800 bg-emerald-950/30 px-3 py-2 text-xs font-bold text-emerald-300" : "rounded-lg border border-white/10 px-3 py-2 text-xs font-bold"}>{connected("X") ? "✓ X connected" : "Connect X"}</button><button onClick={() => void connectSocial("discord")} className={connected("DISCORD") ? "rounded-lg border border-emerald-800 bg-emerald-950/30 px-3 py-2 text-xs font-bold text-emerald-300" : "rounded-lg border border-white/10 px-3 py-2 text-xs font-bold"}>{connected("DISCORD") ? "✓ Discord connected" : "Connect Discord"}</button><button onClick={() => setModal("wallet")} className={wallets.length ? "rounded-lg border border-emerald-800 bg-emerald-950/30 px-3 py-2 text-xs font-bold text-emerald-300" : "rounded-lg border border-white/10 px-3 py-2 text-xs font-bold"}>{wallets.length ? `✓ ${shortAddress(wallets.find(w => w.id === walletId)?.address ?? wallets[0].address)}` : "Add payout address"}</button></div><div className="flex items-end justify-between border-b border-white/10 pb-4"><div><span className="text-[9px] font-black tracking-[.18em] text-zinc-600">ELIGIBILITY</span><h3 className="mt-1 font-bold">{passed}/{required.length || tasks.length} requirements completed</h3></div>{entry && <span className={eligible ? "rounded-full bg-emerald-950 px-3 py-1 text-[9px] font-black text-emerald-300" : "rounded-full bg-white/5 px-3 py-1 text-[9px] font-black text-zinc-400"}>{eligible ? "ELIGIBLE" : entry.status ?? "PENDING"}</span>}</div><div>{tasks.length === 0 ? <div className="py-10 text-center text-sm text-zinc-600">No task configuration found for this raffle.</div> : tasks.map((task) => { const state = taskState[task.id] ?? "idle"; return <div key={task.id} className="flex items-center gap-3 border-b border-white/5 py-4"><div className={state === "passed" ? "grid h-9 w-9 place-items-center rounded-lg bg-emerald-950 text-emerald-300" : "grid h-9 w-9 place-items-center rounded-lg bg-violet-950/40 text-violet-200"}>{state === "passed" ? "✓" : taskSymbol(task.type)}</div><div className="min-w-0 flex-1"><b className="block text-sm">{task.title}</b><small className="block truncate text-xs text-zinc-600">{task.description ?? task.target}</small></div><div className="flex items-center gap-2">{state === "passed" ? <span className="text-[10px] font-bold text-emerald-400">Verified</span> : <><a href={task.targetUrl ?? "#"} target="_blank" rel="noreferrer" className="rounded-md border border-white/10 px-2.5 py-1.5 text-[10px] font-bold">Open</a>{entry && <button disabled={state === "checking"} onClick={() => void verifyTask(task)} className="rounded-md bg-white px-2.5 py-1.5 text-[10px] font-black text-black">{state === "checking" ? "Checking…" : "Verify"}</button>}</>}</div></div>; })}</div><div className="mt-6">{eligible ? <div className="rounded-xl border border-emerald-900 bg-emerald-950/20 p-4 text-sm font-bold text-emerald-300">✓ All required tasks verified. You are eligible for the draw.</div> : <button disabled={busy} onClick={() => entry ? void verifyAll() : void enter()} className="w-full rounded-lg bg-violet-500 py-3.5 text-sm font-black">{busy ? "Working…" : entry ? "Verify all requirements" : "Enter Raffle"}</button>}</div></div></div>}

      {modal === "login" && <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4 backdrop-blur-md"><div className="relative w-[min(430px,100%)] rounded-2xl border border-white/10 bg-[#0d0c11] p-7"><button onClick={() => setModal(null)} className="absolute right-5 top-3 text-3xl text-zinc-500">×</button><span className="text-[9px] font-black tracking-[.18em] text-zinc-600">RAVEN ORACLE ACCOUNT</span><h2 className="mt-2 text-2xl font-bold">Connect your account</h2><p className="mt-2 text-sm leading-6 text-zinc-500">Sign in with your Raven Oracle email. The website never asks you to paste an API token.</p><input autoFocus value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void login()} placeholder="you@example.com" className="my-5 w-full rounded-lg border border-white/10 bg-black p-3 text-sm outline-none" /><button disabled={busy} onClick={() => void login()} className="w-full rounded-lg bg-violet-500 py-3 font-black">{busy ? "Connecting…" : "Continue"}</button></div></div>}

      {modal === "wallet" && <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4 backdrop-blur-md"><div className="relative w-[min(430px,100%)] rounded-2xl border border-white/10 bg-[#0d0c11] p-7"><button onClick={() => setModal(null)} className="absolute right-5 top-3 text-3xl text-zinc-500">×</button><span className="text-[9px] font-black tracking-[.18em] text-zinc-600">PAYOUT ADDRESS</span><h2 className="mt-2 text-2xl font-bold">Add your wallet address</h2><p className="mt-2 text-sm leading-6 text-zinc-500">No wallet connection is required. Paste the address that should receive your prize.</p><div className="mt-5 grid grid-cols-2 gap-2"><button onClick={() => setChain("EVM")} className={chain === "EVM" ? "rounded-lg border border-violet-500 bg-violet-950/40 py-2 text-xs font-bold" : "rounded-lg border border-white/10 py-2 text-xs text-zinc-500"}>EVM</button><button onClick={() => setChain("SOLANA")} className={chain === "SOLANA" ? "rounded-lg border border-violet-500 bg-violet-950/40 py-2 text-xs font-bold" : "rounded-lg border border-white/10 py-2 text-xs text-zinc-500"}>Solana</button></div><input value={address} onChange={(e) => setAddress(e.target.value)} placeholder={chain === "EVM" ? "0x…" : "Solana address"} className="my-4 w-full rounded-lg border border-white/10 bg-black p-3 text-sm outline-none" /><button disabled={busy} onClick={() => void addWallet()} className="w-full rounded-lg bg-violet-500 py-3 font-black">{busy ? "Saving…" : "Save address"}</button></div></div>}
    </main>
  );
}
