type RavenLogoProps = { className?: string; showWordmark?: boolean; compact?: boolean };

/**
 * Canonical Raven Oracle brand lockup.
 * Keeps the approved JPEG artwork untouched. Theme-specific appearance is
 * handled by the shared raven-brand CSS so header/footer stay identical.
 */
export default function RavenLogo({ className = "", compact = false }: RavenLogoProps) {
  const markSize = compact ? "h-11 w-11" : "h-14 w-14";
  const wordmarkSize = compact ? "h-8 w-[96px]" : "h-10 w-[120px]";
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
        className={`${markSize} ${imageClass} max-w-full`}
      />
      <img
        src="/RavenOracleWordmark.jpeg"
        alt="Raven Oracle"
        className={`${wordmarkSize} ${imageClass} max-w-full`}
      />
    </div>
  );
}
