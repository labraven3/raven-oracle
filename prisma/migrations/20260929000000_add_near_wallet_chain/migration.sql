-- Add NEAR as a wallet chain without changing existing wallet data.
ALTER TYPE "WalletChain" ADD VALUE IF NOT EXISTS 'NEAR';
