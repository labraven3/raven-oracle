-- Allow users to create a pending raffle entry before submitting a payout wallet.
ALTER TABLE "RaffleEntry"
  ALTER COLUMN "walletAddressId" DROP NOT NULL,
  ALTER COLUMN "walletAddressSnapshot" DROP NOT NULL;

ALTER TABLE "RaffleEntry"
  DROP CONSTRAINT IF EXISTS "RaffleEntry_walletAddressId_fkey";

ALTER TABLE "RaffleEntry"
  ADD CONSTRAINT "RaffleEntry_walletAddressId_fkey"
  FOREIGN KEY ("walletAddressId") REFERENCES "WalletAddress"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
