"use client";

export default function RafflesError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="min-h-screen bg-[#07070a] px-5 py-20 text-zinc-100">
      <div className="mx-auto max-w-xl rounded-2xl border border-white/10 bg-[#0d0c11] p-8 text-center">
        <div className="mx-auto mb-5 grid h-12 w-12 place-items-center rounded-xl bg-violet-500/15 text-xl text-violet-300">R</div>
        <h1 className="text-2xl font-semibold">Raffles could not load</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-500">Something went wrong while loading the raffle discovery page. Try again without losing your session.</p>
        <button onClick={() => reset()} className="mt-6 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 px-5 py-3 text-xs font-black text-white">Try again</button>
      </div>
    </main>
  );
}
