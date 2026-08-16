"use client";

import { useEffect, useMemo, useState } from "react";
import ThemeToggle from "../../components/ThemeToggle";
import styles from "./raffles.module.css";

type Raffle = { id: string; title: string; description?: string | null; prizeName: string; prizeQuantity: number; startsAt: string; endsAt: string; status: "SCHEDULED" | "ACTIVE" | "CLOSED" | "COMPLETED"; };
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";
function formatDate(value: string) { return new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }); }
function timeLabel(raffle: Raffle) { const now = Date.now(); const start = new Date(raffle.startsAt).getTime(); const end = new Date(raffle.endsAt).getTime(); if (raffle.status === "SCHEDULED" || start > now) return `Starts ${formatDate(raffle.startsAt)}`; if (raffle.status === "ACTIVE" && end > now) return `Ends ${formatDate(raffle.endsAt)}`; return "Draw completed"; }

export default function RafflesPage() {
  const [raffles, setRaffles] = useState<Raffle[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [filter, setFilter] = useState<"ALL" | "ACTIVE" | "SCHEDULED" | "COMPLETED">("ALL"); const [query, setQuery] = useState("");
  useEffect(() => { let cancelled = false; fetch(`${API}/raffles/public`).then(async r => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.message ?? "Unable to load raffles"); return d as { raffles: Raffle[] }; }).then(d => { if (!cancelled) setRaffles(d.raffles ?? []); }).catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : "Unable to load raffles"); }).finally(() => { if (!cancelled) setLoading(false); }); return () => { cancelled = true; }; }, []);
  const visible = useMemo(() => raffles.filter(r => (filter === "ALL" || r.status === filter) && `${r.title} ${r.description ?? ""} ${r.prizeName}`.toLowerCase().includes(query.trim().toLowerCase())), [raffles, filter, query]);
  return <main className={styles.page}>
    <header className={styles.header}><div className={styles.headerInner}><a href="/" className={styles.brand}><span className={styles.mark}>R</span><span><b>RAVEN ORACLE</b><small>NFT RAFFLES</small></span></a><nav className={styles.nav}><a href="/raffles" className={styles.active}>Raffles</a><a href="/projects">NFT Projects</a><a href="/how-it-works">How it works</a></nav><div className={styles.actions}><ThemeToggle /><a href="/create" className={styles.create}>Create raffle</a></div></div></header>
    <div className={styles.container}>
      <section className={styles.hero}><span className={styles.eyebrow}>NFT GIVEAWAYS · VERIFIED COMMUNITIES</span><h1>Find your next <span>win.</span></h1><p>Discover verified NFT raffles, complete the required community actions, and enter from one secure place. Browse freely — connect only when you're ready to enter.</p></section>
      <section className={styles.toolbar}><div className={styles.search}><span className={styles.searchIcon}>⌕</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search NFT raffles…" /></div><div className={styles.filters}>{(["ALL","ACTIVE","SCHEDULED","COMPLETED"] as const).map(item => <button key={item} onClick={() => setFilter(item)} className={filter === item ? styles.selected : ""}>{item === "ALL" ? "ALL RAFFLES" : item}</button>)}</div></section>
      {error && <div className={styles.error}>{error}</div>}
      {loading ? <div className={styles.loading}>Loading verified NFT raffles…</div> : visible.length === 0 ? <div className={styles.empty}><b>No NFT raffles found.</b><div>Try another search or check the scheduled drops.</div></div> : <div className={styles.grid}>{visible.map(raffle => <a key={raffle.id} href={`/raffles/${raffle.id}`} className={styles.card}><div className={styles.cardTop}><div className={styles.glow}/><div className={styles.orb}>R</div><span className={`${styles.status} ${raffle.status === "ACTIVE" ? styles.live : raffle.status === "SCHEDULED" ? styles.scheduled : styles.ended}`}>{raffle.status}</span></div><div className={styles.body}><span className={styles.time}>{timeLabel(raffle)}</span><h2 className={styles.title}>{raffle.title}</h2><p className={styles.desc}>{raffle.description ?? "Verified NFT community giveaway."}</p><div className={styles.prize}><div className={styles.label}>PRIZE</div><div className={styles.prizeName}>{raffle.prizeName}</div></div><div className={styles.footer}><span>{raffle.prizeQuantity} winner{raffle.prizeQuantity === 1 ? "" : "s"}</span><span className={styles.enter}>{raffle.status === "ACTIVE" ? "ENTER RAFFLE →" : "VIEW RAFFLE →"}</span></div></div></a>)}</div>}
    </div>
  </main>;
}
