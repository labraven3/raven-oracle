type RavenLogoProps = { className?: string; showWordmark?: boolean; compact?: boolean };

/**
 * Canonical Raven Oracle brand lockup.
 *
 * Uses the approved mark + horizontal wordmark assets already stored in /public.
 * Both assets receive the same CSS theme treatment; no SVG redraw is used.
 */
export default function RavenLogo({ className = "", compact = false }: RavenLogoProps) {
  const markSize = compact ? "h-14 w-14" : "h-28 w-28";
  const wordmarkSize = compact ? "h-10 w-auto" : "h-14 w-auto";

  return (
    <div className={`flex items-center gap-3 ${className}`} aria-label="Raven Oracle">
      <img
        src="/RavenOracleLogo.jpeg"
        alt="Raven Oracle mark"
        className={`${markSize} shrink-0 object-contain transition-[filter] duration-300 dark:invert dark:hue-rotate-180`}
      />
      <img
        src="/RavenOracleWordmark.jpeg"
        alt="Raven Oracle"
        className={`${wordmarkSize} shrink-0 object-contain transition-[filter] duration-300 dark:invert dark:hue-rotate-180`}
      />
    </div>
  );
}
