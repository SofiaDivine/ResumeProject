"use client"

import { useState } from "react"

import { deleteCollectionAction, deleteRecipeAction } from "@/app/actions"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export function DissolveCollection({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button type="button" variant="ghost" onClick={() => setOpen(true)}>
        Delete collection
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl font-normal">Delete {name}?</DialogTitle>
            <DialogDescription>
              The recipes stay. Only this shelf goes, and you can file them again.
            </DialogDescription>
          </DialogHeader>
          <form action={deleteCollectionAction}>
            <input type="hidden" name="collectionId" value={id} />
            <Button type="submit" variant="destructive">
              Delete
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function DeleteRecipe({ id, returnTo }: { id: string; returnTo: string }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button type="button" variant="ghost" onClick={() => setOpen(true)}>
        Delete recipe
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl font-normal">Delete this recipe?</DialogTitle>
            <DialogDescription>It leaves every collection. You can cook it again from the kitchen.</DialogDescription>
          </DialogHeader>
          <form action={deleteRecipeAction}>
            <input type="hidden" name="recipeId" value={id} />
            <input type="hidden" name="returnTo" value={returnTo} />
            <Button type="submit" variant="destructive">
              Delete
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
