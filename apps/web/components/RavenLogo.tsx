type RavenLogoProps = { className?: string; showWordmark?: boolean; compact?: boolean };

export default function RavenLogo({ className = "", showWordmark = true, compact = false }: RavenLogoProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`} aria-label="Raven Oracle">
      <svg viewBox="0 0 120 120" className={compact ? "h-10 w-10" : "h-12 w-12"} role="img" aria-hidden="true">
        <defs>
          <linearGradient id="roPurple" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#b78cff"/><stop offset=".48" stopColor="#7c3aed"/><stop offset="1" stopColor="#2563eb"/></linearGradient>
          <linearGradient id="roSilver" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffffff"/><stop offset=".45" stopColor="#d9d7ff"/><stop offset="1" stopColor="#8b7cff"/></linearGradient>
          <filter id="roGlow"><feGaussianBlur stdDeviation="2.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        <circle cx="60" cy="60" r="53" fill="none" stroke="url(#roPurple)" strokeWidth="3" opacity=".9" strokeDasharray="96 18 35 14"/>
        <path d="M18 66c9-25 26-42 51-47l31 12-16 8 18 12-25 4 13 12-28 3-20 18-18-2 9-13-15 2z" fill="#11142a" stroke="url(#roPurple)" strokeWidth="2.2" filter="url(#roGlow)"/>
        <path d="M37 48l31-22 23 8-24 10-18 17z" fill="#262a4d" opacity=".9"/>
        <path d="M44 68l32-7 25 9-39 8-25 17z" fill="#171a35"/>
        <circle cx="73" cy="43" r="5.5" fill="#a78bfa" filter="url(#roGlow)"/><circle cx="73" cy="43" r="2" fill="#fff"/>
        <path d="M54 48h36l-8 10H56z" fill="url(#roSilver)" opacity=".95"/>
        <path d="M58 55h27v13H72l-14 13V67h14z" fill="#f8f7ff" stroke="#7c3aed" strokeWidth="1.5"/>
        <path d="M69 69h16l-11 10H59z" fill="#c4b5fd" opacity=".8"/>
      </svg>
      {showWordmark && (
        <span className="leading-none">
          <span className="block text-sm font-black tracking-[.2em] text-white">RAVEN</span>
          <span className="block mt-1 text-[8px] font-bold tracking-[.28em] text-violet-300">ORACLE</span>
        </span>
      )}
    </div>
  );
}
