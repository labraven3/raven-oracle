"use client";

import Link from "next/link";

export default function NotFound() {
  return <main className="grid min-h-screen place-items-center bg-[#07070a] px-6 text-zinc-100"><div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#0d0c11] p-10 text-center"><div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-violet-500 font-black text-black">R</div><p className="mt-6 text-[9px] font-black tracking-[.2em] text-violet-300/60">404 · RAVEN ORACLE</p><h1 className="mt-2 text-4xl font-medium">That page doesn&apos;t exist.</h1><p className="mt-3 text-sm leading-6 text-zinc-600">The raffle, project or page you requested may have been removed or is not available.</p><div className="mt-7 flex justify-center gap-2"><Link href="/raffles" className="rounded-lg bg-violet-500 px-5 py-3 text-xs font-black text-black">Browse raffles</Link><Link href="/" className="rounded-lg border border-white/10 px-5 py-3 text-xs font-bold">Home</Link></div></div></main>;
}
