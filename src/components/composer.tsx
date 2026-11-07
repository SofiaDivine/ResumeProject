"use client"

import { useEffect, useRef, useState, useTransition } from "react"

import { generateRecipeAction } from "@/app/actions"
import { RecipeArticle } from "@/components/recipe-article"
import { SaveDialog } from "@/components/save-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { HEAT, type CollectionSummary, type GenerateInput, type HeatId, type RecipeDraft } from "@/lib/kitchen"
import { cn } from "cn"

const DRAFT_KEY = "savoria-draft-v3"
const PREVIOUS_DRAFT_KEY = "mise-draft-v3"

const SUGGESTIONS = [
  "eggs",
  "milk",
  "flour",
  "butter",
  "sugar",
  "apples",
  "farmer's cheese",
  "onion",
  "tomatoes",
  "potatoes",
  "oats",
  "kefir",
]

type Draft = {
  ingredients: string[]
  exclusions: string[]
  notes: string[]
  required: string[]
  minutes: number
  unit: "min" | "hour"
  servings: number
  heat: HeatId[]
}

const INITIAL_DRAFT: Draft = {
  ingredients: [],
  exclusions: [],
  notes: [],
  required: [],
  minutes: 30,
  unit: "min",
  servings: 2,
  heat: ["stove", "oven"],
}

const PRESETS: Array<Draft & { label: string; note: string }> = [
  {
    label: "Apple cake",
    note: "an hour, the oven, no mixer",
    ingredients: ["apples", "flour", "eggs", "sugar", "butter"],
    exclusions: [],
    notes: ["no mixer"],
    required: [],
    minutes: 60,
    unit: "hour",
    servings: 4,
    heat: ["oven"],
  },
  {
    label: "Cheese pancakes",
    note: "half an hour, on the stove",
    ingredients: ["farmer's cheese", "eggs", "flour"],
    exclusions: [],
    notes: ["no mixer"],
    required: [],
    minutes: 30,
    unit: "min",
    servings: 2,
    heat: ["stove"],
  },
  {
    label: "Omelet",
    note: "fifteen minutes",
    ingredients: ["eggs", "milk", "dill"],
    exclusions: [],
    notes: [],
    required: [],
    minutes: 15,
    unit: "min",
    servings: 1,
    heat: ["stove"],
  },
]

const WORKING = ["Choosing one dish, not the whole shelf", "Leaving out what you asked to skip", "Fitting it into the time"]

function includesName(list: string[], value: string) {
  const key = value.toLocaleLowerCase("en")
  return list.some((item) => item.toLocaleLowerCase("en") === key)
}

function hourLabel(minutes: number) {
  const hours = Math.round((minutes / 60) * 2) / 2
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1)
}

function unitWord(minutes: number, unit: "min" | "hour") {
  const value = unit === "hour" ? Math.round(minutes / 60) : minutes
  const one = value === 1
  if (unit === "hour") return one ? "hour" : "hours"
  return one ? "minute" : "minutes"
}

function isHeatId(value: string): value is HeatId {
  return value === "stove" || value === "oven"
}

