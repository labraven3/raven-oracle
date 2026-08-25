type RavenLogoProps = { className?: string; showWordmark?: boolean; compact?: boolean };

/**
 * Canonical Raven Oracle brand lockup.
 * Uses the approved JPEG artwork without cropping either image.
 */
export default function RavenLogo({ className = "", compact = false }: RavenLogoProps) {
  const markSize = compact ? "h-11 w-11" : "h-14 w-14";
  const wordmarkSize = compact ? "h-9 w-[116px]" : "h-10 w-[132px]";
  const imageClass = "raven-brand-logo raven-brand-theme block shrink-0 object-contain";

  return (
    <div
      data-raven-canonical="true"
      className={`flex shrink-0 items-center gap-0 overflow-visible ${className}`}
      aria-label="Raven Oracle"
    >
      <img
        src="/RavenOracleLogo.jpeg"
        alt="Raven Oracle mark"
        width={compact ? 44 : 56}
        height={compact ? 44 : 56}
        className={`${markSize} ${imageClass}`}
      />
      <img
        src="/RavenOracleWordmark.jpeg"
        alt="Raven Oracle"
        width={compact ? 116 : 132}
        height={compact ? 36 : 40}
        className={`${wordmarkSize} ${imageClass}`}
      />
    </div>
  );
}
