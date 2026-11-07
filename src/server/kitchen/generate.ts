import "server-only"

import type { GenerateInput, RecipeDraft } from "@/lib/kitchen"
import { constraintViolation } from "./guard"
import { composeLlamaRecipe, llamaConfigured } from "./llama"
import { composeLocalRecipe } from "./local-kitchen"
import { dedupeNames, mentions } from "./text"

export function prepareInput(input: GenerateInput): GenerateInput {
  const ingredients = dedupeNames(input.ingredients)
  const exclusions = dedupeNames(input.exclusions)
  return {
    ...input,
    ingredients,
    exclusions,
    notes: dedupeNames(input.notes),
    required: dedupeNames(input.required).filter(
      (name) =>
        ingredients.some((item) => mentions(item, name) || mentions(name, item)) &&
        !exclusions.some((exclusion) => mentions(name, exclusion) || mentions(exclusion, name)),
    ),
    heat: [...new Set(input.heat)],
  }
}

function alreadyOffered(title: string, skipTitles: string[]) {
  const key = title.trim().toLowerCase()
  return skipTitles.some((item) => item.trim().toLowerCase() === key)
}

export async function generateRecipe(input: GenerateInput, skipTitles: string[] = []): Promise<RecipeDraft> {
  const local = composeLocalRecipe(input, skipTitles)
  if (!llamaConfigured()) return local

  let missed = false
  try {
    const first = await composeLlamaRecipe(input, undefined, skipTitles)
    const problem = constraintViolation(first, input)
    if (!problem && !alreadyOffered(first.title, skipTitles)) return first
    if (problem) missed = true

    const second = await composeLlamaRecipe(input, problem ?? `it repeated ${skipTitles.join(", ")}`, skipTitles)
    if (!constraintViolation(second, input) && !alreadyOffered(second.title, skipTitles)) return second
    missed = true
  } catch (error) {
    missed = true
    console.error("Llama recipe failed, using the local kitchen.", error)
  }

  if (!missed) return local
  return {
    ...local,
    honor: `${local.honor} The model missed a constraint, so the local kitchen wrote this one.`,
  }
}
