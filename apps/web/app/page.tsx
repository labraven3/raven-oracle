"use client";

import { useEffect, useMemo, useState } from "react";
import ThemeToggle from "../components/ThemeToggle";

type Raffle = { id: string; title: string; description?: string | null; prizeName: string; prizeQuantity: number; startsAt: string; endsAt: string; status: string; project?: { name?: string | null; logoUrl?: string | null } | null };
type Project = { id: string; name: string; description?: string | null; logoUrl?: string | null; status?: string; category?: string };
type Leader = { userId: string; username?: string | null; displayName?: string | null; points: number };
type Message = { id: string; message: string; createdAt: string; user?: { username?: string | null; displayName?: string | null } };

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

async function api<T>(path: string): Promise<T> {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("raven_token");
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }
  const response = await fetch(`${API}${path}`, { headers, cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message ?? `Request failed (${response.status})`);
  return data as T;
}

function timeLeft(value: string) {
  const ms = new Date(value).getTime() - Date.now();
  if (ms <= 0) return "Ended";
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${minutes}m left`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m left`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h left`;
}

function initials(value?: string | null) { return (value || "R").slice(0, 2).toUpperCase(); }

export default function Home() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [raffles, setRaffles] = useState<Raffle[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("raven-theme") as "dark" | "light" | null;
    const preferred = saved ?? (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
    setTheme(preferred);
    setLoggedIn(Boolean(localStorage.getItem("raven_token")));
    document.documentElement.classList.toggle("light", preferred === "light");
  }, []);

  useEffect(() => {
    void Promise.all([
      api<{ raffles: Raffle[] }>("/raffles/public").catch(() => ({ raffles: [] })),
      api<{ projects: Project[] }>("/projects/public").catch(() => ({ projects: [] })),
      api<{ leaderboard: Leader[] }>("/alpha/leaderboard").catch(() => ({ leaderboard: [] })),
      api<{ messages: Message[] }>("/chat/channels/general/messages").catch(() => ({ messages: [] })),
    ]).then(([r, p, l, c]) => {
      setRaffles(r.raffles.filter((x) => x.status === "ACTIVE" || x.status === "SCHEDULED").slice(0, 4));
      setProjects(p.projects.filter((x) => !x.category || x.category === "NFT").slice(0, 4));
      setLeaders(l.leaderboard.slice(0, 5));
      setMessages(c.messages.slice(-4));
    }).finally(() => setLoading(false));
  }, []);

  const colors = useMemo(() => theme === "dark" ? {
    bg: "#06060a", panel: "#0d0c12", panel2: "#111017", border: "rgba(255,255,255,.09)", text: "#f7f5fb", muted: "#77727f", soft: "#a39eaa", accent: "#9b5cff", accentSoft: "#c5a5ff", inverse: "#08070a"
  } : {
    bg: "#f5f3f8", panel: "#ffffff", panel2: "#f0edf5", border: "rgba(25,18,40,.12)", text: "#17131e", muted: "#77717f", soft: "#5d5666", accent: "#7c3aed", accentSoft: "#6d28d9", inverse: "#ffffff"
  }, [theme]);

  const switchTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("raven-theme", next);
    document.documentElement.classList.toggle("light", next === "light");
  };

  return (
    <main style={{ minHeight: "100vh", background: colors.bg, color: colors.text, transition: "background .25s,color .25s" }}>
      <header style={{ position: "sticky", top: 0, zIndex: 50, borderBottom: `1px solid ${colors.border}`, background: `${colors.bg}e8`, backdropFilter: "blur(18px)" }}>
        <div style={{ maxWidth: 1240, margin: "auto", minHeight: 72, padding: "0 24px", display: "flex", alignItems: "center", gap: 26 }}>
          <a href="/" style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 205 }}><span style={{ width: 38, height: 38, display: "grid", placeItems: "center", borderRadius: 11, background: `linear-gradient(135deg,${colors.accent},#5b21b6)`, color: "white", fontWeight: 900 }}>R</span><span><b style={{ display: "block", fontSize: 13, letterSpacing: ".18em" }}>RAVEN ORACLE</b><small style={{ display: "block", marginTop: 3, color: colors.muted, fontSize: 8, letterSpacing: ".16em" }}>NFT COMMUNITY PLATFORM</small></span></a>
          <nav style={{ display: "flex", flex: 1, justifyContent: "center", gap: 24, fontSize: 12, color: colors.soft }}>
            <a href="/raffles">Raffles</a><a href="/projects">NFT Projects</a><a href="/alpha">King of Alpha</a><a href="/chat">Community</a><a href="/how-it-works">How it works</a>
          </nav>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={switchTheme} aria-label="Toggle theme" style={{ border: `1px solid ${colors.border}`, background: colors.panel, color: colors.text, borderRadius: 10, padding: "9px 11px", fontSize: 12 }}>{theme === "dark" ? "☀" : "☾"}</button>
            <a href={loggedIn ? "/account" : "/account"} style={{ borderRadius: 10, background: colors.text, color: colors.inverse, padding: "10px 15px", fontSize: 11, fontWeight: 800 }}>{loggedIn ? "Account" : "Connect account"}</a>
          </div>
        </div>
      </header>

      <section style={{ maxWidth: 1240, margin: "auto", padding: "68px 24px 36px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.25fr) minmax(320px,.75fr)", gap: 18 }}>
          <div style={{ padding: "34px 0" }}>
            <div style={{ display: "inline-flex", gap: 8, alignItems: "center", border: `1px solid ${colors.border}`, background: colors.panel, borderRadius: 999, padding: "7px 11px", color: colors.muted, fontSize: 9, fontWeight: 800, letterSpacing: ".16em" }}><span style={{ color: "#36d779" }}>●</span> NFT RAFFLE COMMAND CENTER</div>
            <h1 style={{ fontSize: "clamp(48px,7vw,86px)", lineHeight: .92, letterSpacing: "-.065em", margin: "24px 0 22px", maxWidth: 850 }}>Raffles.<br /><span style={{ color: colors.accentSoft }}>Projects.</span><br />Community.</h1>
            <p style={{ maxWidth: 650, color: colors.muted, fontSize: 15, lineHeight: 1.8 }}>One place to discover NFT raffles, manage projects, complete verified tasks, earn alpha points and talk with the community.</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 28 }}><a href="/raffles" style={{ background: colors.accent, color: "white", borderRadius: 10, padding: "13px 19px", fontSize: 12, fontWeight: 900 }}>Explore Raffles</a><a href="/dashboard" style={{ border: `1px solid ${colors.border}`, background: colors.panel, borderRadius: 10, padding: "13px 19px", fontSize: 12, fontWeight: 800 }}>Creator Studio</a><a href="/account" style={{ border: `1px solid ${colors.border}`, background: colors.panel, borderRadius: 10, padding: "13px 19px", fontSize: 12, fontWeight: 800 }}>My Account</a></div>
          </div>
          <div style={{ border: `1px solid ${colors.border}`, borderRadius: 22, padding: 22, background: `linear-gradient(145deg,${colors.panel},${colors.panel2})`, alignSelf: "center" }}>
            <div style={{ display: "flex", justifyContent: "space-between", color: colors.muted, fontSize: 9, letterSpacing: ".16em" }}><span>RAVEN ENGINE</span><span style={{ color: "#36d779", fontWeight: 800 }}>● ONLINE</span></div>
            <div style={{ margin: "28px 0", display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10 }}>
              {[['01','Discover','NFT raffles & projects'],['02','Verify','X + Discord tasks'],['03','Enter','Fair eligibility'],['04','Win','Claim securely']].map(([n,t,d]) => <div key={n} style={{ border: `1px solid ${colors.border}`, background: colors.bg, borderRadius: 13, padding: 14 }}><small style={{ color: colors.accent, fontWeight: 900 }}>{n}</small><b style={{ display: "block", marginTop: 8, fontSize: 12 }}>{t}</b><span style={{ display: "block", marginTop: 4, color: colors.muted, fontSize: 9, lineHeight: 1.5 }}>{d}</span></div>)}
            </div>
            <a href="/how-it-works" style={{ display: "block", textAlign: "center", borderRadius: 10, padding: 11, background: colors.text, color: colors.inverse, fontSize: 11, fontWeight: 900 }}>See the full platform flow →</a>
          </div>
        </div>
      </section>

      <section style={{ borderTop: `1px solid ${colors.border}`, borderBottom: `1px solid ${colors.border}` }}>
        <div style={{ maxWidth: 1240, margin: "auto", padding: "0 24px", display: "grid", gridTemplateColumns: "repeat(4,1fr)" }}>
          {[['Raffles','Live + scheduled'],['NFT Projects','Approved communities'],['King of Alpha','Verified points'],['Community','Live discussion']].map(([a,b]) => <div key={a} style={{ padding: "20px 16px", borderRight: `1px solid ${colors.border}` }}><b style={{ display: "block", fontSize: 13 }}>{a}</b><span style={{ color: colors.muted, fontSize: 9 }}>{b}</span></div>)}
        </div>
      </section>

      <section style={{ maxWidth: 1240, margin: "auto", padding: "64px 24px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", marginBottom: 18 }}><div><small style={{ color: colors.muted, fontSize: 9, letterSpacing: ".18em", fontWeight: 900 }}>LIVE OPPORTUNITIES</small><h2 style={{ margin: "7px 0 0", fontSize: 28, letterSpacing: "-.03em" }}>Active NFT raffles</h2></div><a href="/raffles" style={{ color: colors.accent, fontSize: 11, fontWeight: 900 }}>View all →</a></div>
        {loading ? <div style={{ border: `1px dashed ${colors.border}`, borderRadius: 16, padding: 45, color: colors.muted, textAlign: "center" }}>Loading opportunities…</div> : raffles.length === 0 ? <div style={{ border: `1px dashed ${colors.border}`, borderRadius: 16, padding: 45, color: colors.muted, textAlign: "center" }}>No live raffles yet. Approved communities will appear here.</div> : <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 12 }}>{raffles.map((r) => <a href={`/raffles/${r.id}`} key={r.id} style={{ border: `1px solid ${colors.border}`, background: colors.panel, borderRadius: 17, padding: 18, display: "grid", gridTemplateColumns: "54px 1fr auto", gap: 14, alignItems: "center" }}><div style={{ width: 54, height: 54, borderRadius: 14, display: "grid", placeItems: "center", background: `linear-gradient(135deg,${colors.accent}55,${colors.accent}12)`, color: colors.accentSoft, fontWeight: 900 }}>{initials(r.project?.name || r.title)}</div><div><small style={{ color: colors.muted, fontSize: 8, letterSpacing: ".15em" }}>{r.status}</small><b style={{ display: "block", marginTop: 5, fontSize: 14 }}>{r.title}</b><span style={{ color: colors.muted, fontSize: 10 }}>{r.prizeQuantity} × {r.prizeName}</span></div><span style={{ color: colors.accent, fontSize: 10, fontWeight: 900 }}>{timeLeft(r.endsAt)}</span></a>)}</div>}
      </section>

      <section style={{ maxWidth: 1240, margin: "auto", padding: "64px 24px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", marginBottom: 18 }}><div><small style={{ color: colors.muted, fontSize: 9, letterSpacing: ".18em", fontWeight: 900 }}>PLATFORM</small><h2 style={{ margin: "7px 0 0", fontSize: 28 }}>Everything in one place</h2></div></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
          {[['🎟','Raffle Hub','Discover active, scheduled and completed NFT giveaways.','/raffles'],['◈','NFT Projects','Explore approved NFT communities and their raffles.','/projects'],['♛','King of Alpha','Submit useful NFT opportunities and climb the verified leaderboard.','/alpha'],['#','Community Chat','Talk with collectors, creators and alpha hunters.','/chat'],['◎','Account Center','Connect X + Discord and manage your prize addresses.','/account'],['◆','Creator Studio','Create, publish, evaluate, draw and manage winners.','/dashboard']].map(([icon,title,desc,href]) => <a href={href} key={href} style={{ border: `1px solid ${colors.border}`, background: colors.panel, borderRadius: 17, padding: 20, minHeight: 145, transition: "transform .2s" }}><span style={{ color: colors.accent, fontSize: 18 }}>{icon}</span><b style={{ display: "block", marginTop: 14, fontSize: 15 }}>{title}</b><p style={{ margin: "7px 0 0", color: colors.muted, fontSize: 10, lineHeight: 1.7 }}>{desc}</p><span style={{ display: "block", marginTop: 14, color: colors.accent, fontSize: 10, fontWeight: 900 }}>Open →</span></a>)}
        </div>
      </section>

      <section style={{ maxWidth: 1240, margin: "auto", padding: "64px 24px 0", display: "grid", gridTemplateColumns: "1.1fr .9fr", gap: 12 }}>
        <div style={{ border: `1px solid ${colors.border}`, background: colors.panel, borderRadius: 18, padding: 22 }}><div style={{ display: "flex", justifyContent: "space-between" }}><div><small style={{ color: colors.muted, fontSize: 9, letterSpacing: ".18em", fontWeight: 900 }}>KING OF ALPHA</small><h2 style={{ margin: "7px 0 0", fontSize: 24 }}>Community intelligence</h2></div><a href="/alpha" style={{ color: colors.accent, fontSize: 10, fontWeight: 900 }}>Open →</a></div><p style={{ color: colors.muted, fontSize: 11, lineHeight: 1.7, maxWidth: 570 }}>Useful opportunities are submitted with evidence, verified by moderators and converted into points. No verified evidence, no points.</p><div style={{ marginTop: 18, display: "grid", gap: 7 }}>{leaders.length === 0 ? <span style={{ color: colors.muted, fontSize: 10 }}>No verified alpha points yet.</span> : leaders.map((u, i) => <div key={u.userId} style={{ display: "grid", gridTemplateColumns: "28px 32px 1fr auto", alignItems: "center", gap: 10, padding: 9, border: `1px solid ${colors.border}`, borderRadius: 10, background: colors.bg }}><span style={{ color: colors.muted, fontSize: 9 }}>#{i + 1}</span><span style={{ width: 28, height: 28, borderRadius: "50%", display: "grid", placeItems: "center", background: `${colors.accent}20`, color: colors.accent, fontSize: 9, fontWeight: 900 }}>{initials(u.displayName || u.username)}</span><span style={{ fontSize: 11 }}>{u.displayName || u.username || "Raven member"}</span><b style={{ color: colors.accent, fontSize: 11 }}>{u.points} pts</b></div>)}</div></div>
        <div style={{ border: `1px solid ${colors.border}`, background: colors.panel, borderRadius: 18, padding: 22 }}><div style={{ display: "flex", justifyContent: "space-between" }}><div><small style={{ color: colors.muted, fontSize: 9, letterSpacing: ".18em", fontWeight: 900 }}>COMMUNITY</small><h2 style={{ margin: "7px 0 0", fontSize: 24 }}>Live chat</h2></div><a href="/chat" style={{ color: colors.accent, fontSize: 10, fontWeight: 900 }}>Open →</a></div><div style={{ marginTop: 18, display: "grid", gap: 10 }}>{messages.length === 0 ? <span style={{ color: colors.muted, fontSize: 10 }}>The community room is quiet right now.</span> : messages.map((m) => <div key={m.id} style={{ borderBottom: `1px solid ${colors.border}`, paddingBottom: 10 }}><b style={{ fontSize: 10 }}>{m.user?.displayName || m.user?.username || "Raven member"}</b><p style={{ margin: "4px 0 0", color: colors.muted, fontSize: 10, lineHeight: 1.5 }}>{m.message}</p></div>)}</div></div>
      </section>

      <section style={{ maxWidth: 1240, margin: "auto", padding: "64px 24px 80px" }}>
        <div style={{ border: `1px solid ${colors.border}`, background: `linear-gradient(135deg,${colors.accent}18,${colors.panel})`, borderRadius: 22, padding: "28px 30px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}><div><small style={{ color: colors.accent, fontSize: 9, fontWeight: 900, letterSpacing: ".18em" }}>BUILD WITH RAVEN ORACLE</small><h2 style={{ margin: "7px 0", fontSize: 25 }}>Run your NFT community raffle.</h2><p style={{ margin: 0, color: colors.muted, fontSize: 11 }}>Create a project, configure tasks, publish the raffle and let Raven Oracle handle eligibility and the fair draw.</p></div><a href="/projects/new" style={{ background: colors.text, color: colors.inverse, borderRadius: 10, padding: "12px 18px", fontSize: 11, fontWeight: 900 }}>Submit NFT project →</a></div>
      </section>

      <footer style={{ borderTop: `1px solid ${colors.border}`, padding: "28px 24px", color: colors.muted, fontSize: 9 }}><div style={{ maxWidth: 1240, margin: "auto", display: "flex", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}><span>© 2026 RAVEN ORACLE · NFT COMMUNITY RAFFLE PLATFORM</span><div style={{ display: "flex", gap: 18 }}><a href="/raffles">Raffles</a><a href="/projects">Projects</a><a href="/alpha">Alpha</a><a href="/chat">Community</a><a href="/account">Account</a></div></div></footer>
    </main>
  );
}
