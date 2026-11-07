import { z } from "zod"

import type { GenerateInput, HeatId, RecipeDraft } from "@/lib/kitchen"

export const generateInputSchema = z.object({
  ingredients: z.array(z.string().trim().min(1).max(48)).min(1).max(16),
  exclusions: z.array(z.string().trim().min(1).max(48)).max(12),
  notes: z.array(z.string().trim().min(1).max(48)).max(8),
  required: z.array(z.string().trim().min(1).max(48)).max(8),
  minutes: z.number().int().min(10).max(480),
  servings: z.number().int().min(1).max(12),
  heat: z.array(z.enum(["stove", "oven"])).max(2),
})

export const recipeDraftSchema = z.object({
  title: z.string().trim().min(2).max(100),
  summary: z.string().trim().min(2).max(400),
  minutes: z.number().int().min(1).max(480),
  servings: z.number().int().min(1).max(12),
  method: z.string().trim().min(1).max(120),
  honor: z.string().trim().min(1).max(500),
  ingredients: z
    .array(
      z.object({
        item: z.string().trim().min(1).max(80),
        amount: z.string().trim().min(1).max(80),
        onHand: z.boolean(),
      }),
    )
    .min(1)
    .max(20),
  steps: z.array(z.string().trim().min(1).max(500)).min(1).max(12),
  source: z.enum(["llama", "kitchen"]),
})

const idSchema = z.string().trim().regex(/^[a-zA-Z0-9-]{1,64}$/)

export const collectionNameSchema = z.string().trim().min(1).max(32)

export function parseGenerateInput(input: unknown) {
  return generateInputSchema.safeParse(input)
}

export function parseRecipeDraft(input: unknown) {
  return recipeDraftSchema.safeParse(input)
}

export function parseId(input: unknown) {
  return idSchema.safeParse(input)
}

function asStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
}

export function coerceGenerateInput(value: unknown): GenerateInput | null {
  const parsed = generateInputSchema.safeParse(value)
  if (parsed.success) return parsed.data
  if (!value || typeof value !== "object") return null
  const raw = value as Record<string, unknown>
  const minutes = typeof raw.minutes === "number" ? raw.minutes : null
  const servings = typeof raw.servings === "number" ? raw.servings : null
  if (minutes === null || servings === null) return null

  const heat = new Set<HeatId>()
  for (const item of asStrings(raw.heat)) {
    if (item === "stove" || item === "oven") heat.add(item)
  }
  for (const item of asStrings(raw.equipment)) {
    if (item === "pot" || item === "pan") heat.add("stove")
    if (item === "oven") heat.add("oven")
  }

  const notes = asStrings(raw.notes)
  const required = asStrings(raw.required)
  const avoid = asStrings(raw.avoid)
  if (avoid.includes("mixer")) notes.push("no mixer")
  if (avoid.includes("blender")) notes.push("no blender")

  return {
    ingredients: asStrings(raw.ingredients),
    exclusions: asStrings(raw.exclusions),
    notes,
    required,
    minutes,
    servings,
    heat: [...heat],
  }
}

export type ParsedInput = GenerateInput
export type ParsedDraft = RecipeDraft
