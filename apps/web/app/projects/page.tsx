"use client";

import { useEffect, useMemo, useState } from "react";
import ThemeToggle from "../../components/ThemeToggle";
import styles from "./projects.module.css";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";
type Project = { id: string; name: string; slug: string; description: string | null; websiteUrl: string | null; xUrl: string | null; discordUrl: string | null; logoUrl: string; category: string; status: string; createdAt: string };

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${API}/projects`, { cache: "no-store" })
      .then(async r => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.message ?? "Unable to load projects");
        return d;
      })
      .then(d => setProjects((d.projects ?? []).filter((p: Project) => p.status === "APPROVED" && p.category === "NFT")))
      .catch(e => setError(e instanceof Error ? e.message : "Unable to load projects"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => projects.filter(p =>
    `${p.name} ${p.description ?? ""}`.toLowerCase().includes(query.trim().toLowerCase())
  ), [projects, query]);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <a href="/" className={styles.brand}>
            <span className={styles.brandMark}>R</span>
            <span className={styles.brandText}><b>RAVEN ORACLE</b><small>NFT RAFFLE PLATFORM</small></span>
          </a>
          <nav className={styles.nav}><a href="/raffles">Raffles</a><a href="/projects" className={styles.active}>NFT Projects</a><a href="/dashboard">Creator Studio</a></nav>
          <ThemeToggle />
        </div>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <div className={styles.eyebrow}><span /> NFT DISCOVERY</div>
          <h1>Discover the communities.<br /><span>Enter the raffles.</span></h1>
          <p>Explore approved NFT projects and find live or upcoming raffles with real community rewards.</p>
        </div>
        <div className={styles.heroBadge}><strong>NFT</strong><span>ONLY</span><small>Curated communities<br />on Raven Oracle</small></div>
      </section>

      <section className={styles.content}>
        <div className={styles.toolbar}>
          <div className={styles.search}><span>⌕</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search NFT projects…" /></div>
          <div className={styles.nftFilter}>◈ NFT</div>
        </div>
        <div className={styles.resultLine}><span>{filtered.length} approved NFT {filtered.length === 1 ? "project" : "projects"}</span><span>Verified communities · Live rewards</span></div>

        {loading ? <div className={styles.empty}>Loading NFT projects…</div> : error ? <div className={styles.error}>{error}</div> : filtered.length === 0 ? (
          <div className={styles.empty}><div className={styles.emptyIcon}>◈</div><h2>No approved NFT projects yet.</h2><p>New NFT communities will appear here after they are approved.</p><a href="/raffles" className={styles.emptyButton}>Explore raffles →</a></div>
        ) : <div className={styles.grid}>{filtered.map(p => <a key={p.id} href={`/projects/${p.id}`} className={styles.card}>
          <div className={styles.cover}>
            <div className={styles.coverGlow} />
            {p.logoUrl ? <img src={p.logoUrl} alt="" /> : <span className={styles.fallback}>{p.name.slice(0, 1)}</span>}
            <em>NFT</em>
          </div>
          <div className={styles.body}>
            <div className={styles.title}><div><h2>{p.name}</h2><span className={styles.verified}>● VERIFIED COMMUNITY</span></div><span className={styles.arrow}>↗</span></div>
            <p>{p.description || "An approved NFT community on Raven Oracle."}</p>
            <div className={styles.meta}><span>NFT PROJECT</span><span>VIEW PROJECT →</span></div>
          </div>
        </a>)}</div>}
      </section>
    </main>
  );
}
