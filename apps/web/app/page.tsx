const hypedProjects = [
  {
    name: "ShadowVerse",
    symbol: "SV",
    score: "4.8",
    ratings: "1.2K",
    status: "🔥 Trending",
  },
  {
    name: "Void Labs",
    symbol: "VL",
    score: "4.6",
    ratings: "842",
    status: "🚀 Rising",
  },
  {
    name: "Pixel Realm",
    symbol: "PR",
    score: "4.5",
    ratings: "617",
    status: "⚡ Hot",
  },
  {
    name: "Raven Forge",
    symbol: "RF",
    score: "4.4",
    ratings: "391",
    status: "👀 Watching",
  },
];

const newProjects = [
  {
    name: "Neon District",
    symbol: "ND",
    score: "—",
    ratings: "New",
    status: "🆕 New",
  },
  {
    name: "Alpha Garden",
    symbol: "AG",
    score: "—",
    ratings: "New",
    status: "🆕 New",
  },
  {
    name: "Moon Protocol",
    symbol: "MP",
    score: "—",
    ratings: "New",
    status: "🆕 New",
  },
  {
    name: "Dark Matter",
    symbol: "DM",
    score: "—",
    ratings: "New",
    status: "🆕 New",
  },
];

const leaderboard = [
  { rank: 1, name: "AlphaHunter", points: "1,240" },
  { rank: 2, name: "CryptoRaven", points: "980" },
  { rank: 3, name: "MintSeeker", points: "760" },
  { rank: 4, name: "FreeMintKing", points: "645" },
  { rank: 5, name: "ChainScout", points: "520" },
];

const activity = [
  "AlphaHunter won ShadowVerse WL",
  "CryptoRaven submitted new alpha",
  "MintSeeker won the latest raffle",
  "FreeMintKing discovered a new free mint",
];

