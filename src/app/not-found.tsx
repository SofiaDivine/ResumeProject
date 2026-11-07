import Link from "next/link"

import { Shell } from "@/components/shell"

export default function NotFound() {
  return (
    <Shell mark="kitchen">
      <h1 className="font-serif text-4xl">Nothing here.</h1>
      <p className="mt-3 max-w-md leading-7 text-muted-foreground">
        This page does not exist. The recipe may have been removed, or the address is off.
      </p>
      <Link href="/" className="mt-6 inline-block text-sm underline underline-offset-4">
        Back to the kitchen
      </Link>
    </Shell>
  )
}
