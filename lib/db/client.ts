import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import { runMigrations } from "./migrations";

declare global {
  var __indexnowDb: Database.Database | undefined;
}

function openDb(): Database.Database {
  const dbPath = process.env.DATABASE_PATH || "./data/indexnow.db";
  const resolved = path.resolve(/* turbopackIgnore: true */ process.cwd(), dbPath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });

  const db = new Database(resolved);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  runMigrations(db);
  return db;
}

export function getDb(): Database.Database {
  if (!global.__indexnowDb) {
    global.__indexnowDb = openDb();
  }
  return global.__indexnowDb;
}
