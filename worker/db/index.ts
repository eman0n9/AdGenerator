import { drizzle } from "drizzle-orm/d1";
import type { D1Database } from "@cloudflare/workers-types";
import * as schema from "./schema.ts";

export function db(d1: D1Database) {
  return drizzle(d1, { schema });
}

export type DB = ReturnType<typeof db>;
export { schema };
