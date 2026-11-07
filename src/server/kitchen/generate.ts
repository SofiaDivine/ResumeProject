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

export async function generateRecipe(input: GenerateInput): Promise<RecipeDraft> {
  const local = composeLocalRecipe(input)
  if (!llamaConfigured()) return local

  try {
    const first = await composeLlamaRecipe(input)
    const problem = constraintViolation(first, input)
    if (!problem) return first

    const second = await composeLlamaRecipe(input, problem)
    if (!constraintViolation(second, input)) return second
  } catch (error) {
    console.error("Llama recipe failed, using the local kitchen.", error)
  }

  return {
    ...local,
    honor: `${local.honor} The model missed a constraint, so the local kitchen wrote this one.`,
  }
}
