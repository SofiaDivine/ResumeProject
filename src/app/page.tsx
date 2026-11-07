import { Suspense } from "react"
import { io } from "next/cache"

import { Composer } from "@/components/composer"
import { Shell } from "@/components/shell"
import { listCollections } from "@/server/repository"

export default function Home() {
  return (
    <Shell mark="kitchen">
      <div className="mb-8 max-w-2xl">
        <h1 className="font-serif text-4xl leading-[1.05] text-balance sm:text-5xl">A recipe from what you already have.</h1>
        <p className="mt-3 max-w-xl text-base leading-7 text-muted-foreground">
          Time, heat, and a short list of what to skip. What you list is the meal: a main, and a side when you have one. Press Must when something has to be included. A recipe you like can go into breakfasts, lunches, or baking.
        </p>
      </div>
      <Suspense fallback={<KitchenFallback />}>
        <Kitchen />
      </Suspense>
    </Shell>
  )
}

async function Kitchen() {
  await io()
  const collections = listCollections()
  return <Composer collections={collections} />
}

function KitchenFallback() {
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
      <div className="h-[28rem] animate-pulse rounded-[1.75rem] bg-card" />
      <div className="h-80 animate-pulse rounded-[1.75rem] bg-muted" />
    </div>
  )
}
