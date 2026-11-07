"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import type { CollectionSummary, GenerateInput, RecipeDraft } from "@/lib/kitchen"
import { generateRecipe, prepareInput } from "@/server/kitchen/generate"
import {
  collectionNameSchema,
  parseGenerateInput,
  parseId,
  parseRecipeDraft,
} from "@/server/kitchen/schema"
import { mentions } from "@/server/kitchen/text"
import {
  attachRecipe,
  createCollection,
  deleteCollection,
  deleteRecipe,
  removeFromCollection,
  saveRecipe,
} from "@/server/repository"

export type GenerateResult =
  | { ok: true; recipe: RecipeDraft; request: GenerateInput }
  | { ok: false; error: string }

function safePath(value: FormDataEntryValue | null): string {
  const path = typeof value === "string" ? value : "/"
  if (path.startsWith("/") && !path.startsWith("//") && !path.includes("\\")) return path
  return "/"
}

export async function generateRecipeAction(input: GenerateInput): Promise<GenerateResult> {
  const parsed = parseGenerateInput(input)
  if (!parsed.success) {
    return { ok: false, error: "Check the ingredients, time, and heat. Time runs from 10 minutes to 8 hours." }
  }
  const request = prepareInput(parsed.data)
  const usable = request.ingredients.filter(
    (name) => !request.exclusions.some((exclusion) => mentions(name, exclusion)),
  )
  if (usable.length === 0) {
    return { ok: false, error: "Every ingredient was marked to leave out. Keep at least one." }
  }
  const recipe = await generateRecipe(request)
  if (recipe.ingredients.length === 0) return { ok: false, error: recipe.summary }
  return { ok: true, recipe, request }
}

export async function createCollectionAction(
  name: string,
): Promise<{ ok: true; collection: CollectionSummary } | { ok: false; error: string }> {
  const parsed = collectionNameSchema.safeParse(name)
  if (!parsed.success) return { ok: false, error: "Name the collection, up to 32 characters." }
  const collection = createCollection(parsed.data)
  revalidatePath("/collections")
  return { ok: true, collection }
}

export async function saveRecipeAction(
  draft: RecipeDraft,
  request: GenerateInput,
  collectionId: string,
  existingId: string | null,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const parsedDraft = parseRecipeDraft(draft)
  const parsedRequest = parseGenerateInput(request)
  const parsedCollection = parseId(collectionId)
  if (!parsedDraft.success || !parsedRequest.success || !parsedCollection.success) {
    return { ok: false, error: "Could not save this recipe." }
  }
  try {
    if (existingId) {
      const parsedExisting = parseId(existingId)
      if (!parsedExisting.success) return { ok: false, error: "Could not save this recipe." }
      attachRecipe(parsedExisting.data, parsedCollection.data)
      revalidatePath("/collections")
      revalidatePath(`/collections/${parsedCollection.data}`)
      revalidatePath(`/recipes/${parsedExisting.data}`)
      return { ok: true, id: parsedExisting.data }
    }
    const id = saveRecipe(parsedDraft.data, parsedRequest.data, parsedCollection.data)
    revalidatePath("/collections")
    revalidatePath(`/collections/${parsedCollection.data}`)
    revalidatePath(`/recipes/${id}`)
    return { ok: true, id }
  } catch (error) {
    console.error(error)
    return { ok: false, error: "Collection not found." }
  }
}

export async function removeFromCollectionAction(formData: FormData): Promise<void> {
  const collectionId = parseId(formData.get("collectionId"))
  const recipeId = parseId(formData.get("recipeId"))
  if (!collectionId.success || !recipeId.success) return
  removeFromCollection(collectionId.data, recipeId.data)
  revalidatePath("/collections")
  revalidatePath(`/collections/${collectionId.data}`)
  revalidatePath(`/recipes/${recipeId.data}`)
}

export async function deleteRecipeAction(formData: FormData): Promise<void> {
  const recipeId = parseId(formData.get("recipeId"))
  if (!recipeId.success) return
  deleteRecipe(recipeId.data)
  revalidatePath("/collections")
  redirect(safePath(formData.get("returnTo")))
}

export async function deleteCollectionAction(formData: FormData): Promise<void> {
  const collectionId = parseId(formData.get("collectionId"))
  if (!collectionId.success) return
  deleteCollection(collectionId.data)
  revalidatePath("/collections")
  redirect("/collections")
}
