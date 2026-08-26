CREATE TABLE "GoogleOAuthConnection" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "google_subject" TEXT NOT NULL,
  "email" TEXT,
  "display_name" TEXT,
  "refresh_token_encrypted" TEXT NOT NULL,
  "access_token_encrypted" TEXT,
  "token_expires_at" TIMESTAMPTZ,
  "connected_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GoogleOAuthConnection_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GoogleOAuthConnection_user_id_key" UNIQUE ("user_id"),
  CONSTRAINT "GoogleOAuthConnection_google_subject_key" UNIQUE ("google_subject"),
  CONSTRAINT "GoogleOAuthConnection_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "GoogleOAuthConnection_email_idx" ON "GoogleOAuthConnection"("email");
CREATE INDEX "GoogleOAuthConnection_updated_at_idx" ON "GoogleOAuthConnection"("updated_at");
