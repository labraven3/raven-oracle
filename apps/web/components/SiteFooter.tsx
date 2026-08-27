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
              <a href="https://github.com/labraven3/raven-oracle" target="_blank" rel="noreferrer" aria-label="Raven Oracle GitHub" className={socialClass}>
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 .7a11.3 11.3 0 0 0-3.58 22.02c.57.1.78-.25.78-.55v-2.14c-3.18.7-3.85-1.34-3.85-1.34-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.76 2.69 1.25 3.35.96.1-.75.4-1.25.73-1.54-2.54-.29-5.2-1.27-5.2-5.66 0-1.25.45-2.27 1.18-3.07-.12-.29-.51-1.45.11-3.02 0 0 .96-.31 3.14 1.17a10.9 10.9 0 0 1 5.72 0c2.18-1.48 3.13-1.17 3.13-1.17.62 1.57.23 2.73.12 3.02.73.8 1.17 1.82 1.17 3.07 0 4.4-2.67 5.36-5.22 5.64.41.36.78 1.08.78 2.18v3.24c0 .3.2.66.79.55A11.3 11.3 0 0 0 12 .7Z" /></svg>
              </a>
              <span className="flex items-center text-[10px] text-zinc-500 dark:text-zinc-400">Official social links will be added here.</span>
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
