"use client";

import { useParams } from "next/navigation";
import RaffleCaptchaGate from "@/components/RaffleCaptchaGate";

export default function RaffleLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams<{ id: string }>();
  return <RaffleCaptchaGate raffleId={id}>{children}</RaffleCaptchaGate>;
}