export function Composer({ collections: initialCollections }: { collections: CollectionSummary[] }) {
  const [draft, setDraft] = useState<Draft>(INITIAL_DRAFT)
  const [ready, setReady] = useState(false)
  const [ingredient, setIngredient] = useState("")
  const [exclusion, setExclusion] = useState("")
  const [note, setNote] = useState("")
  const [collections, setCollections] = useState(initialCollections)
  const [recipe, setRecipe] = useState<RecipeDraft | null>(null)
  const [request, setRequest] = useState<GenerateInput | null>(null)
  const [generation, setGeneration] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [noteIndex, setNoteIndex] = useState(0)
  const [pending, startTransition] = useTransition()
  const offered = useRef<{ key: string; titles: string[] }>({ key: "", titles: [] })

  useEffect(() => {
    const raw = localStorage.getItem(DRAFT_KEY) ?? localStorage.getItem(PREVIOUS_DRAFT_KEY)
    if (raw && !localStorage.getItem(DRAFT_KEY)) localStorage.removeItem(PREVIOUS_DRAFT_KEY)
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Partial<Draft>
        const heat = Array.isArray(parsed.heat) ? parsed.heat.filter((item): item is HeatId => typeof item === "string" && isHeatId(item)) : null
        const ingredients = Array.isArray(parsed.ingredients)
          ? parsed.ingredients.filter((item): item is string => typeof item === "string").slice(0, 16)
          : null
        setDraft((current) => {
          const nextIngredients = ingredients ?? current.ingredients
          return {
            ...current,
            ...parsed,
            ingredients: nextIngredients,
            exclusions: Array.isArray(parsed.exclusions) ? parsed.exclusions.filter((item) => typeof item === "string").slice(0, 12) : current.exclusions,
            notes: Array.isArray(parsed.notes) ? parsed.notes.filter((item) => typeof item === "string").slice(0, 8) : current.notes,
            required: Array.isArray(parsed.required)
              ? parsed.required.filter((item): item is string => typeof item === "string" && nextIngredients.includes(item)).slice(0, 8)
              : [],
            heat: heat && heat.length > 0 ? heat : current.heat,
          unit: parsed.unit === "hour" || parsed.unit === "min" ? parsed.unit : current.unit,
          }
        })
      } catch {
        // A broken draft should not block the kitchen.
      }
    }
    setReady(true)
  }, [])

  useEffect(() => {
    if (!ready) return
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
  }, [draft, ready])

  useEffect(() => {
    if (!pending) return
    const timer = window.setInterval(() => setNoteIndex((index) => (index + 1) % WORKING.length), 1600)
    return () => window.clearInterval(timer)
  }, [pending])

  function addName(value: string, key: "ingredients" | "exclusions" | "notes", limit: number, clear: () => void) {
    const clean = value.trim().replace(/\s+/g, " ")
    if (!clean || includesName(draft[key], clean) || draft[key].length >= limit) return
    setDraft((current) => ({ ...current, [key]: [...current[key], clean] }))
    clear()
  }

  function removeName(key: "ingredients" | "exclusions" | "notes", item: string) {
    setDraft((current) => ({
      ...current,
      [key]: current[key].filter((entry) => entry !== item),
      required: key === "ingredients" ? current.required.filter((entry) => entry !== item) : current.required,
    }))
  }

  function toggleRequired(item: string) {
    setDraft((current) => ({
      ...current,
      required: current.required.includes(item)
        ? current.required.filter((entry) => entry !== item)
        : current.required.length >= 8
          ? current.required
          : [...current.required, item],
    }))
  }

  function toggleHeat(id: HeatId) {
    setDraft((current) => ({
      ...current,
      heat: current.heat.includes(id) ? current.heat.filter((item) => item !== id) : [...current.heat, id],
    }))
  }

  function generate() {
    setError(null)
    setNoteIndex(0)
    const key = JSON.stringify({
      ingredients: draft.ingredients,
      exclusions: draft.exclusions,
      notes: draft.notes,
      required: draft.required,
      minutes: draft.minutes,
      servings: draft.servings,
      heat: draft.heat,
    })
    if (offered.current.key !== key) offered.current = { key, titles: [] }
    const skip = offered.current.titles
    startTransition(async () => {
      const result = await generateRecipeAction(
        {
          ingredients: draft.ingredients,
          exclusions: draft.exclusions,
          notes: draft.notes,
          required: draft.required,
          minutes: draft.minutes,
          servings: draft.servings,
          heat: draft.heat,
        },
        skip,
      )
      if (!result.ok) {
        setError(result.error)
        return
      }
      setRecipe(result.recipe)
      setRequest(result.request)
      setGeneration((value) => value + 1)
      if (offered.current.key === key) offered.current = { key, titles: [...skip, result.recipe.title] }
    })
  }

  const timePresets = draft.unit === "min" ? [15, 30, 45, 90] : [60, 120, 180]

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] lg:gap-12">
      <section className="rounded-[1.75rem] border border-border bg-card p-5 sm:p-6 lg:sticky lg:top-24">
        <form
          onSubmit={(event) => {
            event.preventDefault()
            addName(ingredient, "ingredients", 16, () => setIngredient(""))
          }}
        >
          <Label htmlFor="ingredient" className="text-[0.72rem] tracking-[0.16em] text-muted-foreground uppercase">
            01 · Pantry
          </Label>
          <div className="mt-3 flex gap-2">
            <Input
              id="ingredient"
              value={ingredient}
              onChange={(event) => setIngredient(event.target.value)}
              placeholder="apples, eggs, flour"
              maxLength={48}
              className="h-11"
            />
            <Button type="submit" variant="outline" className="h-11 px-4">
              Add
            </Button>
          </div>
        </form>
        {draft.ingredients.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {draft.ingredients.map((item) => {
              const must = draft.required.includes(item)
              return (
                <span
                  key={item}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full py-1 pr-1 pl-3 text-sm",
                    must ? "bg-foreground text-background" : "bg-secondary",
                  )}
                >
                  {item}
                  <button
                    type="button"
                    aria-pressed={must}
                    aria-label={must ? `${item} must be used` : `Require ${item}`}
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[0.65rem] tracking-[0.12em] uppercase",
                      must ? "bg-background/20" : "hover:bg-background",
                    )}
                    onClick={() => toggleRequired(item)}
                  >
                    Must
                  </button>
                  <button
                    type="button"
                    className={cn("grid size-6 place-items-center rounded-full", must ? "hover:bg-background/20" : "hover:bg-background")}
                    aria-label={`Remove ${item}`}
                    onClick={() => removeName("ingredients", item)}
                  >
                    ×
                  </button>
                </span>
              )
            })}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">Nothing yet. Add what is actually in the kitchen.</p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {SUGGESTIONS.filter((item) => !includesName(draft.ingredients, item)).slice(0, 6).map((item) => (
            <button
              key={item}
              type="button"
              className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => addName(item, "ingredients", 16, () => setIngredient(""))}
            >
              {item}
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          The kitchen cooks what you list, and leaves something out only when it does not belong. Press Must when an ingredient has to be in the dish anyway.
        </p>

        <fieldset className="mt-8">
          <legend className="text-[0.72rem] tracking-[0.16em] text-muted-foreground uppercase">02 · Time and heat</legend>
          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="grid size-10 place-items-center rounded-full border border-border text-lg"
                aria-label="Less time"
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    minutes: Math.max(current.unit === "hour" ? 30 : 10, current.minutes - (current.unit === "hour" ? 30 : 5)),
                  }))
                }
              >
                −
              </button>
              <p className="min-w-24 text-center">
                <span className="font-serif text-4xl leading-none">
                  {draft.unit === "hour" ? hourLabel(draft.minutes) : draft.minutes}
                </span>
                <span className="mt-1 block text-xs tracking-[0.14em] text-muted-foreground uppercase">
                  {unitWord(draft.minutes, draft.unit)}
                </span>
              </p>
              <button
                type="button"
                className="grid size-10 place-items-center rounded-full border border-border text-lg"
                aria-label="More time"
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    minutes: Math.min(480, current.minutes + (current.unit === "hour" ? 30 : 5)),
                  }))
                }
              >
                +
              </button>
            </div>
            <div className="grid grid-cols-2 rounded-full border border-border p-1 text-xs">
              {(["min", "hour"] as const).map((unit) => (
                <button
                  key={unit}
                  type="button"
                  aria-pressed={draft.unit === unit}
                  className={cn(
                    "rounded-full px-3 py-1.5",
                    draft.unit === unit ? "bg-foreground text-background" : "text-muted-foreground",
                  )}
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      unit,
                      minutes:
                        unit === "hour"
                          ? Math.min(480, Math.max(30, Math.round(current.minutes / 30) * 30))
                          : current.minutes,
                    }))
                  }
                >
                  {unit === "min" ? "min" : "hr"}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {timePresets.map((minutes) => (
              <button
                key={minutes}
                type="button"
                aria-pressed={draft.minutes === minutes}
                className={cn(
                  "rounded-full border px-3 py-1 text-sm",
                  draft.minutes === minutes ? "border-foreground bg-foreground text-background" : "border-border",
                )}
                onClick={() => setDraft((current) => ({ ...current, minutes }))}
              >
                {draft.unit === "hour" ? hourLabel(minutes) : minutes}
              </button>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {HEAT.map((item) => {
              const on = draft.heat.includes(item.id)
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleHeat(item.id)}
                  className={cn(
                    "h-11 rounded-xl border text-sm",
                    on ? "border-transparent bg-foreground text-background" : "border-border bg-transparent",
                  )}
                >
                  {item.label}
                </button>
              )
            })}
          </div>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Servings</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="grid size-8 place-items-center rounded-full border border-border"
                aria-label="Fewer servings"
                onClick={() => setDraft((current) => ({ ...current, servings: Math.max(1, current.servings - 1) }))}
              >
                −
              </button>
              <span className="w-6 text-center font-serif text-xl">{draft.servings}</span>
              <button
                type="button"
                className="grid size-8 place-items-center rounded-full border border-border"
                aria-label="More servings"
                onClick={() => setDraft((current) => ({ ...current, servings: Math.min(12, current.servings + 1) }))}
              >
                +
              </button>
            </div>
          </div>
        </fieldset>

        <div className="mt-8">
          <form
            onSubmit={(event) => {
              event.preventDefault()
              addName(exclusion, "exclusions", 12, () => setExclusion(""))
            }}
          >
            <Label htmlFor="exclusion" className="text-[0.72rem] tracking-[0.16em] text-muted-foreground uppercase">
              03 · Leave out
            </Label>
            <div className="mt-3 flex gap-2">
              <Input
                id="exclusion"
                value={exclusion}
                onChange={(event) => setExclusion(event.target.value)}
                placeholder="nuts, milk, mushrooms"
                maxLength={48}
                className="h-11"
              />
              <Button type="submit" variant="outline" className="h-11 px-4">
                Skip
              </Button>
            </div>
          </form>
          {draft.exclusions.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {draft.exclusions.map((item) => (
                <span
                  key={item}
                  className="inline-flex items-center gap-1 rounded-full border border-primary/30 py-1 pr-1 pl-3 text-sm text-primary"
                >
                  {item}
                  <button
                    type="button"
                    className="grid size-6 place-items-center rounded-full hover:bg-primary/10"
                    aria-label={`Allow ${item}`}
                    onClick={() => removeName("exclusions", item)}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div className="mt-8">
          <form
            onSubmit={(event) => {
              event.preventDefault()
              addName(note, "notes", 8, () => setNote(""))
            }}
          >
            <Label htmlFor="note" className="text-[0.72rem] tracking-[0.16em] text-muted-foreground uppercase">
              04 · Notes
            </Label>
            <div className="mt-3 flex gap-2">
              <Input
                id="note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="no mixer, with a whisk"
                maxLength={48}
                className="h-11"
              />
              <Button type="submit" variant="outline" className="h-11 px-4">
                Add
              </Button>
            </div>
          </form>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            A knife, board, bowl, and spoon are assumed. Write a note when you want something specific, like no mixer or with a mixer.
          </p>
          {draft.notes.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {draft.notes.map((item) => (
                <span key={item} className="inline-flex items-center gap-1 rounded-full bg-secondary py-1 pr-1 pl-3 text-sm">
                  {item}
                  <button
                    type="button"
                    className="grid size-6 place-items-center rounded-full hover:bg-background"
                    aria-label={`Remove ${item}`}
                    onClick={() => removeName("notes", item)}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          ) : null}
        </div>

        {error ? <p className="mt-4 text-sm text-primary">{error}</p> : null}
        <Button type="button" className="mt-6 h-12 w-full text-base" disabled={pending || draft.ingredients.length === 0} onClick={generate}>
          {pending ? "Cooking…" : recipe ? "Make another" : "Make a recipe"}
        </Button>
      </section>

      <section aria-live="polite">
        {pending ? (
          <div className="flex min-h-80 flex-col justify-end rounded-[1.75rem] border border-border bg-card p-8">
            <p className="font-serif text-4xl leading-tight text-balance">{WORKING[noteIndex]}</p>
            <p className="mt-4 max-w-md text-sm leading-6 text-muted-foreground">
              Time, heat, and the things you asked to skip stay in place, even when a prettier dish would ignore them.
            </p>
          </div>
        ) : recipe && request ? (
          <RecipeArticle
            recipe={recipe}
            actions={
              <SaveDialog
                key={generation}
                recipe={recipe}
                request={request}
                collections={collections}
                onCollectionsChange={setCollections}
              />
            }
          />
        ) : (
          <div className="rounded-[1.75rem] border border-dashed border-border bg-card/70 p-6 sm:p-8">
            <p className="max-w-lg font-serif text-4xl leading-[1.08] text-balance sm:text-5xl">
              The shelf first, then one dish.
            </p>
            <p className="mt-4 max-w-md text-base leading-7 text-muted-foreground">
              A good recipe can leave some of the shelf unused. Say what you have, how long you have, and whether the stove or the oven is free.
            </p>
            <div className="mt-8 grid gap-3">
              {PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() =>
                    setDraft({
                      ingredients: preset.ingredients,
                      exclusions: preset.exclusions,
                      notes: preset.notes,
                      required: preset.required,
                      minutes: preset.minutes,
                      unit: preset.unit,
                      servings: preset.servings,
                      heat: preset.heat,
                    })
                  }
                  className="rounded-2xl border border-border px-4 py-3 text-left hover:bg-background"
                >
                  <span className="font-serif text-2xl">{preset.label}</span>
                  <span className="mt-1 block text-sm text-muted-foreground">{preset.note}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
