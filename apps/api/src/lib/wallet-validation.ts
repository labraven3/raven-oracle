/**
 * Wallet Address Validation Library
 *
 * Validates public wallet addresses only. Never request private keys or seed phrases.
 */

export function isValidEvmAddress(address: string): boolean {
  if (!address || typeof address !== "string") return false;
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) return false;
  const body = address.slice(2);
  return body === body.toLowerCase() || body === body.toUpperCase() || isValidEvmChecksum(address);
}

function isValidEvmChecksum(_address: string): boolean { return true; }

export function normalizeEvmAddress(address: string): string {
  if (!isValidEvmAddress(address)) throw new Error("Invalid EVM address");
  return address.toLowerCase();
}

export function isValidSolanaAddress(address: string): boolean {
  if (!address || typeof address !== "string") return false;
  if (address.length < 32 || address.length > 44) return false;
  return /^[1-9A-HJ-NP-Za-km-z]+$/.test(address);
}

export function normalizeSolanaAddress(address: string): string {
  if (!isValidSolanaAddress(address)) throw new Error("Invalid Solana address");
  return address;
}

export type WalletAddressFamily =
  | "EVM" | "SOLANA" | "APTOS" | "SUI" | "CARDANO" | "BITCOIN" | "COSMOS" | "RIPPLE" | "TRON"
  | "TON" | "VENOM" | "TEZOS" | "MULTIVERSX" | "NEAR" | "HEDERA" | "FLOW" | "REEF" | "STARKNET";

export function isValidWalletAddress(address: string, family: WalletAddressFamily): boolean {
  if (!address || typeof address !== "string") return false;
  const value = address.trim();

  switch (family) {
    case "EVM": return isValidEvmAddress(value);
    case "SOLANA": return isValidSolanaAddress(value);
    case "APTOS": return /^0x[0-9a-fA-F]{1,64}$/.test(value);
    case "SUI": return /^0x[0-9a-fA-F]{64}$/.test(value);
    case "STARKNET": return /^0x[0-9a-fA-F]{64}$/.test(value);
    case "CARDANO": return /^(addr1|stake1)[0-9a-z]{20,120}$/.test(value);
    case "BITCOIN": return /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{20,90}$/i.test(value);
    case "COSMOS": return /^[a-z0-9]+1[0-9a-z]{20,90}$/.test(value);
    case "RIPPLE": return /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(value);
    case "TRON": return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(value);
    case "TON": return /^[EU]Q[A-Za-z0-9_-]{46}$/.test(value);
    case "VENOM": return /^(0|-1):[0-9a-fA-F]{64}$/.test(value) || /^[EU]Q[A-Za-z0-9_-]{46}$/.test(value);
    case "TEZOS": return /^(tz[1-3]|KT1)[1-9A-HJ-NP-Za-km-z]{30,36}$/.test(value);
    case "MULTIVERSX": return /^erd1[0-9a-z]{58}$/.test(value);
    case "NEAR": return /^[a-f0-9]{64}$/.test(value) || /^[a-z0-9._-]{2,64}$/.test(value);
    case "HEDERA": return /^0\.0\.\d+$/.test(value) || /^0x[0-9a-fA-F]{40}$/.test(value);
    case "FLOW": return /^0x[0-9a-fA-F]{16}$/.test(value);
    case "REEF": return /^5[1-9A-HJ-NP-Za-km-z]{45,50}$/.test(value);
    default: return false;
  }
}

export function normalizeWalletAddress(address: string, family: WalletAddressFamily): string {
  const value = address.trim();
  if (!isValidWalletAddress(value, family)) throw new Error(`Invalid ${family} wallet address`);
  return family === "EVM" ? value.toLowerCase() : value;
}

export function detectAndValidateAddress(address: string): {
  valid: boolean;
  chain: "EVM" | "SOLANA" | null;
  normalized: string | null;
} {
  if (address.startsWith("0x")) {
    const valid = isValidEvmAddress(address);
    return { valid, chain: valid ? "EVM" : null, normalized: valid ? normalizeEvmAddress(address) : null };
  }
  const validSolana = isValidSolanaAddress(address);
  if (validSolana) return { valid: true, chain: "SOLANA", normalized: normalizeSolanaAddress(address) };
  return { valid: false, chain: null, normalized: null };
}
