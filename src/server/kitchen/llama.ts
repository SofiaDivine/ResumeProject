import { createOpenAI } from "@ai-sdk/openai"
import { generateText, Output } from "ai"
import { z } from "zod"

import { constraintsSentence, type GenerateInput, type RecipeDraft } from "@/lib/kitchen"

const llamaRecipeSchema = z.object({
  title: z.string().min(2).max(90),
  summary: z.string().min(8).max(320),
  minutes: z.number().positive().max(480),
  method: z.string().min(2).max(80),
  honor: z.string().min(2).max(400),
  ingredients: z
    .array(
      z.object({
        item: z.string().min(1).max(60),
        amount: z.string().min(1).max(40),
        onHand: z.boolean(),
      }),
    )
    .min(1)
    .max(14),
  steps: z.array(z.string().min(3).max(360)).min(3).max(8),
})

export function llamaConfigured(): boolean {
  return Boolean(process.env.LLM_API_KEY && process.env.LLM_BASE_URL && process.env.LLM_MODEL)
}

function model() {
  const provider = createOpenAI({
    apiKey: process.env.LLM_API_KEY,
    baseURL: process.env.LLM_BASE_URL,
    name: "llama",
  })
  return provider.chat(process.env.LLM_MODEL ?? "llama-3.3-70b-versatile")
}

function prompt(input: GenerateInput, repair?: string, avoidTitles: string[] = []): string {
  const heat = input.heat.length > 0 ? input.heat.join(" and ") : "no stove and no oven"
  return [
    `On the shelf: ${input.ingredients.join(", ")}.`,
    `Servings: ${input.servings}.`,
    `Time limit: ${input.minutes} minutes.`,
    `Heat available: ${heat}.`,
    `Must use, the dish has to include these: ${input.required.length > 0 ? input.required.join(", ") : "nothing"}.`,
    `Notes, follow them literally: ${input.notes.length > 0 ? input.notes.join("; ") : "none"}.`,
    `Never use: ${input.exclusions.length > 0 ? input.exclusions.join(", ") : "nothing"}.`,
    avoidTitles.length > 0
      ? `Do not cook these again: ${avoidTitles.join("; ")}. Make a different dish from the same shelf.`
      : "",
    repair ? `The previous answer was rejected because ${repair}. Write a different recipe that keeps every constraint.` : "",
  ]
    .filter(Boolean)
    .join("\n")
}

export async function composeLlamaRecipe(input: GenerateInput, repair?: string, avoidTitles: string[] = []): Promise<RecipeDraft> {
  const result = await generateText({
    model: model(),
    temperature: avoidTitles.length > 0 ? 0.7 : 0.4,
    maxOutputTokens: 1200,
    maxRetries: 0,
    abortSignal: AbortSignal.timeout(25_000),
    output: Output.object({
      schema: llamaRecipeSchema,
      name: "recipe",
      description: "One home recipe in English that cooks the shelf as a plate and respects the constraints",
    }),
    system: [
      "You are a careful home cook. Write in English, in concrete kitchen language.",
      "Cook what the person listed. The shelf is the meal, not a hint. Use the ingredients that can share a plate.",
      "If there is a main and a starch, cook both. Fish with rice means the fish is the main and the rice is a side, rinsed and simmered in salted water in its own pot. Never tell the cook to slice rice, bulgur, pasta, or any other grain.",
      "With an oven, bake the fish or chicken with the olives and cheese. With only a stove, pan-fry the main and simmer the rice, pasta, or potatoes.",
      "Leave an ingredient out only when it fights the dish: fruit and sugar do not go into a fish dinner, and raw chicken does not go into a cake. Name that leftover in honor, and say why.",
      "Must-use ingredients are never optional, even when they are unusual next to the main.",
      "Do not answer with a one-ingredient recipe when the shelf has a side, a garnish, or a sauce that belongs with it.",
      "You may add only water, salt, pepper, and oil, and only when they are not excluded.",
      "Never use an excluded ingredient, not even as a garnish or an optional note.",
      "If the stove is off, do not use a pan, pot, skillet, or hob. If the oven is off, do not bake or roast.",
      "A knife, board, bowl, and spoon are available unless a note forbids them.",
      "Honor every note. 'no mixer' means do not ask for a mixer. 'with a mixer' means a mixer is welcome.",
      "minutes is a whole number no higher than the limit.",
      "onHand is true only for ingredients the person named.",
      "Steps: 3 to 6 short imperative sentences.",
      `honor should confirm the constraints. A starting point: ${constraintsSentence(input)}`,
    ].join("\n"),
    prompt: prompt(input, repair, avoidTitles),
  })

  const object = result.output
  if (!object) throw new Error("The model returned no recipe")

  return {
    title: object.title.trim(),
    summary: object.summary.trim(),
    minutes: Math.round(object.minutes),
    servings: input.servings,
    method: object.method.trim(),
    honor: object.honor.trim(),
    ingredients: object.ingredients.map((line) => ({
      item: line.item.trim(),
      amount: line.amount.trim(),
      onHand: line.onHand,
    })),
    steps: object.steps.map((step) => step.trim()),
    source: "llama",
  }
}
