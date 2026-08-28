type RavenLogoProps = {
  className?: string;
  showWordmark?: boolean;
  compact?: boolean;
};

export default function RavenLogo({
  className = "",
  compact = false,
}: RavenLogoProps) {
  const markHeight = compact ? "h-9 sm:h-10" : "h-12 sm:h-14";
  const wordmarkHeight = compact ? "h-7 sm:h-8" : "h-9 sm:h-10";
  const imageClass = "block shrink-0 object-contain w-auto";

  return (
    <div
      data-raven-canonical="true"
      className={`flex shrink-0 items-center gap-0.5 overflow-visible leading-none ${className}`}
      aria-label="Raven Oracle"
    >
      <img
        src="/RavenOracleLogo.png"
        alt="Raven Oracle mark"
        width={56}
        height={56}
        data-raven-logo="true"
        className={`${markHeight} ${imageClass}`}
      />

      <img
        src="/RavenOracleWordmark.png"
        alt="Raven Oracle"
        width={132}
        height={40}
        data-raven-logo="true"
        className={`${wordmarkHeight} ${imageClass}`}
      />
    </div>
  );
}