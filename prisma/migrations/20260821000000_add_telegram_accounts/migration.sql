CREATE TABLE IF NOT EXISTS "telegram_accounts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "telegram_user_id" BIGINT NOT NULL,
  "username" VARCHAR(255),
  "first_name" VARCHAR(255),
  "last_name" VARCHAR(255),
  "connected_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "telegram_accounts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "telegram_accounts_user_id_key" UNIQUE ("user_id"),
  CONSTRAINT "telegram_accounts_telegram_user_id_key" UNIQUE ("telegram_user_id"),
  CONSTRAINT "telegram_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "telegram_accounts_user_id_idx" ON "telegram_accounts"("user_id");
CREATE INDEX IF NOT EXISTS "telegram_accounts_telegram_user_id_idx" ON "telegram_accounts"("telegram_user_id");
