type RavenLogoProps = { className?: string; showWordmark?: boolean; compact?: boolean };

/**
 * Canonical Raven Oracle brand asset.
 *
 * The PNG is the approved final logo supplied for the project. Keep the same
 * asset everywhere instead of recreating the mark or wrapping it in an SVG.
 */
export default function RavenLogo({ className = "", compact = false }: RavenLogoProps) {
  return (
    <div className={`flex items-center ${className}`} aria-label="Raven Oracle">
      <img
        src="/raven-oracle-logo.png"
        alt="Raven Oracle"
        className={`${compact ? "h-12 w-auto" : "h-28 w-auto"} shrink-0 object-contain`}
      />
    </div>
  );
}
