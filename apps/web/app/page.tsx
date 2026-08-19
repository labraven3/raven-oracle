"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { API_BASE_URL } from "@/lib/api-config";

type Raffle = {
  id: string;
  title: string;
  description?: string | null;
  prizeName: string;
  prizeQuantity: number;
  startsAt: string;
  endsAt: string;
  status: string;
  project?: { id?: string; name?: string | null; logoUrl?: string | null } | null;
};

type Project = {
  id: string;
  name: string;
  description?: string | null;
  logoUrl?: string | null;
  status?: string;
  category?: string;
};

type Leader = {
  userId: string;
  username?: string | null;
  displayName?: string | null;
  points: number;
};

async function api<T>(path: string): Promise<T> {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("raven_token");
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }
  const response = await fetch(`${API_BASE_URL}${path}`, { headers, cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message ?? `Request failed (${response.status})`);
  return data as T;
}

function initials(value?: string | null) {
  return (value || "RO").replace(/[^a-zA-Z0-9 ]/g, "").split(" ").filter(Boolean).slice(0, 2).map((x) => x[0]).join("").toUpperCase() || "RO";
}

function timeLabel(value: string) {
  const diff = new Date(value).getTime() - Date.now();
  if (diff <= 0) return "Ended";
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

export default function Home() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [raffles, setRaffles] = useState<Raffle[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("ALL");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initTheme = async () => {
      const saved = localStorage.getItem("raven-theme") as "dark" | "light" | null;
      const next = saved ?? (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
      setTheme(next);
      document.documentElement.classList.toggle("light", next === "light");
    };
    void initTheme();
  }, []);

  useEffect(() => {
    void Promise.all([
      api<{ raffles: Raffle[] }>("/raffles/public").catch(() => ({ raffles: [] })),
      api<{ projects: Project[] }>("/projects/public").catch(() => ({ projects: [] })),
      api<{ leaderboard: Leader[] }>("/alpha/leaderboard").catch(() => ({ leaderboard: [] })),
    ]).then(([r, p, l]) => {
      setRaffles(r.raffles.filter((x) => ["ACTIVE", "SCHEDULED"].includes(x.status)));
      setProjects(p.projects.filter((x) => !x.category || x.category === "NFT"));
      setLeaders(l.leaderboard.slice(0, 5));
    }).finally(() => setLoading(false));
  }, []);

  const colors = theme === "dark"
    ? { bg: "#0b0a12", sidebar: "#0e0d16", panel: "#15131f", panel2: "#191724", border: "#302c40", text: "#f5f3fa", muted: "#8f8a9e", accent: "#9b63ff", green: "#56d79b" }
    : { bg: "#f5f4f8", sidebar: "#ffffff", panel: "#ffffff", panel2: "#f0eef5", border: "#ded9e8", text: "#1b1822", muted: "#746d80", accent: "#7040d9", green: "#159967" };

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("raven-theme", next);
    document.documentElement.classList.toggle("light", next === "light");
  };

  const filteredProjects = useMemo(() => projects.filter((p) => {
    const matchesSearch = !search || `${p.name} ${p.description ?? ""}`.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = category === "ALL" || (p.category ?? "NFT") === category;
    return matchesSearch && matchesCategory;
  }), [projects, search, category]);

  const featured = filteredProjects[0];
  const trendingProjects = filteredProjects.slice(0, 4);
  const trendingRaffles = raffles.slice(0, 6);

  const card: React.CSSProperties = { background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 12 };
  const nav = (active?: boolean): React.CSSProperties => ({ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, color: active ? colors.text : colors.muted, background: active ? colors.panel2 : "transparent", fontSize: 12, fontWeight: active ? 800 : 600 });

  return (
    <main style={{ minHeight: "100vh", background: colors.bg, color: colors.text, display: "flex", fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}>
      <aside style={{ width: 220, flexShrink: 0, minHeight: "100vh", background: colors.sidebar, borderRight: `1px solid ${colors.border}`, padding: "22px 14px", position: "sticky", top: 0, height: "100vh", display: "flex", flexDirection: "column" }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 8px 24px", color: colors.text }}>
          <span style={{ width: 32, height: 32, borderRadius: 9, display: "grid", placeItems: "center", background: `linear-gradient(135deg,${colors.accent},#5a27a9)`, color: "white", fontWeight: 900 }}>R</span>
          <span><b style={{ display: "block", fontSize: 13, letterSpacing: ".14em" }}>RAVEN</b><small style={{ color: colors.muted, fontSize: 8, letterSpacing: ".12em" }}>ORACLE</small></span>
        </Link>
        <label style={{ position: "relative", display: "block", marginBottom: 18 }}>
          <span style={{ position: "absolute", left: 11, top: 10, color: colors.muted, fontSize: 12 }}>⌕</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search projects" style={{ width: "100%", boxSizing: "border-box", background: colors.panel, border: `1px solid ${colors.border}`, color: colors.text, borderRadius: 8, padding: "9px 10px 9px 30px", outline: "none", fontSize: 11 }} />
        </label>
        <nav style={{ display: "grid", gap: 3 }}>
          <Link href="/" style={nav(true)}>⌂ <span>Home</span></Link>
          <Link href="/dashboard" style={nav()}>▦ <span>Creator Studio</span></Link>
          <Link href="/account" style={nav()}>◎ <span>Account</span></Link>
        </nav>
        <div style={{ margin: "22px 7px 9px", color: colors.muted, fontSize: 8, letterSpacing: ".16em", fontWeight: 900 }}>EXPLORE</div>
        <nav style={{ display: "grid", gap: 3 }}>
          <Link href="/projects" style={nav()}>◈ <span>NFT Projects</span></Link>
          <Link href="/raffles" style={nav()}>🎟 <span>Raffles</span></Link>
          <Link href="/alpha" style={nav()}>♛ <span>King of Alpha</span></Link>
          <Link href="/how-it-works" style={nav()}>ⓘ <span>How it works</span></Link>
        </nav>
        <div style={{ marginTop: "auto" }}>
          <button onClick={toggleTheme} style={{ width: "100%", border: `1px solid ${colors.border}`, background: colors.panel, color: colors.text, borderRadius: 8, padding: 9, fontSize: 11, cursor: "pointer" }}>{theme === "dark" ? "☀  Light mode" : "☾  Dark mode"}</button>
          <Link href="/account" style={{ display: "block", marginTop: 8, textAlign: "center", background: colors.text, color: theme === "dark" ? "#0b0a12" : "white", borderRadius: 8, padding: 10, fontSize: 11, fontWeight: 900 }}>Account →</Link>
        </div>
      </aside>

      <div style={{ flex: 1, minWidth: 0 }}>
        <header style={{ height: 64, borderBottom: `1px solid ${colors.border}`, display: "flex", alignItems: "center", justifyContent: "flex-end", padding: "0 28px", gap: 18, background: colors.bg }}>
          <span style={{ color: colors.muted, fontSize: 10 }}>NFT RAFFLE PLATFORM</span>
          <Link href="/projects/new" style={{ border: `1px solid ${colors.border}`, background: colors.panel, color: colors.text, borderRadius: 8, padding: "9px 13px", fontSize: 10, fontWeight: 800 }}>Create project</Link>
        </header>

        <div style={{ maxWidth: 1240, margin: "0 auto", padding: "28px 28px 60px" }}>
          <section style={{ display: "flex", alignItems: "end", justifyContent: "space-between", gap: 20, marginBottom: 18 }}>
            <div><div style={{ color: colors.muted, fontSize: 9, letterSpacing: ".16em", fontWeight: 900 }}>DISCOVER</div><h1 style={{ margin: "6px 0 0", fontSize: 32, letterSpacing: "-.04em" }}>NFT projects & raffles</h1><p style={{ margin: "8px 0 0", color: colors.muted, fontSize: 12 }}>Discover approved projects and upcoming whitelist opportunities.</p></div>
            <Link href="/raffles" style={{ color: colors.accent, fontSize: 11, fontWeight: 900 }}>View all raffles →</Link>
          </section>

          <section style={{ ...card, padding: 14, marginBottom: 28 }}>
            <div style={{ display: "flex", gap: 8, overflowX: "auto" }}>
              {["ALL", "NFT"].map((item) => <button key={item} onClick={() => setCategory(item)} style={{ border: `1px solid ${category === item ? colors.accent : colors.border}`, background: category === item ? `${colors.accent}18` : "transparent", color: category === item ? colors.accent : colors.muted, borderRadius: 7, padding: "7px 14px", fontSize: 10, fontWeight: 800, cursor: "pointer" }}>{item}</button>)}
            </div>
          </section>

          <section style={{ marginBottom: 30 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}><h2 style={{ fontSize: 15, margin: 0 }}>Trending projects</h2><Link href="/projects" style={{ color: colors.muted, fontSize: 10 }}>View all →</Link></div>
            {loading ? <div style={{ ...card, padding: 28, color: colors.muted, fontSize: 11 }}>Loading projects…</div> : trendingProjects.length === 0 ? <div style={{ ...card, padding: 28, color: colors.muted, fontSize: 11 }}>No approved NFT projects yet.</div> : <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 10 }}>{trendingProjects.map((p) => <Link href={`/projects/${p.id}`} key={p.id} style={{ ...card, padding: 13, minWidth: 0 }}><div style={{ display: "flex", alignItems: "center", gap: 9 }}><div style={{ width: 34, height: 34, flexShrink: 0, borderRadius: 8, background: colors.panel2, display: "grid", placeItems: "center", color: colors.accent, fontWeight: 900, fontSize: 10, overflow: "hidden" }}>{p.logoUrl ? <img src={p.logoUrl} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initials(p.name)}</div><div style={{ minWidth: 0 }}><b style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 11 }}>{p.name}</b><span style={{ color: colors.muted, fontSize: 9 }}>NFT · {p.status ?? "APPROVED"}</span></div></div><div style={{ marginTop: 14, display: "flex", justifyContent: "space-between", color: colors.muted, fontSize: 9 }}><span>Raffles</span><span style={{ color: colors.text }}>Explore →</span></div></Link>)}</div>}
          </section>

          {featured && <section style={{ marginBottom: 30 }}><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}><h2 style={{ fontSize: 15, margin: 0 }}>Raven Oracle pick</h2><span style={{ color: colors.green, fontSize: 9, fontWeight: 900 }}>APPROVED</span></div><Link href={`/projects/${featured.id}`} style={{ ...card, padding: 20, display: "grid", gridTemplateColumns: "1fr 230px", gap: 20, background: `linear-gradient(120deg,${colors.panel},${colors.panel2})` }}><div><div style={{ color: colors.accent, fontSize: 9, letterSpacing: ".15em", fontWeight: 900 }}>FEATURED NFT PROJECT</div><h2 style={{ margin: "9px 0 7px", fontSize: 24 }}>{featured.name}</h2><p style={{ color: colors.muted, fontSize: 11, lineHeight: 1.7, maxWidth: 650 }}>{featured.description || "Explore this approved NFT community and its upcoming whitelist opportunities."}</p><span style={{ display: "inline-block", marginTop: 12, color: colors.text, fontSize: 10, fontWeight: 900 }}>View project →</span></div><div style={{ minHeight: 120, borderRadius: 10, background: colors.bg, border: `1px solid ${colors.border}`, display: "grid", placeItems: "center", overflow: "hidden" }}>{featured.logoUrl ? <img src={featured.logoUrl} alt={featured.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 34, fontWeight: 900, color: colors.accent }}>{initials(featured.name)}</span>}</div></Link></section>}

          <section style={{ marginBottom: 30 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}><div><h2 style={{ fontSize: 15, margin: 0 }}>Trending raffles</h2><span style={{ color: colors.muted, fontSize: 9 }}>Live and scheduled whitelist opportunities</span></div><Link href="/raffles" style={{ color: colors.muted, fontSize: 10 }}>View all →</Link></div>
            {loading ? <div style={{ ...card, padding: 28, color: colors.muted, fontSize: 11 }}>Loading raffles…</div> : trendingRaffles.length === 0 ? <div style={{ ...card, padding: 28, color: colors.muted, fontSize: 11 }}>No active raffles yet.</div> : <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 10 }}>{trendingRaffles.map((r) => <Link href={`/raffles/${r.id}`} key={r.id} style={{ ...card, padding: 14 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}><span style={{ color: colors.green, fontSize: 8, fontWeight: 900 }}>{r.status}</span><span style={{ color: colors.muted, fontSize: 9 }}>{timeLabel(r.endsAt)}</span></div><b style={{ display: "block", marginTop: 16, fontSize: 13 }}>{r.title}</b><span style={{ display: "block", marginTop: 5, color: colors.muted, fontSize: 9 }}>{r.project?.name ?? "NFT Project"}</span><div style={{ marginTop: 16, paddingTop: 11, borderTop: `1px solid ${colors.border}`, display: "flex", justifyContent: "space-between", fontSize: 9 }}><span style={{ color: colors.muted }}>Prize</span><strong>{r.prizeQuantity} × {r.prizeName}</strong></div></Link>)}</div>}
          </section>

          <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ ...card, padding: 18 }}><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 15 }}><h2 style={{ fontSize: 14, margin: 0 }}>King of Alpha</h2><Link href="/alpha" style={{ color: colors.muted, fontSize: 9 }}>Leaderboard →</Link></div>{leaders.length === 0 ? <span style={{ color: colors.muted, fontSize: 10 }}>No leaderboard data yet.</span> : leaders.map((l, i) => <div key={l.userId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderTop: i ? `1px solid ${colors.border}` : "none" }}><span style={{ width: 20, color: colors.muted, fontSize: 9 }}>#{i + 1}</span><div style={{ flex: 1 }}><b style={{ fontSize: 10 }}>{l.displayName || l.username || "Anonymous"}</b></div><strong style={{ color: colors.accent, fontSize: 10 }}>{l.points} pts</strong></div>)}</div>
            <div style={{ ...card, padding: 18 }}><h2 style={{ fontSize: 14, margin: "0 0 15px" }}>For creators</h2><p style={{ color: colors.muted, fontSize: 10, lineHeight: 1.7, margin: 0 }}>Launch an NFT whitelist raffle, configure eligibility tasks, draw verified winners and export the final whitelist.</p><div style={{ display: "flex", gap: 8, marginTop: 18 }}><Link href="/projects/new" style={{ background: colors.accent, color: "white", borderRadius: 7, padding: "9px 12px", fontSize: 9, fontWeight: 900 }}>Create project</Link><Link href="/dashboard" style={{ border: `1px solid ${colors.border}`, color: colors.text, borderRadius: 7, padding: "9px 12px", fontSize: 9, fontWeight: 800 }}>Creator Studio</Link></div></div>
          </section>
        </div>
      </div>
    </main>
  );
}
