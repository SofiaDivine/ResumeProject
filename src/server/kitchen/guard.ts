import type { GenerateInput, RecipeDraft } from "../../lib/kitchen"
import { forbiddenTerms, mentions, normalizeName } from "./text"

const OVEN = /\bovens?\b|\bbake\b|\bbaking\b|\broast(?:ing|ed)?\b|\bbroil\b|духов/
const STOVE = /\b(stove|hob|burner|skillet|saucepan|pot|pan|saute|sauté)\b|сковород|каструл|плит/

function negated(sentence: string): boolean {
  const normalized = normalizeName(sentence)
  return /\b(no|without|don't|do not|never|not)\b/.test(normalized) || normalized.includes("без")
}

function demands(text: string, pattern: RegExp): boolean {
  return text.split(/(?<=[.!?])\s+/).some((sentence) => pattern.test(normalizeName(sentence)) && !negated(sentence))
}

function violatesExclusion(text: string, exclusion: string): boolean {
  return text.split(/(?<=[.!?])\s+/).some((sentence) => mentions(sentence, exclusion) && !negated(sentence))
}

export function constraintViolation(recipe: RecipeDraft, input: GenerateInput): string | null {
  const body = [recipe.title, recipe.summary, ...recipe.steps, ...recipe.ingredients.map((line) => line.item)].join(
    "\n",
  )

  for (const exclusion of input.exclusions) {
    if (violatesExclusion(body, exclusion)) return `an excluded ingredient showed up: ${exclusion}`
  }

  for (const name of input.required) {
    const listed = recipe.ingredients.some((line) => mentions(line.item, name) || mentions(name, line.item))
    const told = body.split(/(?<=[.!?])\s+/).some((sentence) => mentions(sentence, name) && !negated(sentence))
    if (!listed && !told) return `a required ingredient is missing: ${name}`
  }

  for (const term of forbiddenTerms(input.notes)) {
    const pattern = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")
    if (demands(body, pattern)) return `the recipe uses something you ruled out: ${term}`
  }

  if (recipe.minutes > input.minutes) return "the recipe runs past the time limit"
  if (!input.heat.includes("oven") && demands(body, OVEN)) return "the recipe needs an oven"
  if (!input.heat.includes("stove") && demands(body, STOVE)) return "the recipe needs a stove"

  return null
}