function ProjectCard({
  project,
}: {
  project: (typeof hypedProjects)[number];
}) {
  return (
    <div className="project-card">
      <div className="project-image">{project.symbol}</div>

      <div className="project-info">
        <div className="project-title-row">
          <h3>{project.name}</h3>
          <span className="project-status">{project.status}</span>
        </div>

        <div className="rating-row">
          <span className="stars">★★★★★</span>
          <strong>{project.score}</strong>
          <span className="muted">{project.ratings} ratings</span>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <main>
      {/* Navigation */}
      <nav className="navbar">
        <div className="nav-container">
          <div className="brand">
            <div className="brand-logo">R</div>
            <div>
              <div className="brand-name">RAVEN ORACLE</div>
              <div className="brand-tagline">OPEN ALPHA COMMUNITY</div>
            </div>
          </div>

          <div className="nav-links">
            <a href="#projects">Projects</a>
            <a href="#alpha">King of Alpha</a>
            <a href="#raffle">Raffles</a>
            <a href="#chat">Community</a>
          </div>

          <button className="login-button">Join Free</button>
        </div>
      </nav>

      {/* Hero */}
      <section className="hero">
        <div className="hero-glow" />

        <div className="hero-content">
          <div className="eyebrow">
            <span className="live-dot" />
            OPEN TO EVERYONE
          </div>

          <h1>
            The alpha
            <br />
            belongs to <span>everyone.</span>
          </h1>

          <p>
            Discover projects, share alpha, build your reputation and
            compete for rewards — without paying for an exclusive alpha group.
          </p>

          <div className="hero-buttons">
            <button className="primary-button">
              Explore Projects →
            </button>

            <button className="secondary-button">
              Join Raven Oracle
            </button>
          </div>

          <div className="hero-trust">
            <span>✓ Free to join</span>
            <span>✓ Community driven</span>
            <span>✓ Fair opportunities</span>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="stats-section">
        <div className="stats-container">
          <div>
            <strong>1,842</strong>
            <span>Community Members</span>
          </div>

          <div>
            <strong>247</strong>
            <span>Projects Discovered</span>
          </div>

          <div>
            <strong>89</strong>
            <span>Alpha Contributors</span>
          </div>

          <div>
            <strong>156</strong>
            <span>Rewards Distributed</span>
          </div>
        </div>
      </section>

      {/* Active Raffle */}
      <section className="section" id="raffle">
        <div className="section-heading">
          <div>
            <div className="section-label">COMMUNITY REWARD</div>
            <h2>🎟️ Active Raffle</h2>
          </div>

          <span className="live-badge">
            <span className="live-dot" />
            LIVE
          </span>
        </div>

        <div className="raffle-card">
          <div className="raffle-art">SV</div>

          <div className="raffle-content">
            <span className="raffle-label">WHITELIST GIVEAWAY</span>
            <h3>ShadowVerse — 1× WL Spot</h3>

            <p>
              A community raffle open to eligible Raven Oracle members.
            </p>

            <div className="raffle-requirements">
              <span>✓ Discord</span>
              <span>✓ X verified</span>
              <span>✓ 48h+ wallet</span>
            </div>
          </div>

          <div className="raffle-right">
            <div className="countdown-label">ENDS IN</div>
            <div className="countdown">02:14:32</div>
            <div className="entries">1,482 entries</div>
            <button className="primary-button small">View Raffle</button>
          </div>
        </div>
      </section>

      {/* Projects */}
      <section className="section" id="projects">
        <div className="section-heading">
          <div>
            <div className="section-label">COMMUNITY RANKED</div>
            <h2>🔥 Hyped Projects</h2>
          </div>

          <a href="#" className="view-all">
            View all →
          </a>
        </div>

        <div className="projects-grid">
          {hypedProjects.map((project) => (
            <ProjectCard key={project.name} project={project} />
          ))}
        </div>
      </section>

      {/* New Projects */}
      <section className="section">
        <div className="section-heading">
          <div>
            <div className="section-label">JUST DISCOVERED</div>
            <h2>🆕 New Projects</h2>
          </div>

          <a href="#" className="view-all">
            View all →
          </a>
        </div>

        <div className="projects-grid">
          {newProjects.map((project) => (
            <ProjectCard key={project.name} project={project} />
          ))}
        </div>
      </section>

      {/* Alpha + Leaderboard */}
      <section className="section split-section" id="alpha">
        <div className="alpha-panel">
          <div className="section-label">CONTRIBUTE & EARN</div>
          <h2>👑 King of Alpha</h2>

          <p>
            Find something valuable before everyone else? Submit it to the
            community. Verified discoveries earn Alpha Points and reputation.
          </p>

          <div className="alpha-features">
            <div>
              <span>01</span>
              <p>Discover something early</p>
            </div>

            <div>
              <span>02</span>
              <p>Submit your alpha</p>
            </div>

            <div>
              <span>03</span>
              <p>Get verified & earn points</p>
            </div>
          </div>

          <button className="secondary-button">Submit Alpha →</button>
        </div>

        <div className="leaderboard-panel">
          <div className="leaderboard-header">
            <div>
              <div className="section-label">TOP CONTRIBUTORS</div>
              <h2>Leaderboard</h2>
            </div>

            <span className="crown">👑</span>
          </div>

          <div className="leaderboard-list">
            {leaderboard.map((user) => (
              <div className="leaderboard-row" key={user.rank}>
                <div className="rank">#{user.rank}</div>

                <div className="avatar">
                  {user.name.charAt(0)}
                </div>

                <div className="leader-name">
                  {user.name}
                </div>

                <div className="points">
                  {user.points} <span>pts</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Live Activity */}
      <section className="ticker-section" id="chat">
        <div className="ticker-title">
          <span className="live-dot" />
          LIVE ACTIVITY
        </div>

        <div className="ticker-track">
          {activity.map((item, index) => (
            <span key={index}>
              {item} <b>•</b>
            </span>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer>
        <div className="footer-brand">
          <div className="brand-logo">R</div>
          <div>
            <div className="brand-name">RAVEN ORACLE</div>
            <div className="brand-tagline">OPEN ALPHA COMMUNITY</div>
          </div>
        </div>

        <p>
          Built for the community. Open to everyone.
        </p>

        <div className="footer-links">
          <a href="#">Discord</a>
          <a href="#">X</a>
          <a href="#">Rules</a>
          <a href="#">Fairness</a>
        </div>
      </footer>
    </main>
  );
}
