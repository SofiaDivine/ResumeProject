export const HEAT = [
  { id: "stove", label: "Stove" },
  { id: "oven", label: "Oven" },
] as const

export const HUES = ["apricot", "sage", "copper", "ink", "berry"] as const

export type HeatId = (typeof HEAT)[number]["id"]
export type Hue = (typeof HUES)[number]
export type RecipeSource = "llama" | "kitchen"

export type IngredientLine = {
  item: string
  amount: string
  onHand: boolean
}

export type GenerateInput = {
  ingredients: string[]
  exclusions: string[]
  notes: string[]
  required: string[]
  minutes: number
  servings: number
  heat: HeatId[]
}

export type RecipeDraft = {
  title: string
  summary: string
  minutes: number
  servings: number
  method: string
  honor: string
  ingredients: IngredientLine[]
  steps: string[]
  source: RecipeSource
}

export type SavedRecipe = RecipeDraft & {
  id: string
  createdAt: string
  request: GenerateInput
}

export type CollectionSummary = {
  id: string
  name: string
  note: string
  hue: Hue
  createdAt: string
  recipeCount: number
}

export type RecipeCollectionRef = {
  id: string
  name: string
  hue: Hue
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  const hourWord = hours === 1 ? "hour" : "hours"
  if (rest === 0) return `${hours} ${hourWord}`
  return `${hours} ${hourWord} ${rest} min`
}

export function recipeCountLabel(count: number): string {
  return `${count} ${count === 1 ? "recipe" : "recipes"}`
}

export function constraintsSentence(input: GenerateInput, extra?: string): string {
  const parts = [`Within ${formatMinutes(input.minutes)}.`]
  if (input.required.length > 0) parts.push(`Use ${input.required.join(", ")}.`)
  if (input.notes.length > 0) parts.push(input.notes.join(". ").replace(/\.$/, "") + ".")
  if (input.exclusions.length > 0) parts.push(`Without ${input.exclusions.join(", ")}.`)
  if (extra) parts.push(extra)
  return parts.join(" ")
}
