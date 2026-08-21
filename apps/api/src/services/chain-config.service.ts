import { prisma } from "../lib/prisma.js";

export const DEFAULT_CHAINS = [
  "Ethereum", "Solana", "Polygon", "Aptos", "Sui", "Cardano", "Bitcoin", "Avax", "Venom", "Injective",
  "Sei", "Base", "Ripple", "Arbitrum", "Immutable", "Flow", "Binance", "Tezos", "MultiversX", "Near",
  "Hedera", "Cosmos", "Reef", "Starknet", "Manta", "Monad", "Blast", "Stargaze", "Scroll", "zkSync",
  "Enjin", "Linea", "Oraichain", "TON", "Viction", "Bera", "Tron", "ApeChain", "Abstract", "Hyperliquid",
  "Story", "XION", "Somnia", "Sophon", "Robinhood",
] as const;

function slugify(value: string) { return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); }
let ready = false;

export async function ensureChainStore() {
  if (ready) return;
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "ChainConfig" ("id" TEXT PRIMARY KEY,"name" TEXT NOT NULL UNIQUE,"slug" TEXT NOT NULL UNIQUE,"isActive" BOOLEAN NOT NULL DEFAULT TRUE,"sortOrder" INTEGER NOT NULL DEFAULT 0,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "ProjectChainMap" ("projectId" TEXT PRIMARY KEY,"chainName" TEXT NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  const countRows = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(`SELECT COUNT(*)::bigint AS count FROM "ChainConfig"`);
  if (Number(countRows[0]?.count ?? 0) === 0) for (const [index, name] of DEFAULT_CHAINS.entries()) await prisma.$executeRawUnsafe(`INSERT INTO "ChainConfig" ("id","name","slug","isActive","sortOrder") VALUES (md5(random()::text || clock_timestamp()::text),$1,$2,TRUE,$3) ON CONFLICT ("name") DO NOTHING`, name, slugify(name), index);
  ready = true;
}

export async function getActiveChains() { await ensureChainStore(); return prisma.$queryRawUnsafe<Array<{ id: string; name: string; slug: string; isActive: boolean; sortOrder: number }>>(`SELECT "id","name","slug","isActive","sortOrder" FROM "ChainConfig" WHERE "isActive"=TRUE ORDER BY "sortOrder" ASC,"name" ASC`); }
export async function getAllChains() { await ensureChainStore(); return prisma.$queryRawUnsafe<Array<{ id: string; name: string; slug: string; isActive: boolean; sortOrder: number }>>(`SELECT "id","name","slug","isActive","sortOrder" FROM "ChainConfig" ORDER BY "sortOrder" ASC,"name" ASC`); }
export async function chainExists(name: string) { await ensureChainStore(); const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(`SELECT "id" FROM "ChainConfig" WHERE "name"=$1 AND "isActive"=TRUE LIMIT 1`, name); return Boolean(rows[0]); }
export async function setProjectChain(projectId: string, chainName: string) { await ensureChainStore(); await prisma.$executeRawUnsafe(`INSERT INTO "ProjectChainMap" ("projectId","chainName") VALUES ($1,$2) ON CONFLICT ("projectId") DO UPDATE SET "chainName"=EXCLUDED."chainName","updatedAt"=CURRENT_TIMESTAMP`, projectId, chainName); }
export async function getProjectChains(projectIds: string[]) { await ensureChainStore(); if (!projectIds.length) return []; return prisma.$queryRawUnsafe<Array<{ projectId: string; chainName: string }>>(`SELECT "projectId","chainName" FROM "ProjectChainMap" WHERE "projectId" = ANY($1::text[])`, projectIds); }
export { slugify };
