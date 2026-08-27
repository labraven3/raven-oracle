import SiteHeader from "../../components/SiteHeader";
import SiteFooter from "../../components/SiteFooter";

const faqs = [
  ["Do I need to connect a wallet to start an entry?", "No. The current flow lets you start the entry after signing in, complete the required tasks, and submit a payout wallet when required by the raffle."],
  ["Are all social tasks API verified?", "No. X follow is verified through the X integration. The other supported social tasks currently use participant confirmation."],
  ["Can I change my payout wallet after submitting it?", "No. The payout wallet is locked to the entry after submission. This is enforced by the API, not only by the interface."],
  ["How are winners selected?", "The current random raffle draw uses Node.js cryptographic randomness and records an eligibility snapshot, randomness hash and algorithm version. It is not currently an on-chain or Chainlink VRF draw."],
  ["Who can export winners?", "Only the creator of a completed raffle can export its winner workbook."],
  ["What should I do before signing a wallet transaction?", "Check the network, contract address and exact transaction details. Never provide a seed phrase or private key to Raven Oracle or any website."],
];

export default function FaqPage() {
  return <main className="min-h-screen bg-[#06060a] text-zinc-100"><SiteHeader/><div className="mx-auto max-w-4xl px-5 py-16 sm:px-8"><p className="text-xs font-bold uppercase tracking-[.2em] text-violet-300">FAQ</p><h1 className="mt-3 text-4xl font-black tracking-tight">Common questions</h1><p className="mt-4 text-sm leading-6 text-zinc-500">Straight answers about the current Raven Oracle raffle experience.</p><div className="mt-10 space-y-3">{faqs.map(([q,a])=><details key={q} className="group rounded-2xl border border-white/10 bg-[#0d0c11] p-5"><summary className="cursor-pointer list-none font-semibold marker:hidden">{q}<span className="float-right text-zinc-500 transition group-open:rotate-45">+</span></summary><p className="mt-4 max-w-3xl text-sm leading-7 text-zinc-500">{a}</p></details>)}</div></div><SiteFooter/></main>;
}
