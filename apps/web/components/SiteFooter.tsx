import Link from "next/link";
import RavenLogo from "./RavenLogo";

export default function SiteFooter() {
  const linkClass = "block text-xs text-zinc-500 transition-colors hover:text-violet-600 dark:text-zinc-300 dark:hover:text-violet-300";
  const headingClass = "mb-4 text-sm font-black text-zinc-800 dark:text-white";
  const socialClass = "flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 bg-white/70 text-zinc-700 transition-all hover:border-violet-400 hover:bg-violet-50 hover:text-violet-700 dark:border-white/15 dark:bg-white/5 dark:text-zinc-200 dark:hover:border-violet-500/60 dark:hover:bg-violet-500/10 dark:hover:text-violet-200";

  return (
    <footer className="border-t border-zinc-200 bg-white/86 text-zinc-800 backdrop-blur-xl dark:border-white/10 dark:bg-black/40 dark:text-white">
      <div className="mx-auto w-[min(1180px,calc(100%-32px))] px-4 py-8">
        <div className="grid gap-8 md:grid-cols-4">
          <div>
            <Link href="/" className="inline-flex"><RavenLogo compact /></Link>
            <p className="mt-4 max-w-xs text-xs leading-relaxed text-zinc-500 dark:text-zinc-300">
              Raven Oracle provides tools for creating, joining, managing and reviewing NFT raffles with clear rules and recorded results.
            </p>
          </div>

          <div>
            <h4 className={headingClass}>Platform</h4>
            <div className="space-y-2">
              <Link href="/projects" className={linkClass}>NFT Projects</Link>
              <Link href="/raffles" className={linkClass}>Raffles</Link>
              <Link href="/alpha" className={linkClass}>King of Alpha</Link>
              <Link href="/how-it-works" className={linkClass}>How it works</Link>
            </div>
          </div>

          <div>
            <h4 className={headingClass}>Creators</h4>
            <div className="space-y-2">
              <Link href="/dashboard/creator" className={linkClass}>Creator dashboard</Link>
              <Link href="/projects/new" className={linkClass}>Create a project</Link>
              <Link href="/docs" className={linkClass}>Documentation</Link>
              <Link href="/faq" className={linkClass}>FAQ</Link>
            </div>
          </div>

          <div>
            <h4 className={headingClass}>Community</h4>
            <div className="flex gap-3">
              <a href="https://x.com/RavenOracle_" target="_blank" rel="noreferrer" aria-label="Raven Oracle on X" className={socialClass}>
                <span className="text-base font-black">𝕏</span>
              </a>
              <span className="flex items-center text-[10px] text-zinc-500 dark:text-zinc-400">Follow Raven Oracle on X.</span>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-zinc-200 pt-6 text-xs text-zinc-500 dark:border-white/10 dark:text-zinc-300 sm:flex-row">
          <span>© {new Date().getFullYear()} Raven Oracle. All rights reserved.</span>
          <div className="flex flex-wrap justify-center gap-6">
            <Link href="/docs" className="transition-colors hover:text-violet-600 dark:hover:text-violet-300">Docs</Link>
            <Link href="/terms" className="transition-colors hover:text-violet-600 dark:hover:text-violet-300">Terms</Link>
            <Link href="/privacy" className="transition-colors hover:text-violet-600 dark:hover:text-violet-300">Privacy</Link>
            <Link href="/contact" className="transition-colors hover:text-violet-600 dark:hover:text-violet-300">Contact</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
