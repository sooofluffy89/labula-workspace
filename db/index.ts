import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import {accessContext,guardDatabase} from "@/lib/access-context";
import * as schema from "./schema";

export function getRawDb() { if(!env.DB) throw new Error('Shared storage unavailable.');const context=accessContext.getStore();return context?guardDatabase(env.DB,context):env.DB; }

export function getDb() {
  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database."
    );
  }

  return drizzle(getRawDb(), { schema });
}

export function getAppAccessMode():'application'|'restricted'{return (env as unknown as {TEAM_ACCESS_MODE?:string}).TEAM_ACCESS_MODE==='application'?'application':'restricted';}
