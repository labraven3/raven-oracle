"use client";

import { useEffect, useMemo, useState } from "react";
import ThemeToggle from "../../components/ThemeToggle";
import styles from "./projects.module.css";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";
type Project = { id: string; name: string; slug: string; description: string | null; websiteUrl: string | null; xUrl: string | null; discordUrl: string | null; logoUrl: string; category: string; status: string; createdAt: string };

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${API}/projects`, { cache: "no-store" })
      .then(async r => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.message ?? "Unable to load projects"); return d; })
      .then(d => setProjects((d.projects ?? []).filter((p: Project) => p.status === "APPROVED")))
      .catch(e => setError(e instanceof Error ? e.message : "Unable to load projects"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => projects.filter(p =>
    (category === "ALL" || p.category === category) &&
    `${p.name} ${p.description ?? ""}`.toLowerCase().includes(query.trim().toLowerCase())
  ), [projects, query, category]);

  return (
    <main className={styles.page}>
      <header className={styles.header}><div className={styles.headerInner}>
        <a href="/" className={styles.brand}><span className={styles.brandMark}>R</span><span className={styles.brandText}><b>RAVEN ORACLE</b><small>COMMUNITY INTELLIGENCE</small></span></a>
        <nav className={styles.nav}><a href="/raffles">Raffles</a><a href="/projects" className={styles.active}>Projects</a><a href="/dashboard">Creator Studio</a></nav>
        <ThemeToggle />
      </div></header>

      <section className={styles.hero}><div className={styles.eyebrow}>DISCOVER · NFT</div><h1>Explore <span>NFT</span> projects.</h1><p>Discover approved NFT communities and jump directly into their live or upcoming raffles.</p></section>

      <section className={styles.content}>
        <div className={styles.toolbar}><div className={styles.search}><span>⌕</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search NFT projects…" /></div><div className={styles.filters}><button className={category === "ALL" ? styles.selected : ""} onClick={() => setCategory("ALL")}>ALL</button><button className={category === "NFT" ? styles.selected : ""} onClick={() => setCategory("NFT")}>NFT</button></div></div>
        {loading ? <div className={styles.empty}>Loading projects…</div> : error ? <div className={styles.error}>{error}</div> : filtered.length === 0 ? (
          <div className={styles.empty}><div className={styles.emptyIcon}>◈</div><h2>{category === "NFT" ? "No approved NFT projects yet." : "No approved projects yet."}</h2><p>New communities will appear here after they are approved.</p></div>
        ) : <div className={styles.grid}>{filtered.map(p => <a key={p.id} href={`/projects/${p.id}`} className={styles.card}>
          <div className={styles.cover}><div className={styles.coverGlow} />{p.logoUrl ? <img src={p.logoUrl} alt="" /> : <span>{p.name.slice(0, 1)}</span>}<em>NFT</em></div>
          <div className={styles.body}><div className={styles.title}><div><h2>{p.name}</h2><span>Verified community</span></div><span className={styles.arrow}>↗</span></div><p>{p.description || "An approved NFT community on Raven Oracle."}</p><div className={styles.meta}><span>NFT</span><span>VIEW PROJECT →</span></div></div>
        </a>)}</div>}
      </section>
    </main>
  );
}
