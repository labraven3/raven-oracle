type RavenLogoProps = { className?: string; showWordmark?: boolean; compact?: boolean };

/**
 * Canonical Raven Oracle brand lockup.
 * Keep the mark and wordmark visually balanced without stretching either asset.
 */
export default function RavenLogo({ className = "", compact = false }: RavenLogoProps) {
  const markHeight = compact ? "h-9 sm:h-10" : "h-12 sm:h-14";
  const wordmarkHeight = compact ? "h-7 sm:h-8" : "h-9 sm:h-10";
  const imageClass = "raven-brand-logo raven-brand-theme block shrink-0 object-contain w-auto mix-blend-screen";

  return (
    <div
      data-raven-canonical="true"
      className={`flex shrink-0 items-center gap-0.5 overflow-visible leading-none ${className}`}
      aria-label="Raven Oracle"
    >
      <img
        src="/RavenOracleLogo.jpeg"
        alt="Raven Oracle mark"
        width={56}
        height={56}
        className={`${markHeight} ${imageClass}`}
      />
      <img
        src="/RavenOracleWordmark.jpeg"
        alt="Raven Oracle"
        width={132}
        height={40}
        className={`${wordmarkHeight} ${imageClass}`}
      />
    </div>
  );
}
