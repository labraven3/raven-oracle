const sections = [
  ["Raffles", "Creators define the prize, schedule, winner count and participant requirements. Published raffles expose those rules on a public page."],
  ["Entries", "Participants authenticate, start an entry, complete the configured tasks and submit a payout wallet when the raffle requires one. A submitted payout wallet is locked for that raffle."],
  ["Task verification", "X follow tasks use the configured X integration for verification. Other supported social tasks are confirmation-based and are not presented as API-verified."],
  ["Winner selection", "After the entry window closes, the creator reviews eligibility and runs the draw. The current random draw uses Node.js cryptographic randomness and records a hash and algorithm version for the audit record."],
  ["Winner export", "Completed raffles can be exported by the raffle creator as an XLSX workbook containing the available X username, Discord username and payout wallet details."],
];

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-[#06060a] text-zinc-100">
      <div className="mx-auto max-w-5xl px-5 py-16 sm:px-8">
        <div className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-violet-300">Documentation</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">How Raven Oracle works</h1>
          <p className="mt-5 text-base leading-7 text-zinc-400">A practical overview of the current raffle system. We document what is implemented today and label future functionality separately.</p>
        </div>
        <div className="mt-12 grid gap-4">
          {sections.map(([title, body], index) => (
            <section key={title} className="rounded-2xl border border-white/10 bg-[#0d0c11] p-6">
              <div className="text-[10px] font-black tracking-[.18em] text-violet-300/70">0{index + 1}</div>
              <h2 className="mt-2 text-xl font-semibold">{title}</h2>
              <p className="mt-3 text-sm leading-7 text-zinc-500">{body}</p>
            </section>
          ))}
        </div>
        <section className="mt-4 rounded-2xl border border-amber-400/15 bg-amber-400/[.04] p-6">
          <h2 className="font-semibold text-amber-200">Security note</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-500">Never share a seed phrase or private key. Review the network, contract address and exact wallet transaction before signing. Raven Oracle does not claim on-chain or oracle-backed randomness until that functionality is implemented.</p>
        </section>
      </div>
    </div>
  );
}
