import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma generate does not connect to the database, but Prisma 7 still requires
// a syntactically valid datasource URL while loading this config. Keep the real
// DATABASE_URL when available and use a local placeholder only for generation
// when a developer has not loaded their environment yet.
const databaseUrl = process.env.DATABASE_URL ?? "postgresql://placeholder:placeholder@localhost:5432/raven_oracle";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: databaseUrl,
  },
  migrations: {
    path: "prisma/migrations",
    seed: "npx tsx prisma/seed.ts",
  },
});
