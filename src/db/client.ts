import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

export const DEFAULT_DATABASE_URL = "file:local.db";

export function createDb(url: string) {
  return drizzle(createClient({ url }), { schema });
}

export type Db = ReturnType<typeof createDb>;
