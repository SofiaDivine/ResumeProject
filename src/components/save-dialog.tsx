"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"

import { createCollectionAction, saveRecipeAction } from "@/app/actions"
import { HUE_WASH } from "@/components/hue"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { recipeCountLabel, type CollectionSummary, type GenerateInput, type RecipeDraft } from "@/lib/kitchen"
import { cn } from "cn"

export function SaveDialog({
  recipe,
  request,
  collections,
  onCollectionsChange,
}: {
  recipe: RecipeDraft
  request: GenerateInput
  collections: CollectionSummary[]
  onCollectionsChange: (collections: CollectionSummary[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState(collections[0]?.id ?? "")
  const [savedIds, setSavedIds] = useState<string[]>([])
  const [recipeId, setRecipeId] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [pending, startTransition] = useTransition()

  function save(collectionId: string) {
    startTransition(async () => {
      const result = await saveRecipeAction(recipe, request, collectionId, recipeId)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setRecipeId(result.id)
      setSavedIds((current) => (current.includes(collectionId) ? current : [...current, collectionId]))
      onCollectionsChange(
        collections.map((collection) =>
          collection.id === collectionId ? { ...collection, recipeCount: collection.recipeCount + 1 } : collection,
        ),
      )
      const collection = collections.find((item) => item.id === collectionId)
      toast.success(collection ? `Saved to ${collection.name}` : "Saved")
      setOpen(false)
    })
  }

  function createAndSelect(event: React.FormEvent) {
    event.preventDefault()
    startTransition(async () => {
      const result = await createCollectionAction(name)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      onCollectionsChange([...collections, result.collection])
      setSelected(result.collection.id)
      setName("")
      toast.success(`${result.collection.name} is ready`)
    })
  }

  return (
    <>
      <Button type="button" variant="outline" className="h-11 px-4" onClick={() => setOpen(true)}>
        {savedIds.length > 0 ? "Save to another" : "Save to a collection"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl font-normal">Save to a collection</DialogTitle>
            <DialogDescription>One recipe can live in more than one collection.</DialogDescription>
          </DialogHeader>
          <div className="grid max-h-64 gap-2 overflow-y-auto">
            {collections.map((collection) => {
              const already = savedIds.includes(collection.id)
              return (
                <button
                  key={collection.id}
                  type="button"
                  aria-pressed={selected === collection.id}
                  disabled={already}
                  onClick={() => setSelected(collection.id)}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left",
                    selected === collection.id ? "border-foreground bg-foreground text-background" : "border-border",
                    already && "opacity-50",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span className={cn("size-2.5 rounded-full", HUE_WASH[collection.hue])} />
                    {collection.name}
                  </span>
                  <span className="text-xs opacity-70">
                    {already ? "already here" : recipeCountLabel(collection.recipeCount)}
                  </span>
                </button>
              )
            })}
          </div>
          <form onSubmit={createAndSelect} className="flex gap-2">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="New collection"
              maxLength={32}
              className="h-11"
              aria-label="New collection name"
            />
            <Button type="submit" variant="secondary" className="h-11" disabled={pending || name.trim().length === 0}>
              Create
            </Button>
          </form>
          <Button
            type="button"
            className="h-11"
            disabled={pending || !selected || savedIds.includes(selected)}
            onClick={() => save(selected)}
          >
            {pending ? "Saving…" : "Save"}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  )
}
