type RavenLogoProps = { className?: string; showWordmark?: boolean; compact?: boolean };

/**
 * Canonical Raven Oracle brand lockup.
 * Keeps the approved JPEG artwork untouched. Theme-specific appearance is
 * handled by the shared raven-brand CSS so header/footer stay identical.
 */
export default function RavenLogo({ className = "", compact = false }: RavenLogoProps) {
  const markSize = compact ? "h-14 w-14" : "h-14 w-14";
  const wordmarkSize = compact ? "h-10 w-auto" : "h-10 w-auto";
  const imageClass = "raven-brand-logo raven-brand-theme block shrink-0 object-contain";

  return (
    <div
      data-raven-canonical="true"
      className={`flex items-center gap-0 ${className}`}
      aria-label="Raven Oracle"
    >
      <img
        src="/RavenOracleLogo.jpeg"
        alt="Raven Oracle mark"
        className={`${markSize} ${imageClass}`}
      />
      <img
        src="/RavenOracleWordmark.jpeg"
        alt="Raven Oracle"
        className={`${wordmarkSize} ${imageClass}`}
      />
    </div>
  );
}
