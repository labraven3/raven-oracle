type RavenLogoProps = { className?: string; showWordmark?: boolean; compact?: boolean };

/**
 * Canonical Raven Oracle brand asset.
 *
 * Uses the approved Raven mark plus the approved horizontal wordmark.
 * Both assets receive the same CSS theme treatment; no SVG redraw is used.
 */
export default function RavenLogo({ className = "", compact = false }: RavenLogoProps) {
  const markSize = compact ? "h-11 w-11" : "h-20 w-20";
  const wordmarkSize = compact ? "h-8 w-auto" : "h-10 w-auto";

  return (
    <div className={`flex items-center gap-2 ${className}`} aria-label="Raven Oracle">
      <span className={`${markSize} shrink-0 overflow-hidden`}>
        <img
          src="/RavenOracleLogo.png"
          alt="Raven Oracle mark"
          className="h-full w-full object-cover object-top transition-[filter] duration-300 dark:invert dark:hue-rotate-180"
        />
      </span>
      <img
        src="/RavenOracleWordmark.png"
        alt="Raven Oracle"
        className={`${wordmarkSize} shrink-0 object-contain transition-[filter] duration-300 dark:invert dark:hue-rotate-180`}
      />
    </div>
  );
}
