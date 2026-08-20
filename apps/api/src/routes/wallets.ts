import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { isValidWalletAddress, normalizeWalletAddress, type WalletAddressFamily } from "../lib/wallet-validation.js";

const router = Router();

const NETWORKS = [
  "ethereum", "solana", "polygon", "aptos", "sui", "cardano", "bitcoin", "avax", "venom", "injective",
  "sei", "base", "ripple", "arbitrum", "immutable", "flow", "binance", "tezos", "multiversx", "near",
  "hedera", "cosmos", "reef", "starknet", "manta", "monad", "blast", "stargaze", "scroll", "zksync",
  "enjin", "linea", "oraichain", "ton", "viction", "bera", "tron", "apechain", "abstract", "hyperliquid",
  "story", "xion", "somnia", "sophon", "robinhood",
] as const;

type Network = (typeof NETWORKS)[number];

const EVM_NETWORKS = new Set<Network>([
  "ethereum", "polygon", "avax", "base", "arbitrum", "immutable", "manta", "monad", "blast", "scroll", "zksync",
  "enjin", "linea", "viction", "bera", "apechain", "abstract", "hyperliquid", "story", "somnia", "sophon", "robinhood", "binance",
]);

const SOLANA_NETWORKS = new Set<Network>(["solana"]);
const FAMILY_BY_NETWORK: Record<Network, WalletAddressFamily> = {
  ethereum: "EVM", solana: "SOLANA", polygon: "EVM", aptos: "APTOS", sui: "SUI", cardano: "NEAR", bitcoin: "BITCOIN",
  avax: "EVM", venom: "EVM", injective: "COSMOS", sei: "COSMOS", base: "EVM", ripple: "RIPPLE", arbitrum: "EVM",
  immutable: "EVM", flow: "FLOW", binance: "EVM", tezos: "TEZOS", multiversx: "MULTIVERSX", near: "NEAR", hedera: "HEDERA",
  cosmos: "COSMOS", reef: "REEF", starknet: "STARKNET", manta: "EVM", monad: "EVM", blast: "EVM", stargaze: "COSMOS",
  scroll: "EVM", zksync: "EVM", enjin: "EVM", linea: "EVM", oraichain: "COSMOS", ton: "TON", viction: "EVM", bera: "EVM",
  tron: "TRON", apechain: "EVM", abstract: "EVM", hyperliquid: "EVM", story: "EVM", xion: "COSMOS", somnia: "EVM", sophon: "EVM", robinhood: "EVM",
};

const walletSchema = z.object({
  address: z.string().trim().min(1).max(255),
  chain: z.enum(["EVM", "SOLANA"]).optional(),
  network: z.enum(NETWORKS).optional(),
  label: z.string().trim().min(1).max(100).optional(),
});

function familyForNetwork(network: Network): WalletAddressFamily {
  return FAMILY_BY_NETWORK[network];
}

function dbChainForFamily(family: WalletAddressFamily): "EVM" | "SOLANA" {
  return family === "SOLANA" ? "SOLANA" : "EVM";
}

function normalizedKey(normalizedAddress: string, network: Network): string {
  // Keep compatibility with the existing schema's unique [chain, normalizedAddress]
  // while allowing the same public address to be registered on different networks.
  return `${network}:${normalizedAddress}`;
}

router.get("/", requireAuth, async (req, res, next) => {
  try {
    if (!req.userId) return res.status(401).json({ success: false, message: "Authentication required" });
    const wallets = await prisma.walletAddress.findMany({
      where: { userId: req.userId, deletedAt: null },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
    });
    return res.json({ success: true, wallets });
  } catch (error) { next(error); }
});

router.post("/", requireAuth, async (req, res, next) => {
  try {
    if (!req.userId) return res.status(401).json({ success: false, message: "Authentication required" });
    const parsed = walletSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: "Invalid wallet data", errors: z.treeifyError(parsed.error) });

    const { address, providedChain, label } = {
      address: parsed.data.address,
      providedChain: parsed.data.chain,
      label: parsed.data.label,
    };
    const network = (parsed.data.network ?? (providedChain === "SOLANA" ? "solana" : "ethereum")) as Network;
    const family = familyForNetwork(network);
    const dbChain = dbChainForFamily(family);

    if (providedChain && providedChain !== dbChain) {
      return res.status(400).json({ success: false, message: `Address format does not match ${providedChain} chain` });
    }

    if (!isValidWalletAddress(address, family)) {
      return res.status(400).json({ success: false, message: `Invalid ${network} wallet address format` });
    }

    const normalized = normalizeWalletAddress(address, family);
    const uniqueKey = normalizedKey(normalized, network);

    const existingForUser = await prisma.walletAddress.findFirst({
      where: { userId: req.userId, chain: dbChain, normalizedAddress: uniqueKey, deletedAt: null },
    });
    if (existingForUser) return res.status(409).json({ success: false, message: "You have already added this wallet address on this network" });

    const existingForOthers = await prisma.walletAddress.findFirst({
      where: { chain: dbChain, normalizedAddress: uniqueKey, deletedAt: null, userId: { not: req.userId } },
    });
    if (existingForOthers) return res.status(409).json({ success: false, message: "This wallet address is already registered to another account" });

    const wallet = await prisma.walletAddress.create({
      data: {
        userId: req.userId,
        address,
        normalizedAddress: uniqueKey,
        chain: dbChain,
        network,
        label: label || null,
      },
    });

    return res.status(201).json({ success: true, wallet });
  } catch (error) { next(error); }
});

router.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    if (!req.userId) return res.status(401).json({ success: false, message: "Authentication required" });
    const walletId = req.params.id;
    if (typeof walletId !== "string") return res.status(400).json({ success: false, message: "Invalid wallet ID" });
    const wallet = await prisma.walletAddress.findFirst({ where: { id: walletId, userId: req.userId, deletedAt: null } });
    if (!wallet) return res.status(404).json({ success: false, message: "Wallet not found" });
    await prisma.walletAddress.update({ where: { id: wallet.id }, data: { deletedAt: new Date(), status: "ARCHIVED" } });
    return res.json({ success: true, message: "Wallet archived" });
  } catch (error) { next(error); }
});

const updateWalletSchema = z.object({ label: z.string().trim().min(1).max(100).optional(), isPrimary: z.boolean().optional() });

router.patch("/:id", requireAuth, async (req, res, next) => {
  try {
    if (!req.userId) return res.status(401).json({ success: false, message: "Authentication required" });
    const walletId = req.params.id;
    if (typeof walletId !== "string") return res.status(400).json({ success: false, message: "Invalid wallet ID" });
    const parsed = updateWalletSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: "Invalid update data", errors: z.treeifyError(parsed.error) });

    const wallet = await prisma.walletAddress.findFirst({ where: { id: walletId, userId: req.userId, deletedAt: null } });
    if (!wallet) return res.status(404).json({ success: false, message: "Wallet not found" });

    if (parsed.data.isPrimary === true) {
      await prisma.walletAddress.updateMany({ where: { userId: req.userId, isPrimary: true, id: { not: walletId } }, data: { isPrimary: false } });
    }

    const updateData: Record<string, unknown> = {};
    if (parsed.data.label !== undefined) updateData.label = parsed.data.label;
    if (parsed.data.isPrimary !== undefined) updateData.isPrimary = parsed.data.isPrimary;

    const updated = await prisma.walletAddress.update({ where: { id: walletId }, data: updateData as any });
    return res.json({ success: true, wallet: updated });
  } catch (error) { next(error); }
});

export default router;
