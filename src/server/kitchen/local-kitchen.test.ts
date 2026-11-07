import assert from "node:assert/strict"
import { describe, it } from "node:test"

import type { GenerateInput } from "../../lib/kitchen"
import { constraintViolation } from "./guard"
import { composeLocalRecipe } from "./local-kitchen"
import { mentions } from "./text"

function input(overrides: Partial<GenerateInput> = {}): GenerateInput {
  return {
    ingredients: ["apples", "flour", "eggs", "sugar", "butter"],
    exclusions: [],
    notes: ["no mixer"],
    required: [],
    minutes: 60,
    servings: 4,
    heat: ["oven"],
    ...overrides,
  }
}

describe("mentions", () => {
  it("matches inflections without hitting unrelated words", () => {
    assert.equal(mentions("green apples", "apple"), true)
    assert.equal(mentions("apricot", "rice"), false)
    assert.equal(mentions("rice", "rices"), true)
    assert.equal(mentions("milk", "milks"), true)
  })
})

describe("local kitchen", () => {
  it("bakes a whisked apple cake inside the time limit", () => {
    const recipe = composeLocalRecipe(input())
    assert.match(recipe.title, /apple cake/i)
    assert.ok(recipe.minutes <= 60)
    assert.match(recipe.steps.join(" "), /whisk/i)
    assert.doesNotMatch(recipe.steps.join(" "), /with a mixer|use a mixer|turn on the mixer/i)
    assert.equal(constraintViolation(recipe, input()), null)
  })

  it("drops apples when they are excluded", () => {
    const request = input({ exclusions: ["apples"] })
    const recipe = composeLocalRecipe(request)
    assert.doesNotMatch(recipe.title, /apple/i)
    const blob = [recipe.title, recipe.summary, ...recipe.steps, ...recipe.ingredients.map((line) => line.item)].join("\n")
    assert.equal(mentions(blob, "apples"), false)
    assert.equal(constraintViolation(recipe, request), null)
  })

  it("keeps a fifteen-minute egg dish inside fifteen minutes", () => {
    const request = input({
      ingredients: ["eggs", "milk", "dill"],
      notes: [],
      minutes: 15,
      servings: 1,
      heat: ["stove"],
    })
    const recipe = composeLocalRecipe(request)
    assert.ok(recipe.minutes <= 15)
    assert.match(recipe.title, /omelet|egg/i)
    assert.equal(constraintViolation(recipe, request), null)
  })

  it("cooks oats on a stove", () => {
    const request = input({
      ingredients: ["oats", "milk"],
      notes: [],
      minutes: 20,
      servings: 1,
      heat: ["stove"],
    })
    const recipe = composeLocalRecipe(request)
    assert.match(recipe.title, /oats/i)
    assert.ok(recipe.minutes <= 20)
    assert.equal(constraintViolation(recipe, request), null)
  })

  it("leaves chicken on the shelf when the apples make a better cake", () => {
    const request = input({
      ingredients: ["apples", "flour", "eggs", "sugar", "butter", "chicken", "onion"],
      heat: ["stove", "oven"],
    })
    const recipe = composeLocalRecipe(request)
    assert.match(recipe.title, /apple cake/i)
    const used = recipe.ingredients.map((line) => line.item.toLowerCase())
    assert.equal(used.some((item) => item.includes("chicken")), false)
    assert.match(recipe.honor, /chicken/i)
    assert.equal(constraintViolation(recipe, request), null)
  })

  it("keeps a required avocado in the dish", () => {
    const request = input({
      ingredients: ["eggs", "cheese", "avocado", "oil"],
      notes: [],
      required: ["avocado"],
      minutes: 45,
      servings: 2,
      heat: ["stove"],
    })
    const recipe = composeLocalRecipe(request)
    assert.ok(recipe.ingredients.some((line) => /avocado/i.test(line.item)))
    assert.doesNotMatch(recipe.honor, /Left on the shelf:[^.]*avocado/i)
    assert.equal(constraintViolation(recipe, request), null)
  })

  it("bakes the fish with the olives and cooks the rice beside it", () => {
    const request = input({
      ingredients: ["cheese", "eggs", "fish", "olives", "rice"],
      notes: [],
      minutes: 60,
      servings: 2,
      heat: ["stove", "oven"],
    })
    const recipe = composeLocalRecipe(request)
    const blob = [recipe.title, recipe.summary, ...recipe.steps, ...recipe.ingredients.map((line) => line.item)].join("\n")
    assert.match(recipe.title, /fish/i)
    assert.match(blob, /bake|oven/i)
    for (const name of ["olives", "rice", "cheese", "eggs"]) {
      assert.equal(mentions(blob, name), true, name)
    }
    assert.doesNotMatch(recipe.honor, /Left on the shelf/i)
    assert.equal(constraintViolation(recipe, request), null)
  })

  it("cooks a mistyped rise as a simmered side", () => {
    const request = input({
      ingredients: ["avocado", "fish", "olives", "rise"],
      notes: [],
      required: ["rise"],
      minutes: 60,
      servings: 2,
      heat: ["stove", "oven"],
    })
    const recipe = composeLocalRecipe(request)
    const steps = recipe.steps.join(" ")
    assert.match(recipe.title, /rise/i)
    assert.match(steps, /simmer/i)
    assert.match(steps, /side/i)
    assert.doesNotMatch(steps, /slice the rise/i)
    assert.equal(constraintViolation(recipe, request), null)
  })

  it("pan-fries the fish and simmers the rice when the oven is off", () => {
    const request = input({
      ingredients: ["fish", "olives", "rice"],
      notes: [],
      minutes: 45,
      servings: 2,
      heat: ["stove"],
    })
    const recipe = composeLocalRecipe(request)
    const blob = [recipe.title, ...recipe.steps].join("\n")
    assert.match(blob, /rice/i)
    assert.doesNotMatch(blob, /bake|oven|roast/i)
    assert.equal(constraintViolation(recipe, request), null)
  })

  it("makes a different dish from the same shelf on the next press", () => {
    const request = input({
      ingredients: ["apples", "flour", "eggs", "sugar", "butter", "chicken"],
      heat: ["stove", "oven"],
    })
    const first = composeLocalRecipe(request)
    const second = composeLocalRecipe(request, [first.title])
    assert.match(first.title, /apple cake/i)
    assert.notEqual(second.title.toLowerCase(), first.title.toLowerCase())
    assert.equal(constraintViolation(second, request), null)

    const seen = [first.title]
    let latest = first
    for (let turn = 0; turn < 20; turn += 1) {
      latest = composeLocalRecipe(request, seen)
      if (latest.title.toLowerCase() === first.title.toLowerCase()) break
      seen.push(latest.title)
    }
    assert.equal(latest.title.toLowerCase(), first.title.toLowerCase())
    assert.ok(seen.length > 1)
  })

  it("prefers the dish that already uses a required ingredient", () => {
    const request = input({
      ingredients: ["apples", "flour", "eggs", "sugar", "butter", "chicken"],
      required: ["chicken"],
      minutes: 60,
      heat: ["stove", "oven"],
    })
    const recipe = composeLocalRecipe(request)
    assert.match(recipe.title, /chicken/i)
    assert.equal(constraintViolation(recipe, request), null)
  })
})
