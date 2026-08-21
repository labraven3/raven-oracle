type RavenLogoProps = { className?: string; showWordmark?: boolean; compact?: boolean };

/**
 * Canonical Raven Oracle brand asset.
 *
 * Use the exact approved PNG asset supplied for the project.
 * Do not recreate, redraw, or convert the logo.
 */
export default function RavenLogo({ className = "", compact = false }: RavenLogoProps) {
  return (
    <div className={`flex items-center ${className}`} aria-label="Raven Oracle">
      <img
        src="/RavenOracleLogo.png"
        alt="Raven Oracle"
        className={`${compact ? "h-12 w-auto" : "h-28 w-auto"} shrink-0 object-contain`}
      />
    </div>
  );
}
