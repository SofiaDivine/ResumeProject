"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"

import { createCollectionAction } from "@/app/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function NewCollectionForm() {
  const [name, setName] = useState("")
  const [pending, startTransition] = useTransition()

  return (
    <form
      className="flex flex-col gap-2 sm:flex-row"
      onSubmit={(event) => {
        event.preventDefault()
        startTransition(async () => {
          const result = await createCollectionAction(name)
          if (!result.ok) {
            toast.error(result.error)
            return
          }
          setName("")
          toast.success(`${result.collection.name} is on the shelf`)
        })
      }}
    >
      <Input
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="New collection, like dinners"
        maxLength={32}
        aria-label="New collection name"
        className="h-11 sm:max-w-xs"
      />
      <Button type="submit" className="h-11" disabled={pending || name.trim().length === 0}>
        Create
      </Button>
    </form>
  )
}
