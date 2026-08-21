type RavenLogoProps = { className?: string; showWordmark?: boolean; compact?: boolean };

export default function RavenLogo({ className = "", showWordmark = true, compact = false }: RavenLogoProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`} aria-label="Raven Oracle">
      <img
        src="/raven-logo-mark.svg"
        alt="Raven Oracle"
        className={`${compact ? "h-10 w-10" : "h-12 w-12"} shrink-0 object-contain`}
      />
      {showWordmark && (
        <span className="leading-none">
          <span className="block text-sm font-black tracking-[.2em] text-zinc-900 dark:text-white">RAVEN</span>
          <span className="mt-1 block text-[8px] font-bold tracking-[.28em] text-violet-600 dark:text-violet-300">ORACLE</span>
        </span>
      )}
    </div>
  );
}
