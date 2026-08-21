import { prisma } from "../lib/prisma.js";
import { chainExists, getProjectChains } from "./chain-config.service.js";

type ProjectType = "NFT" | "TOKEN" | "AIRDROP" | "OTHER";

type ApprovalIssue = {
  code: string;
  field: string;
  message: string;
};

function stringValue(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

function numberValue(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === "number" ? value : Number(value);
}

export async function getProjectApprovalReadiness(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      description: true,
      logoUrl: true,
      bannerUrl: true,
      status: true,
      rejectionReason: true,
      deletedAt: true,
    },
  });

  if (!project || project.deletedAt) {
    return { projectId, ready: false, issues: [{ code: "PROJECT_NOT_FOUND", field: "project", message: "Project not found." }], project: null };
  }

  const classification = await prisma.$queryRaw<Array<{ type: string; metadata: unknown }>>`
    SELECT "type", "metadata" FROM "ProjectClassification" WHERE "projectId" = ${projectId}::uuid LIMIT 1
  `;
  const row = classification[0];
  const type = (row?.type ?? "NFT") as ProjectType;
  const metadata = (row?.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata))
    ? row.metadata as Record<string, unknown>
    : {};

  const issues: ApprovalIssue[] = [];
  if (!project.name.trim()) issues.push({ code: "MISSING_NAME", field: "name", message: "Project name is required." });
  if (!project.description?.trim()) issues.push({ code: "MISSING_DESCRIPTION", field: "description", message: "Project description is required." });
  if (!project.logoUrl) issues.push({ code: "MISSING_LOGO", field: "logoUrl", message: "Project logo is required." });
  if (!project.bannerUrl) issues.push({ code: "MISSING_BANNER", field: "bannerUrl", message: "Project banner is required." });
  if (!["NFT", "TOKEN", "AIRDROP", "OTHER"].includes(type)) {
    issues.push({ code: "INVALID_PROJECT_TYPE", field: "projectType", message: "Project type is invalid." });
  }

  const chains = await getProjectChains([projectId]);
  const chain = chains[0]?.chainName?.trim() ?? "";
  if (!chain) {
    issues.push({ code: "MISSING_CHAIN", field: "chain", message: "An active project chain is required." });
  } else if (!(await chainExists(chain))) {
    issues.push({ code: "INACTIVE_CHAIN", field: "chain", message: `Selected chain (${chain}) is not active.` });
  }

  if (!row) issues.push({ code: "MISSING_CLASSIFICATION", field: "projectType", message: "Project type metadata has not been configured." });

  if (type === "NFT") {
    if (!stringValue(metadata, "collectionContractAddress")) issues.push({ code: "MISSING_COLLECTION_CONTRACT", field: "collectionContractAddress", message: "NFT collection contract is required." });
    if (!Number.isFinite(numberValue(metadata, "supply")) || numberValue(metadata, "supply") <= 0) issues.push({ code: "MISSING_NFT_SUPPLY", field: "supply", message: "NFT supply must be a positive number." });
    if (!stringValue(metadata, "standard")) issues.push({ code: "MISSING_NFT_STANDARD", field: "standard", message: "NFT standard is required." });
  }

  if (type === "TOKEN") {
    if (!stringValue(metadata, "symbol")) issues.push({ code: "MISSING_TOKEN_SYMBOL", field: "symbol", message: "Token symbol is required." });
    if (!stringValue(metadata, "contractAddress")) issues.push({ code: "MISSING_TOKEN_CONTRACT", field: "contractAddress", message: "Token contract address is required." });
    if (stringValue(metadata, "explorerUrl") && !/^https?:\/\//i.test(stringValue(metadata, "explorerUrl"))) issues.push({ code: "INVALID_EXPLORER_URL", field: "explorerUrl", message: "Explorer URL must be a valid HTTP(S) URL." });
  }

  if (type === "AIRDROP") {
    if (!stringValue(metadata, "allocation")) issues.push({ code: "MISSING_AIRDROP_ALLOCATION", field: "allocation", message: "Airdrop allocation is required." });
    if (!stringValue(metadata, "eligibility")) issues.push({ code: "MISSING_AIRDROP_ELIGIBILITY", field: "eligibility", message: "Airdrop eligibility rules are required." });
    if (!stringValue(metadata, "claimUrl")) issues.push({ code: "MISSING_CLAIM_URL", field: "claimUrl", message: "Airdrop claim URL is required." });
  }

  if (type === "OTHER") {
    if (!stringValue(metadata, "subtype") && !stringValue(metadata, "externalUrl")) issues.push({ code: "MISSING_OTHER_DETAILS", field: "subtype", message: "Provide an Other project subtype or official external URL." });
  }

  return {
    projectId,
    ready: issues.length === 0,
    issues,
    project: { ...project, projectType: type, chain: chain || null, metadata },
  };
}
