import Link from "next/link";
import RavenLogo from "./RavenLogo";

export default function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-[#07070b]">
      <div className="mx-auto w-[min(1180px,calc(100%-32px))] px-4 py-10">
        <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <div>
            <Link href="/" className="inline-flex"><RavenLogo /></Link>
            <p className="mt-4 max-w-md text-xs leading-6 text-zinc-500">Web3, NFT projects, raffles and community alpha — built around transparent identity, reputation and fair rewards.</p>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-3 text-xs text-zinc-500">
            <Link href="/projects" className="hover:text-white">NFT Projects</Link>
            <Link href="/raffles" className="hover:text-white">Raffles</Link>
            <Link href="/alpha" className="hover:text-white">King of Alpha</Link>
            <Link href="/how-it-works" className="hover:text-white">How it Works</Link>
            <Link href="/login" className="hover:text-white">Login</Link>
          </nav>
        </div>
        <div className="mt-8 flex flex-col gap-2 border-t border-white/5 pt-5 text-[10px] tracking-wide text-zinc-600 sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} Raven Oracle. All rights reserved.</span>
          <span>WEB3 • NFT • ORACLE</span>
        </div>
      </div>
    </footer>
  );
}
