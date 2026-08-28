type RavenLogoProps = { className?: string; showWordmark?: boolean; compact?: boolean };

/**
 * Canonical Raven Oracle brand lockup.
 * JPEG assets contain a dark matte, so the logo uses a LIGHTEN blend
 * directly on each image. This makes the matte inherit the header background
 * while preserving the colored Raven mark and wordmark.
 */
export default function RavenLogo({ className = "", compact = false }: RavenLogoProps) {
  const markHeight = compact ? "h-9 sm:h-10" : "h-12 sm:h-14";
  const wordmarkHeight = compact ? "h-7 sm:h-8" : "h-9 sm:h-10";
  const imageClass = "raven-brand-logo raven-brand-theme block shrink-0 object-contain w-auto";

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
        style={{ mixBlendMode: "lighten" }}
      />
      <img
        src="/RavenOracleWordmark.jpeg"
        alt="Raven Oracle"
        width={132}
        height={40}
        className={`${wordmarkHeight} ${imageClass}`}
        style={{ mixBlendMode: "lighten" }}
      />
    </div>
  );
}
