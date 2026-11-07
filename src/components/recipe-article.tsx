import { formatMinutes, type RecipeDraft } from "@/lib/kitchen"

export function RecipeArticle({
  recipe,
  actions,
  eyebrow,
  nav,
}: {
  recipe: RecipeDraft
  actions?: React.ReactNode
  eyebrow?: string
  nav?: React.ReactNode
}) {
  const onHand = recipe.ingredients.filter((line) => line.onHand)
  const extra = recipe.ingredients.filter((line) => !line.onHand)

  return (
    <article className="savoria-rise rounded-[1.75rem] border border-border bg-card px-5 py-6 shadow-[0_24px_60px_oklch(0.3_0.02_55/0.06)] sm:px-8 sm:py-8">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[0.72rem] tracking-[0.16em] text-muted-foreground uppercase">
          <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-1 text-[0.68rem] tracking-[0.14em] text-secondary-foreground uppercase">
            {recipe.source === "llama" ? "Llama" : "Local kitchen"}
          </span>
          <span>{formatMinutes(recipe.minutes)}</span>
          <span aria-hidden>·</span>
          <span>
            {recipe.servings} {recipe.servings === 1 ? "serving" : "servings"}
          </span>
        </div>
        {nav}
      </div>
      <h2 className="mt-4 max-w-xl font-serif text-4xl leading-[1.05] text-balance sm:text-5xl">{recipe.title}</h2>
      <p className="mt-3 text-sm tracking-wide text-muted-foreground uppercase">{recipe.method}</p>
      <p className="mt-5 max-w-2xl text-base leading-7">{recipe.summary}</p>
      <p className="mt-5 max-w-2xl rounded-2xl bg-[oklch(0.94_0.028_155)] px-4 py-3 text-sm leading-6 text-[oklch(0.32_0.04_155)]">
        {recipe.honor}
      </p>
      {eyebrow ? <p className="mt-4 text-sm text-muted-foreground">{eyebrow}</p> : null}
      {actions ? <div className="mt-6 flex flex-wrap gap-2">{actions}</div> : null}
      <div className="mt-8 grid gap-10 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <div>
          <IngredientGroup title="From the shelf" lines={onHand} />
          <IngredientGroup title="Also needed" lines={extra} />
        </div>
        <div>
          <h3 className="text-[0.72rem] tracking-[0.16em] text-muted-foreground uppercase">Steps</h3>
          <ol className="mt-4 space-y-4">
            {recipe.steps.map((step, index) => (
              <li key={`${index}-${step.slice(0, 12)}`} className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-3">
                <span className="font-serif text-xl leading-7 text-primary">{index + 1}</span>
                <p className="leading-7">{step}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </article>
  )
}

function IngredientGroup({
  title,
  lines,
}: {
  title: string
  lines: RecipeDraft["ingredients"]
}) {
  if (lines.length === 0) return null
  return (
    <section className="mb-6">
      <h3 className="text-[0.72rem] tracking-[0.16em] text-muted-foreground uppercase">{title}</h3>
      <ul className="mt-3 divide-y divide-border">
        {lines.map((line) => (
          <li key={`${line.item}-${line.amount}`} className="flex items-baseline justify-between gap-4 py-2.5">
            <span>{line.item}</span>
            <span className="shrink-0 text-sm text-muted-foreground">{line.amount}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
