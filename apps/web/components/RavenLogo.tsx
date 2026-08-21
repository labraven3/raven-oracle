type RavenLogoProps = { className?: string; showWordmark?: boolean; compact?: boolean };

/**
 * Canonical Raven Oracle brand asset.
 *
 * Uses the exact approved PNG asset supplied for the project.
 * The same asset is used everywhere; dark mode only adjusts it with CSS.
 */
export default function RavenLogo({ className = "", compact = false }: RavenLogoProps) {
  return (
    <div className={`flex items-center ${className}`} aria-label="Raven Oracle">
      <img
        src="/RavenOracleLogo.png"
        alt="Raven Oracle"
        className={`${compact ? "h-12 w-auto" : "h-28 w-auto"} shrink-0 object-contain transition-[filter] duration-300 dark:invert dark:hue-rotate-180`}
      />
    </div>
  );
}
