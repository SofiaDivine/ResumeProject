import "server-only"

import { randomUUID } from "node:crypto"

import {
  HUES,
  type CollectionSummary,
  type GenerateInput,
  type Hue,
  type RecipeCollectionRef,
  type RecipeDraft,
  type SavedRecipe,
} from "@/lib/kitchen"
import { getDb } from "@/server/db"
import { coerceGenerateInput } from "@/server/kitchen/schema"

type CollectionRow = {
  id: string
  name: string
  note: string
  hue: string
  created_at: string
  recipe_count: number
}

type RecipeRow = {
  id: string
  title: string
  summary: string
  minutes: number
  servings: number
  method: string
  honor: string
  ingredients_json: string
  steps_json: string
  request_json: string
  source: string
  created_at: string
}

function isHue(value: string): value is Hue {
  return (HUES as readonly string[]).includes(value)
}

function collectionFrom(row: CollectionRow): CollectionSummary {
  return {
    id: row.id,
    name: row.name,
    note: row.note,
    hue: isHue(row.hue) ? row.hue : "apricot",
    createdAt: row.created_at,
    recipeCount: Number(row.recipe_count ?? 0),
  }
}

function readRequest(raw: string, fallback: { minutes: number; servings: number }): GenerateInput {
  try {
    const parsed = coerceGenerateInput(JSON.parse(raw))
    if (parsed) return parsed
  } catch {
    // The row stays readable even if an older payload is incomplete.
  }
  return {
    ingredients: [],
    exclusions: [],
    notes: [],
    required: [],
    minutes: fallback.minutes,
    servings: fallback.servings,
    heat: [],
  }
}

function recipeFrom(row: RecipeRow): SavedRecipe {
  const ingredients = JSON.parse(row.ingredients_json) as SavedRecipe["ingredients"]
  const steps = JSON.parse(row.steps_json) as string[]
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    minutes: Number(row.minutes),
    servings: Number(row.servings),
    method: row.method,
    honor: row.honor,
    ingredients,
    steps,
    source: row.source === "llama" ? "llama" : "kitchen",
    createdAt: row.created_at,
    request: readRequest(row.request_json, { minutes: Number(row.minutes), servings: Number(row.servings) }),
  }
}

export function listCollections(): CollectionSummary[] {
  const rows = getDb()
    .prepare(
      `SELECT c.id, c.name, c.note, c.hue, c.created_at,
        (SELECT COUNT(*) FROM collection_recipes cr WHERE cr.collection_id = c.id) AS recipe_count
       FROM collections c
       ORDER BY c.created_at ASC`,
    )
    .all() as CollectionRow[]
  return rows.map(collectionFrom)
}

export function getCollection(id: string): CollectionSummary | null {
  const row = getDb()
    .prepare(
      `SELECT c.id, c.name, c.note, c.hue, c.created_at,
        (SELECT COUNT(*) FROM collection_recipes cr WHERE cr.collection_id = c.id) AS recipe_count
       FROM collections c
       WHERE c.id = ?`,
    )
    .get(id) as CollectionRow | undefined
  return row ? collectionFrom(row) : null
}

export function listRecipeNeighbors(collectionId: string): { id: string; title: string }[] {
  return getDb()
    .prepare(
      `SELECT r.id, r.title
       FROM recipes r
       JOIN collection_recipes cr ON cr.recipe_id = r.id
       WHERE cr.collection_id = ?
       ORDER BY cr.added_at DESC`,
    )
    .all(collectionId) as { id: string; title: string }[]
}

export function listRecipes(collectionId: string): SavedRecipe[] {
  const rows = getDb()
    .prepare(
      `SELECT r.*
       FROM recipes r
       JOIN collection_recipes cr ON cr.recipe_id = r.id
       WHERE cr.collection_id = ?
       ORDER BY cr.added_at DESC`,
    )
    .all(collectionId) as RecipeRow[]
  return rows.map(recipeFrom)
}

export function getRecipe(id: string): (SavedRecipe & { collections: RecipeCollectionRef[] }) | null {
  const row = getDb().prepare("SELECT * FROM recipes WHERE id = ?").get(id) as RecipeRow | undefined
  if (!row) return null
  const collections = getDb()
    .prepare(
      `SELECT c.id, c.name, c.hue
       FROM collections c
       JOIN collection_recipes cr ON cr.collection_id = c.id
       WHERE cr.recipe_id = ?
       ORDER BY c.created_at ASC`,
    )
    .all(id) as { id: string; name: string; hue: string }[]
  return {
    ...recipeFrom(row),
    collections: collections.map((item) => ({
      id: item.id,
      name: item.name,
      hue: isHue(item.hue) ? item.hue : "apricot",
    })),
  }
}

export function createCollection(name: string): CollectionSummary {
  const db = getDb()
  const countRow = db.prepare("SELECT COUNT(*) AS n FROM collections").get() as { n: number }
  const id = randomUUID()
  const createdAt = new Date().toISOString()
  const hue = HUES[Number(countRow.n) % HUES.length] ?? "apricot"
  db.prepare("INSERT INTO collections (id, name, note, hue, created_at) VALUES (?, ?, ?, ?, ?)").run(
    id,
    name,
    "",
    hue,
    createdAt,
  )
  return { id, name, note: "", hue, createdAt, recipeCount: 0 }
}

export function saveRecipe(draft: RecipeDraft, request: GenerateInput, collectionId: string): string {
  const db = getDb()
  const collection = db.prepare("SELECT id FROM collections WHERE id = ?").get(collectionId)
  if (!collection) throw new Error("Collection not found")
  const id = randomUUID()
  const now = new Date().toISOString()
  db.exec("BEGIN")
  try {
    db.prepare(
      `INSERT INTO recipes
        (id, title, summary, minutes, servings, method, honor, ingredients_json, steps_json, request_json, source, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      draft.title,
      draft.summary,
      draft.minutes,
      draft.servings,
      draft.method,
      draft.honor,
      JSON.stringify(draft.ingredients),
      JSON.stringify(draft.steps),
      JSON.stringify(request),
      draft.source,
      now,
    )
    db.prepare("INSERT INTO collection_recipes (collection_id, recipe_id, added_at) VALUES (?, ?, ?)").run(
      collectionId,
      id,
      now,
    )
    db.exec("COMMIT")
  } catch (error) {
    db.exec("ROLLBACK")
    throw error
  }
  return id
}

export function attachRecipe(recipeId: string, collectionId: string): void {
  const db = getDb()
  const recipe = db.prepare("SELECT id FROM recipes WHERE id = ?").get(recipeId)
  const collection = db.prepare("SELECT id FROM collections WHERE id = ?").get(collectionId)
  if (!recipe || !collection) throw new Error("Recipe or collection not found")
  db.prepare(
    "INSERT INTO collection_recipes (collection_id, recipe_id, added_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING",
  ).run(collectionId, recipeId, new Date().toISOString())
}

export function removeFromCollection(collectionId: string, recipeId: string): void {
  getDb()
    .prepare("DELETE FROM collection_recipes WHERE collection_id = ? AND recipe_id = ?")
    .run(collectionId, recipeId)
}

export function deleteRecipe(id: string): void {
  getDb().prepare("DELETE FROM recipes WHERE id = ?").run(id)
}

export function deleteCollection(id: string): void {
  getDb().prepare("DELETE FROM collections WHERE id = ?").run(id)
}
