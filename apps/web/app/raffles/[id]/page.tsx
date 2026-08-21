"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import SiteHeader from "../../../components/SiteHeader";
import { API_BASE_URL } from "@/lib/api-config";

type User = { id: string; email?: string | null; displayName?: string | null; username?: string | null };
type Social = { provider: "X" | "DISCORD"; providerUsername?: string | null };
type Wallet = { id: string; address: string; chain: "EVM" | "SOLANA"; network: string; status?: string };
type Raffle = { id: string; title: string; description?: string | null; prizeName: string; prizeDescription?: string | null; prizeQuantity: number; startsAt: string; endsAt: string; status: string; winnerCount?: number; project?: { id?: string; name?: string | null; logoUrl?: string | null } | null };
type Task = { id: string; type: "DISCORD_JOIN" | "X_FOLLOW" | "X_LIKE" | "X_REPOST"; title: string; description?: string | null; target: string; targetUrl?: string | null; isRequired: boolean };
type TaskResult = { taskId: string; type: Task["type"]; title: string; required: boolean; verified: boolean; reason?: string | null };
type EntryDetails = { id: string; status: string; walletAddressSnapshot: string; eligibilityReasons?: unknown; riskLevel?: string | null; enteredAt: string; walletAddress: { chain: string; network: string } };

async function api<T>(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message ?? `Request failed (${response.status})`);
  return data as T;
}

function icon(type: Task["type"]) {
  return type === "DISCORD_JOIN" ? "◈" : type === "X_FOLLOW" ? "𝕏" : type === "X_LIKE" ? "♡" : "↻";
}

function label(type: Task["type"]) {
  return type === "DISCORD_JOIN" ? "Discord" : type === "X_FOLLOW" ? "X follow" : type === "X_LIKE" ? "X like" : "X repost";
}

