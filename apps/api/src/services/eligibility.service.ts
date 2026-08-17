import { prisma } from "../lib/prisma.js";
import { Prisma } from "@prisma/client";

type EntryRules = {
  walletRequired?: boolean;
  captchaRequired?: boolean;
  socialRequired?: boolean;
  minAccountAgeDays?: number;
  minWalletAgeDays?: number;
  maxRiskScore?: number;
};

type EligibilityResult = {
  status: "ELIGIBLE" | "INELIGIBLE";
  reasons: Record<string, string>;
  riskScore: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  riskSignals: Record<string, unknown>;
};

function getRules(value: unknown): EntryRules {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const rules = value as Record<string, unknown>;
  const result: EntryRules = {};

  if (typeof rules.walletRequired === "boolean") {
    result.walletRequired = rules.walletRequired;
  }

  if (typeof rules.captchaRequired === "boolean") {
    result.captchaRequired = rules.captchaRequired;
  }

  if (typeof rules.socialRequired === "boolean") {
    result.socialRequired = rules.socialRequired;
  }

  if (typeof rules.minAccountAgeDays === "number") {
    result.minAccountAgeDays = rules.minAccountAgeDays;
  }

  if (typeof rules.minWalletAgeDays === "number") {
    result.minWalletAgeDays = rules.minWalletAgeDays;
  }

  if (typeof rules.maxRiskScore === "number") {
    result.maxRiskScore = rules.maxRiskScore;
  }

  return result;
}

function calculateRiskScore(entry: {
  captchaPassed: boolean | null;
  socialVerifiedAtEntry: boolean;
  accountAgeDaysAtEntry: number | null;
  walletAgeDaysAtEntry: number | null;
}) {
  let score = 0;
  const signals: Record<string, unknown> = {};

  if (entry.captchaPassed === false) {
    score += 50;
    signals.captchaFailed = true;
  }

  if (entry.socialVerifiedAtEntry === false) {
    score += 10;
    signals.socialNotVerified = true;
  }

  if (
    entry.accountAgeDaysAtEntry !== null &&
    entry.accountAgeDaysAtEntry < 7
  ) {
    score += 20;
    signals.newAccount = true;
  }

  if (
    entry.walletAgeDaysAtEntry !== null &&
    entry.walletAgeDaysAtEntry < 7
  ) {
    score += 20;
    signals.newWallet = true;
  }

  let riskLevel: "LOW" | "MEDIUM" | "HIGH" = "LOW";

  if (score >= 60) {
    riskLevel = "HIGH";
  } else if (score >= 30) {
    riskLevel = "MEDIUM";
  }

  return {
    score,
    riskLevel,
    signals,
  };
}

export async function evaluateRaffleEntry(
  entryId: string,
): Promise<EligibilityResult> {
  const entry = await prisma.raffleEntry.findUnique({
    where: { id: entryId },
    include: {
      raffle: true,
      walletAddress: true,
    },
  });

  if (!entry) {
    throw new Error("Raffle entry not found");
  }

  const rules = getRules(entry.raffle.entryRules);

  const reasons: Record<string, string> = {};

  if (rules.walletRequired && !entry.walletAddressId) {
    reasons.walletRequired = "A wallet is required for this raffle";
  }

  if (
    rules.captchaRequired &&
    entry.captchaPassed !== true
  ) {
    reasons.captchaRequired = "Captcha verification is required";
  }

  if (
    rules.socialRequired &&
    entry.socialVerifiedAtEntry !== true
  ) {
    reasons.socialRequired = "Required social verification has not been completed";
  }

  if (
    rules.minAccountAgeDays !== undefined &&
    (
      entry.accountAgeDaysAtEntry === null ||
      entry.accountAgeDaysAtEntry < rules.minAccountAgeDays
    )
  ) {
    reasons.minAccountAgeDays =
      `Account must be at least ${rules.minAccountAgeDays} days old`;
  }

  if (
    rules.minWalletAgeDays !== undefined &&
    (
      entry.walletAgeDaysAtEntry === null ||
      entry.walletAgeDaysAtEntry < rules.minWalletAgeDays
    )
  ) {
    reasons.minWalletAgeDays =
      `Wallet must be at least ${rules.minWalletAgeDays} days old`;
  }

  const risk = calculateRiskScore(entry);

  if (
    rules.maxRiskScore !== undefined &&
    risk.score > rules.maxRiskScore
  ) {
    reasons.maxRiskScore =
      `Risk score ${risk.score} exceeds maximum allowed score ${rules.maxRiskScore}`;
  }

  const eligible = Object.keys(reasons).length === 0;

  if (eligible) {
    reasons.result = "Entry passed all configured eligibility checks";
  }

  await prisma.raffleEntry.update({
    where: { id: entry.id },
    data: {
      status: eligible ? "ELIGIBLE" : "INELIGIBLE",
      eligibilityCheckedAt: new Date(),
      eligibilityReasons: reasons,
      riskScore: risk.score,
      riskLevel: risk.riskLevel,
      riskSignals: risk.signals as Prisma.InputJsonValue,
    },
  });

  return {
    status: eligible ? "ELIGIBLE" : "INELIGIBLE",
    reasons,
    riskScore: risk.score,
    riskLevel: risk.riskLevel,
    riskSignals: risk.signals,
  };
}
