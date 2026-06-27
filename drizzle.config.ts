import { defineConfig } from "drizzle-kit";

// Generates SQL migrations from worker/db/schema.ts into ./migrations,
// which `wrangler d1 migrations apply` then runs against D1.
export default defineConfig({
  dialect: "sqlite",
  driver: "d1-http",
  schema: "./worker/db/schema.ts",
  out: "./migrations",
});
