import Link from "next/link"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { io } from "next/cache"

import { DeleteRecipe } from "@/components/collection-actions"
import { HUE_WASH } from "@/components/hue"
import { RecipeArticle } from "@/components/recipe-article"
import { RecipePager } from "@/components/recipe-pager"
import { Shell } from "@/components/shell"
import { formatMinutes } from "@/lib/kitchen"
import { getRecipe, listRecipeNeighbors } from "@/server/repository"
import { cn } from "cn"

export const metadata = {
  title: "Recipe",
}

export default function RecipePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ collection?: string }>
}) {
  return (
    <Shell mark="kitchen">
      <Suspense fallback={<div className="h-80 animate-pulse rounded-[1.75rem] bg-muted" />}>
        <RecipeScreen params={params} searchParams={searchParams} />
      </Suspense>
    </Shell>
  )
}

async function RecipeScreen({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ collection?: string }>
}) {
  await io()
  const { id } = await params
  const { collection: requestedCollection } = await searchParams
  const recipe = getRecipe(id)
  if (!recipe) notFound()
  const requestLine =
    recipe.request.ingredients.length > 0
      ? `Assembled from: ${recipe.request.ingredients.join(", ")} · ${formatMinutes(recipe.request.minutes)}`
      : undefined
  const collection =
    recipe.collections.find((item) => item.id === requestedCollection) ?? recipe.collections[0] ?? null
  const siblings = collection ? listRecipeNeighbors(collection.id) : []
  const index = siblings.findIndex((item) => item.id === recipe.id)
  const pager =
    collection && index >= 0 && siblings.length > 1 ? (
      <RecipePager
        collectionId={collection.id}
        collectionName={collection.name}
        index={index}
        total={siblings.length}
        previous={siblings[index - 1] ?? null}
        next={siblings[index + 1] ?? null}
      />
    ) : null

  return (
    <div>
      <Link href={collection ? `/collections/${collection.id}` : "/collections"} className="text-sm text-muted-foreground hover:text-foreground">
        {collection ? collection.name : "Back to collections"}
      </Link>
      <div className="mt-4">
        <RecipeArticle recipe={recipe} eyebrow={requestLine} nav={pager} />
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-2">
        {recipe.collections.length > 0 ? (
          recipe.collections.map((collection) => (
            <Link
              key={collection.id}
              href={`/collections/${collection.id}`}
              className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm"
            >
              <span className={cn("size-2 rounded-full", HUE_WASH[collection.hue])} />
              {collection.name}
            </Link>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">Not in a collection yet.</p>
        )}
      </div>
      <div className="mt-4">
        <DeleteRecipe id={recipe.id} returnTo="/collections" />
      </div>
    </div>
  )
}