function countdown(value: string) {
  const ms = new Date(value).getTime() - Date.now();
  if (ms <= 0) return "Now";
  const minutes = Math.floor(ms / 60000);
  return minutes >= 1440
    ? `${Math.floor(minutes / 1440)}d ${Math.floor((minutes % 1440) / 60)}h`
    : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export default function RafflePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
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
  const [walletModal, setWalletModal] = useState(false);
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

      setSocials(socialData.accounts);
      const activeWallets = walletData.wallets.filter((wallet) => wallet.status !== "DELETED");
      setWallets(activeWallets);
      setWalletId((current) => current || activeWallets[0]?.id || "");
    } catch {
      setUser(null);
      setSocials([]);
      setWallets([]);
      setWalletId("");
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
      setTasks(taskData.tasks);

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

  useEffect(() => {
    void Promise.all([loadAccount(), loadRaffle()]);
  }, [loadAccount, loadRaffle]);

  const required = useMemo(() => tasks.filter((task) => task.isRequired), [tasks]);
  const verified = required.filter((task) => results[task.id]?.verified).length;
  const isConnected = (provider: "X" | "DISCORD") => socials.some((social) => social.provider === provider);
  const canEnter = raffle?.status === "ACTIVE" && Date.now() >= new Date(raffle.startsAt).getTime() && Date.now() <= new Date(raffle.endsAt).getTime();

  const requireLogin = () => {
    router.push(`/login?next=${encodeURIComponent(`/raffles/${id}`)}`);
  };

  const connectSocial = async (provider: "x" | "discord") => {
    if (!user) return requireLogin();
    try {
      const data = await api<{ authorizationUrl: string }>(`/auth/${provider}/start`);
      window.location.href = data.authorizationUrl;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `Unable to connect ${provider}`);
    }
  };

  const addWallet = async () => {
    if (!user) return requireLogin();
    if (!address.trim()) return setMessage("Enter a wallet address.");
    setBusy(true);
    try {
      const data = await api<{ wallet: Wallet }>("/wallets/", {
        method: "POST",
        body: JSON.stringify({ address: address.trim(), chain }),
      });
      setWallets((items) => [data.wallet, ...items]);
      setWalletId(data.wallet.id);
      setAddress("");
      setWalletModal(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save wallet");
    } finally {
      setBusy(false);
    }
  };

  const enter = async () => {
    if (!user) return requireLogin();
    if (!canEnter) return setMessage(raffle?.status === "SCHEDULED" ? `Starts in ${countdown(raffle.startsAt)}.` : "Entries are closed.");
    if (!walletId) return setWalletModal(true);

    setBusy(true);
    try {
      const data = await api<{ entry: EntryDetails }>(`/raffles/${id}/entries`, {
        method: "POST",
        body: JSON.stringify({ walletAddressId: walletId }),
      });
      setEntry(data.entry);
      setMessage("Entry created. Complete the required tasks.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to enter raffle");
    } finally {
      setBusy(false);
    }
  };

  const verifyTask = async (task: Task) => {
    if (!user) return requireLogin();
    if (!entry) return setMessage("Enter the raffle first.");
    try {
      const data = await api<{ verified?: boolean; status?: string; result?: { verified: boolean; reason?: string | null }; reason?: string | null }>(`/raffles/${id}/tasks/${task.id}/verify`, { method: "POST" });
      const verifiedNow = data.verified === true || data.status === "VERIFIED" || data.result?.verified === true;
      setResults((current) => ({
        ...current,
        [task.id]: {
          taskId: task.id,
          type: task.type,
          title: task.title,
          required: task.isRequired,
          verified: verifiedNow,
          reason: data.reason ?? data.result?.reason ?? null,
        },
      }));
    } catch (error) {
      setResults((current) => ({
        ...current,
        [task.id]: {
          taskId: task.id,
          type: task.type,
          title: task.title,
          required: task.isRequired,
          verified: false,
          reason: error instanceof Error ? error.message : "Verification failed",
        },
      }));
    }
  };

  const verifyAll = async () => {
    if (!user) return requireLogin();
    if (!entry) return setMessage("Enter the raffle first.");
    setBusy(true);
    try {
      const data = await api<{ allRequiredTasksVerified: boolean; tasks: TaskResult[]; entry: EntryDetails }>(`/raffles/${id}/entries/me/verify-tasks`, { method: "POST" });
      const nextResults: Record<string, TaskResult> = {};
      for (const result of data.tasks ?? []) nextResults[result.taskId] = result;
      setResults(nextResults);
      setEntry(data.entry);
      setMessage(data.allRequiredTasksVerified ? "All required tasks verified. You are eligible." : "Some required tasks are still incomplete.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Verification failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <main className="min-h-screen bg-[#06060a] text-zinc-500"><SiteHeader /><div className="mx-auto max-w-6xl p-10">Loading raffle…</div></main>;
  if (!raffle) return <main className="min-h-screen bg-[#06060a] text-zinc-400"><SiteHeader /><div className="mx-auto max-w-2xl px-5 py-20">{message || "Raffle not found"}</div></main>;

  return (
    <main className="min-h-screen bg-[#06060a] text-zinc-100">
      <SiteHeader />
      <div className="mx-auto max-w-6xl px-5 py-10">
        <Link href="/raffles" className="text-xs text-zinc-600 hover:text-violet-300">← All NFT Raffles</Link>
        <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_360px]">
          <section>
            <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#15101e] to-[#0d0c11] p-7 sm:p-9">
              <div className="flex flex-wrap items-start justify-between gap-5">
                <div>
                  <span className="rounded-full bg-violet-500/10 px-3 py-1 text-[9px] font-black tracking-[.15em] text-violet-300">NFT RAFFLE</span>
                  <h1 className="mt-5 text-4xl font-medium tracking-tight">{raffle.title}</h1>
                  <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-500">{raffle.description || "Complete the verified requirements to enter this NFT whitelist raffle."}</p>
                </div>
                <span className="rounded-full border border-white/10 px-3 py-1 text-[9px] font-black">{raffle.status}</span>
              </div>
              {raffle.project && (
                <Link href={raffle.project.id ? `/projects/${raffle.project.id}` : "/projects"} className="mt-7 flex items-center gap-3 rounded-xl border border-white/10 p-3 hover:border-violet-400/30">
                  <div className="grid h-11 w-11 place-items-center overflow-hidden rounded-lg bg-black">{raffle.project.logoUrl ? <img src={raffle.project.logoUrl} alt={raffle.project.name ?? ""} className="h-full w-full object-cover" /> : "R"}</div>
                  <div><small className="text-[8px] tracking-[.15em] text-zinc-600">PROJECT</small><b className="mt-1 block text-sm">{raffle.project.name}</b></div>
                  <span className="ml-auto text-xs text-zinc-600">View →</span>
                </Link>
              )}
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-black/20 p-4"><small className="text-[8px] tracking-[.16em] text-zinc-600">PRIZE</small><b className="mt-2 block text-lg">{raffle.prizeName}</b></div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-4"><small className="text-[8px] tracking-[.16em] text-zinc-600">WINNERS</small><b className="mt-2 block text-lg">{raffle.winnerCount ?? 1}</b></div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-4"><small className="text-[8px] tracking-[.16em] text-zinc-600">ENDS</small><b className="mt-2 block text-sm">{new Date(raffle.endsAt).toLocaleDateString()}</b></div>
              </div>
            </div>

            <div className="mt-6 rounded-3xl border border-white/10 bg-[#0d0c11] p-7">
              <div className="flex items-end justify-between"><div><span className="text-[9px] font-black tracking-[.2em] text-zinc-600">ENTRY REQUIREMENTS</span><h2 className="mt-2 text-2xl">Verify your tasks</h2></div><span className="text-xs text-zinc-500">{verified}/{required.length} required</span></div>
              <div className="mt-6 space-y-3">
                {tasks.length === 0 ? <div className="rounded-xl border border-dashed border-white/10 p-10 text-center text-sm text-zinc-600">No tasks configured.</div> : tasks.map((task) => {
                  const result = results[task.id];
                  const provider = task.type === "DISCORD_JOIN" ? "DISCORD" : "X";
                  return <div key={task.id} className={`rounded-xl border p-4 ${result?.verified ? "border-emerald-500/30 bg-emerald-500/[.04]" : "border-white/10"}`}>
                    <div className="flex items-center gap-4">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/[.04] text-lg">{icon(task.type)}</span>
                      <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><b className="text-sm">{task.title}</b><span className="text-[8px] text-zinc-600">{task.isRequired ? "REQUIRED" : "OPTIONAL"}</span></div><p className="mt-1 truncate text-xs text-zinc-600">{task.description || label(task.type)} · {task.target}</p>{result?.reason && !result.verified && <p className="mt-2 text-[10px] text-red-300">{result.reason}</p>}</div>
                      {result?.verified ? <span className="text-xs font-bold text-emerald-300">✓ Verified</span> : isConnected(provider) ? <div className="flex gap-2">{task.targetUrl && <a href={task.targetUrl} target="_blank" rel="noreferrer" className="rounded-lg border border-white/10 px-3 py-2 text-[10px]">Open</a>}<button disabled={!entry || busy} onClick={() => void verifyTask(task)} className="rounded-lg bg-white px-3 py-2 text-[10px] font-black text-black disabled:opacity-40">Verify</button></div> : <button onClick={() => void connectSocial(provider.toLowerCase() as "x" | "discord")} className="rounded-lg border border-violet-400/20 bg-violet-500/10 px-3 py-2 text-[10px] font-bold text-violet-200">Connect {provider}</button>}
                    </div>
                  </div>;
                })}
              </div>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row"><button disabled={busy || !entry} onClick={() => void verifyAll()} className="flex-1 rounded-xl border border-white/10 py-3 text-xs font-black disabled:opacity-40">Verify all</button><button disabled={busy || !canEnter || !!entry} onClick={() => void enter()} className="flex-1 rounded-xl bg-violet-500 py-3 text-xs font-black disabled:opacity-40">{entry ? "Entry created ✓" : raffle.status === "SCHEDULED" ? `Starts in ${countdown(raffle.startsAt)}` : raffle.status === "ACTIVE" ? "Enter raffle" : "Entries closed"}</button></div>
              {message && <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-zinc-400">{message}</div>}
            </div>

            {entry && <div className="mt-6 rounded-3xl border border-white/10 bg-[#0d0c11] p-7"><span className="text-[9px] font-black tracking-[.2em] text-zinc-600">YOUR ENTRY</span><h2 className="mt-2 text-2xl">Entry Details</h2><div className="mt-5 space-y-3"><div className="rounded-xl border border-white/10 bg-black/20 p-4"><div className="flex items-center justify-between"><span className="text-xs text-zinc-600">Status</span><span className="rounded-full px-3 py-1 text-[9px] font-black">{entry.status}</span></div></div><div className="rounded-xl border border-white/10 bg-black/20 p-4"><span className="text-xs text-zinc-600">Wallet Address</span><p className="mt-2 break-all font-mono text-[10px] text-zinc-400">{entry.walletAddressSnapshot}</p><p className="mt-1 text-[9px] text-zinc-600">{entry.walletAddress.chain} · {entry.walletAddress.network}</p></div><div className="rounded-xl border border-white/10 bg-black/20 p-4"><span className="text-xs text-zinc-600">Entered At</span><p className="mt-1 text-[10px] text-zinc-400">{new Date(entry.enteredAt).toLocaleString()}</p></div></div></div>}
          </section>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-[#0d0c11] p-6"><span className="text-[9px] font-black tracking-[.18em] text-zinc-600">RAVEN ACCOUNT</span>{user ? <div className="mt-4"><b className="text-sm">{user.displayName || user.username || "Raven member"}</b><p className="mt-1 text-xs text-zinc-600">{user.email}</p><p className="mt-3 text-[10px] text-emerald-300">✓ Signed in</p></div> : <button onClick={requireLogin} className="mt-4 w-full rounded-xl bg-white py-3 text-xs font-black text-black">Sign in with Gmail</button>}</div>
            <div className="rounded-2xl border border-white/10 bg-[#0d0c11] p-6"><span className="text-[9px] font-black tracking-[.18em] text-zinc-600">DISCORD</span>{isConnected("DISCORD") ? <p className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-emerald-300">✓ Discord connected</p> : <button onClick={() => void connectSocial("discord")} className="mt-4 w-full rounded-xl border border-violet-400/20 bg-violet-500/10 py-3 text-xs font-bold text-violet-200">Connect Discord</button>}</div>
            <div className="rounded-2xl border border-white/10 bg-[#0d0c11] p-6"><div className="flex items-center justify-between"><span className="text-[9px] font-black tracking-[.18em] text-zinc-600">WHITELIST WALLET</span>{user && <button onClick={() => setWalletModal(true)} className="text-[10px] font-bold text-violet-300">+ Add</button>}</div>{!user ? <p className="mt-4 text-xs leading-5 text-zinc-600">Sign in to add the wallet address the NFT project should whitelist.</p> : wallets.length === 0 ? <p className="mt-4 text-xs leading-5 text-zinc-600">Add the wallet address the NFT project should whitelist.</p> : <div className="mt-4 space-y-2">{wallets.map((wallet) => <button key={wallet.id} onClick={() => setWalletId(wallet.id)} className={`w-full rounded-xl border p-3 text-left ${walletId === wallet.id ? "border-violet-400/40 bg-violet-500/5" : "border-white/10"}`}><b className="block text-[10px]">{wallet.chain}</b><span className="mt-1 block truncate font-mono text-[10px] text-zinc-500">{wallet.address}</span></button>)}</div>}</div>
          </aside>
        </div>
      </div>

      {walletModal && <div className="fixed inset-0 z-[100] grid place-items-center bg-black/70 p-5 backdrop-blur-sm"><div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0d0c11] p-7"><span className="text-[9px] font-black tracking-[.2em] text-violet-300">WHITELIST ADDRESS</span><h2 className="mt-3 text-2xl">Add wallet</h2><input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="0x… or Solana address" className="mt-5 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 font-mono text-sm outline-none" /><select value={chain} onChange={(event) => setChain(event.target.value as "EVM" | "SOLANA")} className="mt-3 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm"><option value="EVM">EVM</option><option value="SOLANA">Solana</option></select><div className="mt-4 flex gap-2"><button onClick={() => setWalletModal(false)} className="flex-1 rounded-xl border border-white/10 py-3 text-xs">Cancel</button><button disabled={busy} onClick={() => void addWallet()} className="flex-1 rounded-xl bg-violet-500 py-3 text-xs font-black">Save wallet</button></div></div></div>}
    </main>
  );
}
