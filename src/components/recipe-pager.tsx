import Link from "next/link"

import { cn } from "cn"

function recipeHref(id: string, collectionId: string) {
  return `/recipes/${id}?collection=${encodeURIComponent(collectionId)}`
}

export function RecipePager({
  collectionId,
  collectionName,
  index,
  total,
  previous,
  next,
}: {
  collectionId: string
  collectionName: string
  index: number
  total: number
  previous: { id: string; title: string } | null
  next: { id: string; title: string } | null
}) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <p className="mr-1 text-right text-[0.68rem] leading-4 tracking-[0.12em] text-muted-foreground uppercase">
        {collectionName}
        <span className="mt-0.5 block normal-case tracking-normal">
          {index + 1} / {total}
        </span>
      </p>
      <PagerLink recipe={previous} collectionId={collectionId} direction="previous" />
      <PagerLink recipe={next} collectionId={collectionId} direction="next" />
    </div>
  )
}

function PagerLink({
  recipe,
  collectionId,
  direction,
}: {
  recipe: { id: string; title: string } | null
  collectionId: string
  direction: "previous" | "next"
}) {
  const label = direction === "previous" ? "Previous recipe" : "Next recipe"
  const glyph = direction === "previous" ? "←" : "→"
  const className = "grid size-10 place-items-center rounded-full border border-border text-lg"

  if (!recipe) {
    return (
      <span aria-hidden className={cn(className, "text-muted-foreground opacity-35")}>
        {glyph}
      </span>
    )
  }

  return (
    <Link href={recipeHref(recipe.id, collectionId)} aria-label={`${label}: ${recipe.title}`} className={cn(className, "hover:bg-background")}>
      {glyph}
    </Link>
  )
}
