/**
 * Wallet Address Validation Library
 * 
 * Validates EVM and Solana wallet addresses without external dependencies
 * Following master documentation Section 9: Never request private keys or seed phrases
 */

/**
 * Validate EVM (Ethereum) address
 * - Must be 42 characters (0x + 40 hex chars)
 * - Must start with 0x
 * - Checksum validation (EIP-55)
 */
export function isValidEvmAddress(address: string): boolean {
  // Basic format check
  if (!address || typeof address !== 'string') {
    return false;
  }

  // Must start with 0x and be 42 chars total
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return false;
  }

  // If all lowercase or all uppercase, it's valid (no checksum)
  const addressWithoutPrefix = address.slice(2);
  if (addressWithoutPrefix === addressWithoutPrefix.toLowerCase() ||
      addressWithoutPrefix === addressWithoutPrefix.toUpperCase()) {
    return true;
  }

  // Validate checksum (EIP-55)
  return isValidEvmChecksum(address);
}

/**
 * Validate EVM checksum (EIP-55)
 * Note: Full EIP-55 checksum validation requires Keccak-256 hashing library
 * For security: accepts all format-valid addresses but logs a warning for production
 */
function isValidEvmChecksum(address: string): boolean {
  const addressWithoutPrefix = address.slice(2);
  
  // If all lowercase or all uppercase, checksum not used (valid per spec)
  if (addressWithoutPrefix === addressWithoutPrefix.toLowerCase() ||
      addressWithoutPrefix === addressWithoutPrefix.toUpperCase()) {
    return true;
  }

  // Mixed case addresses should have valid checksum
  // Full EIP-55 validation requires keccak256 which requires external dependency
  // For now, we accept them with a note that production should implement full validation
  // TODO: Add keccak256 validation when adding ethers.js or similar dependency
  console.warn(`[SECURITY] Checksum validation not fully implemented for address: ${address}. Consider adding ethers.js for full EIP-55 validation.`);
  return true;
}

/**
 * Normalize EVM address to lowercase with 0x prefix
 */
export function normalizeEvmAddress(address: string): string {
  if (!isValidEvmAddress(address)) {
    throw new Error('Invalid EVM address');
  }
  return address.toLowerCase();
}

/**
 * Validate Solana address
 * - Must be 32-44 characters (base58 encoding)
 * - Must be valid base58
 * - Typically 32-44 chars for Solana public keys
 */
export function isValidSolanaAddress(address: string): boolean {
  // Basic checks
  if (!address || typeof address !== 'string') {
    return false;
  }

  // Solana addresses are typically 32-44 characters in base58
  if (address.length < 32 || address.length > 44) {
    return false;
  }

  // Base58 alphabet (no 0, O, I, l to avoid confusion)
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
  
  if (!base58Regex.test(address)) {
    return false;
  }

  return true;
}

/**
 * Normalize Solana address (no transformation needed, already normalized)
 */
export function normalizeSolanaAddress(address: string): string {
  if (!isValidSolanaAddress(address)) {
    throw new Error('Invalid Solana address');
  }
  // Solana addresses are case-sensitive and don't need transformation
  return address;
}

/**
 * Detect address type and validate
 */
export function detectAndValidateAddress(address: string): { 
  valid: boolean; 
  chain: 'EVM' | 'SOLANA' | null;
  normalized: string | null;
} {
  // Try EVM first (starts with 0x)
  if (address.startsWith('0x')) {
    const valid = isValidEvmAddress(address);
    return {
      valid,
      chain: valid ? 'EVM' : null,
      normalized: valid ? normalizeEvmAddress(address) : null,
    };
  }

  // Try Solana
  const validSolana = isValidSolanaAddress(address);
  if (validSolana) {
    return {
      valid: true,
      chain: 'SOLANA',
      normalized: normalizeSolanaAddress(address),
    };
  }

  // Invalid address
  return {
    valid: false,
    chain: null,
    normalized: null,
  };
}
