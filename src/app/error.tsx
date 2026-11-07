"use client"

import { Button } from "@/components/ui/button"
import { Shell } from "@/components/shell"

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Shell mark="kitchen">
      <h1 className="font-serif text-4xl">The kitchen paused for a moment.</h1>
      <p className="mt-3 max-w-md leading-7 text-muted-foreground">
        Try again. What you already saved is still in your collections.
      </p>
      <Button className="mt-6 h-11" onClick={() => reset()}>
        Try again
      </Button>
    </Shell>
  )
}
