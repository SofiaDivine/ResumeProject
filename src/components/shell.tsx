import Link from "next/link"

import { cn } from "cn"

export function Shell({
  mark,
  children,
}: {
  mark: "kitchen" | "collections"
  children: React.ReactNode
}) {
  return (
    <>
      <header className="sticky top-0 z-20 border-b border-border/80 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-5">
          <Link href="/" className="group flex items-baseline gap-3">
            <span className="font-serif text-[1.7rem] leading-none italic tracking-tight">Savoria</span>
            <span className="hidden text-sm text-muted-foreground sm:inline">from what you have</span>
          </Link>
          <nav className="flex items-center gap-5 text-sm">
            <Link
              href="/"
              aria-current={mark === "kitchen" ? "page" : undefined}
              className={cn(mark === "kitchen" ? "text-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              Kitchen
            </Link>
            <Link
              href="/collections"
              aria-current={mark === "collections" ? "page" : undefined}
              className={cn(
                mark === "collections" ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              Collections
            </Link>
          </nav>
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-5 py-8 sm:py-10">{children}</div>
    </>
  )
}
