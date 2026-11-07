import Link from "next/link"
import { Suspense } from "react"
import { io } from "next/cache"

import { HUE_WASH } from "@/components/hue"
import { NewCollectionForm } from "@/components/new-collection-form"
import { Shell } from "@/components/shell"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { recipeCountLabel } from "@/lib/kitchen"
import { listCollections } from "@/server/repository"
import { cn } from "cn"

export const metadata = {
  title: "Collections",
}

export default function CollectionsPage() {
  return (
    <Shell mark="collections">
      <div className="mb-8 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-xl">
          <h1 className="font-serif text-4xl leading-tight sm:text-5xl">Collections</h1>
          <p className="mt-3 text-base leading-7 text-muted-foreground">
            Breakfasts, lunches, baking, or a shelf of your own. Only the recipes you save land here.
          </p>
        </div>
        <NewCollectionForm />
      </div>
      <Suspense fallback={<div className="h-48 animate-pulse rounded-[1.75rem] bg-muted" />}>
        <CollectionIndex />
      </Suspense>
    </Shell>
  )
}

async function CollectionIndex() {
  await io()
  const collections = listCollections()
  if (collections.length === 0) {
    return <p className="text-muted-foreground">The shelves are empty. Create the first collection above.</p>
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {collections.map((collection) => (
        <Link key={collection.id} href={`/collections/${collection.id}`} className="block">
          <Card className="h-full gap-0 overflow-hidden py-0 transition-transform hover:-translate-y-0.5">
            <div className={cn("h-16", HUE_WASH[collection.hue])} />
            <CardHeader className="py-5">
              <CardTitle className="font-serif text-3xl font-normal">{collection.name}</CardTitle>
              <CardDescription className="text-sm leading-6">
                {collection.note || "A shelf of your own"}
              </CardDescription>
              <p className="pt-2 text-sm text-muted-foreground">{recipeCountLabel(collection.recipeCount)}</p>
            </CardHeader>
          </Card>
        </Link>
      ))}
    </div>
  )
}
