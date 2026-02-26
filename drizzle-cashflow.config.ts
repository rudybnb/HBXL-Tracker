import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./shared-cashflow/schema.ts",
  out: "./migrations-cashflow",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL_CASHFLOW || process.env.DATABASE_URL!,
  },
});