type RavenLogoProps = { className?: string; showWordmark?: boolean; compact?: boolean };

/**
 * Canonical Raven Oracle brand lockup.
 * The source artwork is always rendered with its natural aspect ratio so
 * neither the mark nor the wordmark can be squeezed or visually clipped.
 */
export default function RavenLogo({ className = "", compact = false }: RavenLogoProps) {
  const markHeight = compact ? "h-12 sm:h-13" : "h-14 sm:h-16";
  const wordmarkHeight = compact ? "h-8 sm:h-9" : "h-10 sm:h-11";
  const imageClass = "raven-brand-logo raven-brand-theme block shrink-0 object-contain w-auto";

  return (
    <div
      data-raven-canonical="true"
      className={`flex min-w-max shrink-0 items-center gap-1 overflow-visible leading-none ${className}`}
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
