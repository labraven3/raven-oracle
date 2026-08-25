type RavenLogoProps = { className?: string; showWordmark?: boolean; compact?: boolean };

/**
 * Canonical Raven Oracle brand lockup.
 * Keep both source artworks fully visible; never constrain either image to the
 * size of the parent or allow flexbox to shrink the artwork.
 */
export default function RavenLogo({ className = "", compact = false }: RavenLogoProps) {
  const markSize = compact ? "h-12 w-12" : "h-16 w-16";
  const wordmarkSize = compact ? "h-9 w-[116px]" : "h-11 w-[140px]";
  const imageClass = "block shrink-0 grow-0 object-contain object-center";

  return (
    <div
      data-raven-canonical="true"
      className={`flex shrink-0 grow-0 items-center gap-0 overflow-visible whitespace-nowrap ${className}`}
      aria-label="Raven Oracle"
      style={{ width: compact ? 164 : 196, minWidth: compact ? 164 : 196 }}
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
