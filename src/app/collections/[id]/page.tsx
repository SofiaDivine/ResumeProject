import Link from "next/link"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { io } from "next/cache"

import { removeFromCollectionAction } from "@/app/actions"
import { DissolveCollection } from "@/components/collection-actions"
import { Shell } from "@/components/shell"
import { Button } from "@/components/ui/button"
import { formatMinutes } from "@/lib/kitchen"
import { getCollection, listRecipes } from "@/server/repository"

export const metadata = {
  title: "Collection",
}

export default function CollectionPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Shell mark="collections">
      <Suspense fallback={<div className="h-48 animate-pulse rounded-[1.75rem] bg-muted" />}>
        <CollectionScreen params={params} />
      </Suspense>
    </Shell>
  )
}

async function CollectionScreen({ params }: { params: Promise<{ id: string }> }) {
  await io()
  const { id } = await params
  const collection = getCollection(id)
  if (!collection) notFound()
  const recipes = listRecipes(id)

  return (
    <div>
      <Link href="/collections" className="text-sm text-muted-foreground hover:text-foreground">
        All collections
      </Link>
      <h1 className="mt-3 font-serif text-4xl sm:text-5xl">{collection.name}</h1>
      {collection.note ? <p className="mt-3 max-w-xl leading-7 text-muted-foreground">{collection.note}</p> : null}
      {recipes.length === 0 ? (
        <p className="mt-10 max-w-md leading-7">
          Nothing here yet. Make a recipe in the{" "}
          <Link href="/" className="underline underline-offset-4">
            kitchen
          </Link>{" "}
          and file it here.
        </p>
      ) : (
        <ul className="mt-8 divide-y divide-border rounded-[1.75rem] border border-border bg-card">
          {recipes.map((recipe) => (
            <li key={recipe.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <Link href={`/recipes/${recipe.id}?collection=${collection.id}`} className="font-serif text-2xl hover:text-primary">
                  {recipe.title}
                </Link>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatMinutes(recipe.minutes)} · {recipe.method}
                </p>
              </div>
              <form action={removeFromCollectionAction}>
                <input type="hidden" name="collectionId" value={collection.id} />
                <input type="hidden" name="recipeId" value={recipe.id} />
                <Button type="submit" variant="ghost">
                  Remove
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-8">
        <DissolveCollection id={collection.id} name={collection.name} />
      </div>
    </div>
  )
}
