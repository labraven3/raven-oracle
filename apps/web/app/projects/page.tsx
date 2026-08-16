"use client";

import { useEffect, useMemo, useState } from "react";
import ThemeToggle from "../../components/ThemeToggle";

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
    <main className="projects-page">
      <header className="site-header">
        <div className="site-header-inner">
          <a href="/" className="site-brand"><span className="site-brand-mark">R</span><span><b>RAVEN ORACLE</b><small>COMMUNITY INTELLIGENCE</small></span></a>
          <nav className="site-nav"><a href="/raffles">Raffles</a><a href="/projects" className="active">Projects</a><a href="/dashboard">Creator Studio</a></nav>
          <ThemeToggle />
        </div>
      </header>

      <section className="projects-hero">
        <div className="eyebrow">DISCOVER · NFT</div>
        <h1>Explore <span>NFT</span> projects.</h1>
        <p>Discover approved NFT communities and jump directly into their live or upcoming raffles.</p>
      </section>

      <section className="projects-content">
        <div className="project-toolbar">
          <div className="search-wrap"><span>⌕</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search NFT projects…" /></div>
          <div className="filter-pill"><button className={category === "ALL" ? "selected" : ""} onClick={() => setCategory("ALL")}>ALL</button><button className={category === "NFT" ? "selected" : ""} onClick={() => setCategory("NFT")}>NFT</button></div>
        </div>

        {loading ? <div className="empty-state">Loading projects…</div> : error ? <div className="error-state">{error}</div> : filtered.length === 0 ? (
          <div className="empty-state"><div className="empty-icon">◈</div><h2>{category === "NFT" ? "No approved NFT projects yet." : "No approved projects yet."}</h2><p>New communities will appear here after they are approved.</p></div>
        ) : (
          <div className="projects-grid-modern">{filtered.map(p => (
            <a key={p.id} href={`/projects/${p.id}`} className="project-card-modern">
              <div className="project-cover"><div className="project-cover-glow" />{p.logoUrl ? <img src={p.logoUrl} alt="" /> : <span>{p.name.slice(0, 1)}</span>}<em>NFT</em></div>
              <div className="project-body"><div className="project-title"><div><h2>{p.name}</h2><span>Verified community</span></div><span className="arrow">↗</span></div><p>{p.description || "An approved NFT community on Raven Oracle."}</p><div className="project-meta"><span>NFT</span><span>View project</span></div></div>
            </a>
          ))}</div>
        )}
      </section>
    </main>
  );
}
