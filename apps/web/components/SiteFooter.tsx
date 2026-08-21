import Link from "next/link";
import RavenLogo from "./RavenLogo";

export default function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-[#07070b]">
      <div className="mx-auto w-[min(1180px,calc(100%-32px))] px-4 py-10">
        <div className="grid gap-10 md:grid-cols-4">
          <div>
            <Link href="/" className="inline-flex">
              <RavenLogo />
            </Link>
            <p className="mt-4 max-w-xs text-xs leading-relaxed text-zinc-500">
              Web3, NFT projects, raffles and community alpha — built around transparent identity, reputation and fair rewards.
            </p>
          </div>

          <div>
            <h4 className="mb-4 text-sm font-black">Platform</h4>
            <div className="space-y-2 text-xs text-zinc-400">
              <Link href="/projects" className="block transition-colors hover:text-white">NFT Projects</Link>
              <Link href="/raffles" className="block transition-colors hover:text-white">Raffles</Link>
              <Link href="/alpha" className="block transition-colors hover:text-white">King of Alpha</Link>
              <Link href="/how-it-works" className="block transition-colors hover:text-white">How it Works</Link>
            </div>
          </div>

          <div>
            <h4 className="mb-4 text-sm font-black">Creators</h4>
            <div className="space-y-2 text-xs text-zinc-400">
              <Link href="/dashboard" className="block transition-colors hover:text-white">Creator Studio</Link>
              <Link href="/projects/new" className="block transition-colors hover:text-white">Launch Project</Link>
              <Link href="/create" className="block transition-colors hover:text-white">Create Raffle</Link>
            </div>
          </div>

          <div>
            <h4 className="mb-4 text-sm font-black">Community</h4>
            <div className="flex gap-3">
              <a href="https://twitter.com/RavenOracle" target="_blank" rel="noreferrer" aria-label="Raven Oracle on X" className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/5 transition-all hover:border-violet-500/50 hover:bg-violet-500/10">
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
              </a>
              <a href="https://discord.gg/raveoracle" target="_blank" rel="noreferrer" aria-label="Raven Oracle Discord" className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/5 transition-all hover:border-violet-500/50 hover:bg-violet-500/10">
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" /></svg>
              </a>
              <a href="https://t.me/RavenOracle" target="_blank" rel="noreferrer" aria-label="Raven Oracle Telegram" className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/5 transition-all hover:border-violet-500/50 hover:bg-violet-500/10">
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295-.002 0-.003 0-.005 0l.213-3.054 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.64-.203-.654-.64.135-.954l11.566-4.458c.538-.196 1.006.128.832.941z" /></svg>
              </a>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-6 text-xs text-zinc-500 sm:flex-row">
          <span>© {new Date().getFullYear()} Raven Oracle. All rights reserved.</span>
          <div className="flex gap-6">
            <Link href="/terms" className="transition-colors hover:text-white">Terms</Link>
            <Link href="/privacy" className="transition-colors hover:text-white">Privacy</Link>
            <Link href="/contact" className="transition-colors hover:text-white">Contact</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
