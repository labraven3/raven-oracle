type RavenLogoProps = { className?: string; showWordmark?: boolean; compact?: boolean };

/**
 * Canonical Raven Oracle brand lockup.
 * Keeps the approved JPEG artwork untouched and uses CSS blending so the
 * image surface follows the active site theme without changing the artwork.
 */
export default function RavenLogo({ className = "", compact = false }: RavenLogoProps) {
  const markSize = compact ? "h-14 w-14" : "h-28 w-28";
  const wordmarkSize = compact ? "h-10 w-auto" : "h-14 w-auto";

  const imageClass =
    "raven-brand-logo block shrink-0 object-contain transition-[filter,opacity] duration-300 " +
    "mix-blend-darken opacity-100 drop-shadow-[0_0_7px_rgba(124,58,237,0.20)] " +
    "dark:mix-blend-lighten dark:opacity-[0.98] dark:drop-shadow-[0_0_10px_rgba(139,92,246,0.42)]";

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
