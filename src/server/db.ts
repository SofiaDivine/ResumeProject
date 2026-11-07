import "server-only"

import { existsSync, mkdirSync, renameSync } from "node:fs"
import path from "node:path"
import { DatabaseSync } from "node:sqlite"

const SEED = [
  {
    id: "snidanky",
    name: "Breakfasts",
    note: "Morning, before the day gets loud.",
    hue: "apricot",
    createdAt: "2026-01-01T00:00:00.000Z",
    previousName: "Сніданки",
  },
  {
    id: "obidy",
    name: "Lunches",
    note: "Something that holds the day.",
    hue: "sage",
    createdAt: "2026-01-02T00:00:00.000Z",
    previousName: "Обіди",
  },
  {
    id: "vypichka",
    name: "Baking",
    note: "Batter, an oven, and a whisk.",
    hue: "copper",
    createdAt: "2026-01-03T00:00:00.000Z",
    previousName: "Випічка",
  },
  {
    id: "shvydke",
    name: "Quick",
    note: "When you have less than half an hour.",
    hue: "ink",
    createdAt: "2026-01-04T00:00:00.000Z",
    previousName: "Швидке",
  },
]

const globalForDb = globalThis as unknown as { savoriaDb?: DatabaseSync; savoriaSeedVersion?: number }
const SEED_VERSION = 2

const SCHEMA = `
CREATE TABLE IF NOT EXISTS collections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  hue TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS recipes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  minutes INTEGER NOT NULL,
  servings INTEGER NOT NULL,
  method TEXT NOT NULL,
  honor TEXT NOT NULL,
  ingredients_json TEXT NOT NULL,
  steps_json TEXT NOT NULL,
  request_json TEXT NOT NULL,
  source TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS collection_recipes (
  collection_id TEXT NOT NULL,
  recipe_id TEXT NOT NULL,
  added_at TEXT NOT NULL,
  PRIMARY KEY (collection_id, recipe_id),
  FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
);
`

function seed(database: DatabaseSync) {
  if (globalForDb.savoriaSeedVersion === SEED_VERSION) return
  const insert = database.prepare(
    "INSERT INTO collections (id, name, note, hue, created_at) VALUES (?, ?, ?, ?, ?)",
  )
  const rename = database.prepare("UPDATE collections SET name = ?, note = ? WHERE id = ? AND name = ?")
  for (const item of SEED) {
    const existing = database.prepare("SELECT name FROM collections WHERE id = ?").get(item.id) as
      | { name: string }
      | undefined
    if (!existing) {
      insert.run(item.id, item.name, item.note, item.hue, item.createdAt)
      continue
    }
    if (existing.name === item.previousName) {
      rename.run(item.name, item.note, item.id, item.previousName)
    }
  }
  globalForDb.savoriaSeedVersion = SEED_VERSION
}

function databaseFile() {
  const dir = path.join(process.cwd(), "data")
  mkdirSync(dir, { recursive: true })
  const current = path.join(dir, "savoria.db")
  const previous = path.join(dir, "mise.db")
  if (!existsSync(current) && existsSync(previous)) {
    try {
      renameSync(previous, current)
      for (const suffix of ["-wal", "-shm"]) {
        if (existsSync(previous + suffix)) renameSync(previous + suffix, current + suffix)
      }
    } catch {
      return previous
    }
  }
  return current
}

export function getDb(): DatabaseSync {
  if (!globalForDb.savoriaDb) {
    const database = new DatabaseSync(databaseFile())
    database.exec("PRAGMA foreign_keys = ON")
    database.exec("PRAGMA journal_mode = WAL")
    database.exec(SCHEMA)
    globalForDb.savoriaDb = database
  }
  seed(globalForDb.savoriaDb)
  return globalForDb.savoriaDb
}
