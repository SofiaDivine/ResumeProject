import { constraintsSentence, type GenerateInput, type HeatId, type IngredientLine, type RecipeDraft } from "../../lib/kitchen"
import { dedupeNames, forbids, mentions, normalizeName, tagsFor } from "./text"

type Item = { name: string; tags: string[] }

type Ctx = {
  input: GenerateInput
  items: Item[]
  has: (tag: string) => Item | undefined
  heat: (id: HeatId) => boolean
  forbids: (thing: string) => boolean
  blocked: (name: string) => boolean
}

type Built = Omit<RecipeDraft, "source">

type Technique = {
  id: string
  heat: HeatId | "none"
  maxMinutes: number
  anchors: string[]
  match?: "all" | "any"
  whisk?: boolean
  ok?: (ctx: Ctx) => boolean
  weight: number | ((ctx: Ctx) => number)
  build: (ctx: Ctx) => Built
}

function context(input: GenerateInput): Ctx | null {
  const names = dedupeNames(input.ingredients).filter(
    (name) => !input.exclusions.some((exclusion) => mentions(name, exclusion)),
  )
  if (names.length === 0) return null
  const items = names.map((name) => ({ name, tags: tagsFor(name) }))
  return {
    input,
    items,
    has: (tag) => items.find((item) => item.tags.includes(tag)),
    heat: (id) => input.heat.includes(id) && !forbids(input.notes, id),
    forbids: (thing) => forbids(input.notes, thing),
    blocked: (name) => input.exclusions.some((exclusion) => mentions(name, exclusion)) || forbids(input.notes, name),
  }
}

function scale(baseForFour: number, servings: number): number {
  return (baseForFour / 4) * servings
}

function qty(value: number, unit: string): string {
  const rounded = Math.round(value * 10) / 10
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
  return `${text} ${unit}`
}

function count(servings: number, perFour: number): string {
  return String(Math.max(1, Math.round(scale(perFour, servings))))
}

function spoons(servings: number): string {
  if (servings <= 2) return "1 tbsp"
  if (servings <= 5) return "2 tbsp"
  return "3 tbsp"
}

function nameOf(ctx: Ctx, tag: string, fallback: string): string {
  return ctx.has(tag)?.name ?? fallback
}

function lead(name: string): string {
  return name.charAt(0).toLocaleUpperCase("en") + name.slice(1)
}

function line(item: string, amount: string, onHand: boolean): IngredientLine {
  return { item, amount, onHand }
}

function fromTag(ctx: Ctx, tag: string, amount: string, fallback: string): IngredientLine {
  const found = ctx.has(tag)
  return line(found?.name ?? fallback, amount, Boolean(found))
}

function staple(ctx: Ctx, item: string, amount: string, tag?: string): IngredientLine | null {
  if (ctx.blocked(item)) return null
  if (tag && ctx.has(tag)) return fromTag(ctx, tag, amount, item)
  const found = ctx.items.find((entry) => mentions(entry.name, item))
  return line(found?.name ?? item, amount, Boolean(found))
}

function pack(lines: Array<IngredientLine | null>): IngredientLine[] {
  const seen = new Set<string>()
  const result: IngredientLine[] = []
  for (const entry of lines) {
    if (!entry) continue
    const key = entry.item.toLocaleLowerCase("en")
    if (seen.has(key)) continue
    seen.add(key)
    result.push(entry)
  }
  return result
}

function countTags(ctx: Ctx, tags: string[]): number {
  return tags.filter((tag) => ctx.has(tag)).length
}

function firstOf(ctx: Ctx, tags: string[]): Item | undefined {
  for (const tag of tags) {
    const found = ctx.has(tag)
    if (found) return found
  }
  return undefined
}

function methodLabel(heat: HeatId | "none"): string {
  if (heat === "none") return "No heat"
  return heat === "stove" ? "Stove" : "Oven"
}

function whiskLine(ctx: Ctx, withWhisk: string, without: string): string {
  if (ctx.forbids("whisk")) return without
  if (ctx.forbids("mixer")) return withWhisk
  return withWhisk
}

function rate(technique: Technique, ctx: Ctx): number {
  if (technique.heat !== "none" && !ctx.heat(technique.heat)) return -1
  if (technique.whisk && ctx.forbids("whisk")) return -1
  if (technique.maxMinutes > ctx.input.minutes) return -1
  const hits = technique.anchors.filter((tag) => ctx.has(tag))
  if (technique.anchors.length > 0) {
    const enough = (technique.match ?? "all") === "all" ? hits.length === technique.anchors.length : hits.length > 0
    if (!enough) return -1
  }
  if (technique.ok && !technique.ok(ctx)) return -1
  const weight = typeof technique.weight === "function" ? technique.weight(ctx) : technique.weight
  return weight
}

const VEG = ["onion", "garlic", "tomato", "zucchini", "mushroom", "pepperveg", "carrot", "cabbage", "spinach", "potato"]
const SOUP = ["potato", "carrot", "onion", "chicken", "legume", "buckwheat", "rice", "mushroom"]
const SALAD = ["cucumber", "tomato", "cabbage", "herb", "avocado", "pepperveg", "spinach"]

const TECHNIQUES: Technique[] = [
  {
    id: "apple-cake",
    heat: "oven",
    whisk: true,
    maxMinutes: 55,
    anchors: ["apple", "flour", "egg"],
    weight: 40,
    ok: (ctx) => !ctx.blocked("sugar"),
    build: (ctx) => {
      const servings = ctx.input.servings
      const bake = ctx.input.minutes >= 55 ? 35 : 25
      return {
        title: "Whisked apple cake",
        summary: "Apples from the shelf and a batter lifted with a whisk. The other things on the shelf can wait.",
        minutes: Math.min(ctx.input.minutes, 15 + bake),
        servings,
        method: methodLabel("oven"),
        honor: constraintsSentence(ctx.input, whiskLine(ctx, "The batter is whisked, not machine-beaten.", "The batter is stirred with a spoon.")),
        ingredients: pack([
          fromTag(ctx, "apple", servings <= 2 ? "2" : count(servings, 3), "apples"),
          fromTag(ctx, "egg", count(servings, 3), "eggs"),
          fromTag(ctx, "flour", qty(scale(160, servings), "g"), "flour"),
          staple(ctx, "sugar", qty(scale(120, servings), "g"), "sugar"),
          staple(ctx, "butter", "for the tin", "butter"),
          staple(ctx, "salt", "a pinch"),
          ctx.has("cinnamon") ? fromTag(ctx, "cinnamon", "a pinch", "cinnamon") : null,
        ]),
        steps: [
          "Heat the oven to 180°C. Butter the tin if butter is allowed, and dust it with a spoon of flour.",
          whiskLine(
            ctx,
            "Whisk the eggs and sugar for 4–5 minutes, until the mixture turns pale and falls in a ribbon.",
            "Stir the eggs and sugar with a spoon until they lighten. It will not be as airy, and that is fine.",
          ),
          "Add the flour in two goes and fold it in briefly, from the bottom up.",
          `${lead(nameOf(ctx, "apple", "Apples"))}: cut into wedges, lay them in the tin, and pour the batter over.`,
          `Bake about ${bake} minutes, until a skewer comes out clean. Leave the cake in the tin for 8 minutes.`,
        ],
      }
    },
  },
  {
    id: "sponge",
    heat: "oven",
    whisk: true,
    maxMinutes: 50,
    anchors: ["flour", "egg"],
    weight: 16,
    ok: (ctx) => !ctx.blocked("sugar") && !ctx.has("apple"),
    build: (ctx) => {
      const servings = ctx.input.servings
      return {
        title: "Whisked sponge",
        summary: "Eggs, sugar, and flour. A plain cake, and the rest of the shelf stays where it is.",
        minutes: Math.min(ctx.input.minutes, 45),
        servings,
        method: methodLabel("oven"),
        honor: constraintsSentence(ctx.input),
        ingredients: pack([
          fromTag(ctx, "egg", count(servings, 3), "eggs"),
          fromTag(ctx, "flour", qty(scale(140, servings), "g"), "flour"),
          staple(ctx, "sugar", qty(scale(110, servings), "g"), "sugar"),
          staple(ctx, "salt", "a pinch"),
          staple(ctx, "butter", "for the tin", "butter"),
        ]),
        steps: [
          "Heat the oven to 175°C. Butter the tin or line it with paper.",
          whiskLine(ctx, "Whisk the eggs and sugar until pale and thick, about 5–7 minutes.", "Stir the eggs and sugar until they loosen."),
          "Sift in the flour with a pinch of salt and fold it through in a few strokes.",
          "Pour into the tin and bake 25–30 minutes. The top should spring back.",
          "Cool in the tin. Warm sponge crumbles; cool sponge slices cleanly.",
        ],
      }
    },
  },
  {
    id: "kefir-cake",
    heat: "oven",
    whisk: true,
    maxMinutes: 55,
    anchors: ["kefir", "flour", "egg"],
    weight: 24,
    ok: (ctx) => !ctx.blocked("sugar"),
    build: (ctx) => {
      const servings = ctx.input.servings
      return {
        title: "Kefir cake",
        summary: "Kefir does the lifting. A whisk only brings the batter together.",
        minutes: Math.min(ctx.input.minutes, 50),
        servings,
        method: methodLabel("oven"),
        honor: constraintsSentence(ctx.input),
        ingredients: pack([
          fromTag(ctx, "kefir", qty(scale(300, servings), "ml"), "kefir"),
          fromTag(ctx, "flour", qty(scale(220, servings), "g"), "flour"),
          fromTag(ctx, "egg", count(servings, 2), "eggs"),
          staple(ctx, "sugar", qty(scale(100, servings), "g"), "sugar"),
          staple(ctx, "oil", spoons(servings), "oil"),
          staple(ctx, "baking soda", "1/2 tsp"),
          staple(ctx, "salt", "a pinch"),
        ]),
        steps: [
          "Heat the oven to 180°C.",
          "Whisk the kefir, eggs, sugar, and oil. Stir the soda into the kefir so the acid wakes it up.",
          "Add the flour and whisk just until the lumps go. Stop there.",
          "Bake 30–35 minutes, until a skewer comes out clean.",
        ],
      }
    },
  },
  {
    id: "cheese-pancakes",
    heat: "stove",
    maxMinutes: 30,
    anchors: ["curd", "egg"],
    weight: 36,
    build: (ctx) => {
      const servings = ctx.input.servings
      return {
        title: "Pan-fried cheese pancakes",
        summary: "Farmer's cheese, an egg, and a little flour. Anything else on the shelf is not invited.",
        minutes: Math.min(ctx.input.minutes, 25),
        servings,
        method: methodLabel("stove"),
        honor: constraintsSentence(ctx.input),
        ingredients: pack([
          fromTag(ctx, "curd", qty(scale(400, servings), "g"), "farmer's cheese"),
          fromTag(ctx, "egg", count(servings, 1), "egg"),
          staple(ctx, "flour", qty(scale(40, servings), "g"), "flour"),
          staple(ctx, "sugar", servings <= 2 ? "1 tbsp" : "2 tbsp", "sugar"),
          staple(ctx, "salt", "a pinch"),
          staple(ctx, "oil", spoons(servings), "oil"),
        ]),
        steps: [
          "Mash the cheese with a fork so the curds break up.",
          whiskLine(ctx, "Mix in the egg, sugar, salt, and flour with a whisk or a spoon. Stop before it turns gluey.", "Mix in the egg, sugar, salt, and flour with a spoon."),
          "Shape small cakes with damp hands.",
          "Fry in a little oil over medium heat, 3–4 minutes a side.",
          "Let them sit a minute on the plate. The centers finish in their own heat.",
        ],
      }
    },
  },
  {
    id: "pancakes",
    heat: "stove",
    whisk: true,
    maxMinutes: 30,
    anchors: ["flour", "egg"],
    weight: 30,
    ok: (ctx) => {
      const milk = Boolean(ctx.has("milk"))
      const kefir = Boolean(ctx.has("kefir"))
      if (!milk && !kefir) return false
      if (ctx.blocked("milk") && !kefir) return false
      if (ctx.blocked("kefir") && !milk) return false
      return true
    },
    build: (ctx) => {
      const servings = ctx.input.servings
      const liquid = ctx.has("kefir") && (ctx.blocked("milk") || !ctx.has("milk")) ? "kefir" : "milk"
      const liquidName = liquid === "kefir" ? "kefir" : "milk"
      return {
        title: liquid === "kefir" ? "Kefir pancakes" : "Whisked pancakes",
        summary: "A thin batter and a hot pan. The first pancake is for testing the heat.",
        minutes: Math.min(ctx.input.minutes, 30),
        servings,
        method: methodLabel("stove"),
        honor: constraintsSentence(ctx.input),
        ingredients: pack([
          fromTag(ctx, "flour", qty(scale(200, servings), "g"), "flour"),
          fromTag(ctx, liquid, qty(scale(400, servings), "ml"), liquidName),
          fromTag(ctx, "egg", count(servings, 2), "eggs"),
          staple(ctx, "sugar", "1 tbsp", "sugar"),
          staple(ctx, "salt", "a pinch"),
          staple(ctx, "oil", "1 tbsp in the batter, a little for the pan", "oil"),
        ]),
        steps: [
          "Whisk some of the liquid into the flour until the lumps go, then add the rest, the eggs, and a spoon of oil.",
          "The batter should pour in a ribbon. If it sits in a mound, add another splash of liquid.",
          "Heat the pan, film it with oil, and pour in a ladle while you tilt.",
          "When the edges dry and the underside colors, flip. The second side takes less than a minute.",
        ],
      }
    },
  },
  {
    id: "banana-pancakes",
    heat: "stove",
    maxMinutes: 20,
    anchors: ["banana", "egg"],
    weight: 20,
    build: (ctx) => ({
      title: "Banana pancakes",
      summary: "Banana and egg. Flour is optional, and the rest of the shelf is not required.",
      minutes: Math.min(ctx.input.minutes, 15),
      servings: ctx.input.servings,
      method: methodLabel("stove"),
      honor: constraintsSentence(ctx.input),
      ingredients: pack([
        fromTag(ctx, "banana", count(ctx.input.servings, 2), "banana"),
        fromTag(ctx, "egg", count(ctx.input.servings, 2), "eggs"),
        staple(ctx, "oil", "for the pan", "oil"),
      ]),
      steps: [
        "Mash the banana and mix in the egg until the lumps are small.",
        "Drop spoonfuls onto a warm pan. Cook 1–2 minutes a side, until they set.",
        "Eat them at once. They firm up as they cool.",
      ],
    }),
  },
  {
    id: "omelet",
    heat: "stove",
    whisk: true,
    maxMinutes: 15,
    anchors: ["egg"],
    weight: 26,
    build: (ctx) => {
      const servings = ctx.input.servings
      const extra = firstOf(ctx, ["cheese", "herb", "spinach"])
      return {
        title: extra ? "Omelet with one extra" : "Whisked omelet",
        summary: extra
          ? `Eggs, and ${extra.name}. The rest of the shelf would only crowd the pan.`
          : "Eggs whisked until even, not foamy. A hot pan and a medium flame.",
        minutes: Math.min(ctx.input.minutes, 12),
        servings,
        method: methodLabel("stove"),
        honor: constraintsSentence(ctx.input),
        ingredients: pack([
          fromTag(ctx, "egg", count(servings, 4), "eggs"),
          ctx.has("milk") && !ctx.blocked("milk") ? fromTag(ctx, "milk", qty(scale(60, servings), "ml"), "milk") : null,
          extra ? line(extra.name, "a handful", true) : null,
          staple(ctx, "salt", "a pinch"),
          staple(ctx, "oil", "1 tsp", "oil"),
        ]),
        steps: [
          "Whisk the eggs with salt until the color is even. Add a spoon of milk only if you have it and it is allowed.",
          extra ? `Prepare the ${extra.name}: slice anything firm, tear anything leafy.` : "Heat the pan while the eggs are whisked.",
          "Pour the eggs into the oiled pan. Pull the set edges toward the center and tilt so the raw egg runs out.",
          "Fold it while the center is still a little glossy, and take it off the heat.",
        ],
      }
    },
  },
  {
    id: "shakshuka",
    heat: "stove",
    maxMinutes: 30,
    anchors: ["egg", "tomato"],
    weight: 34,
    build: (ctx) => {
      const servings = ctx.input.servings
      const onion = ctx.has("onion")
      return {
        title: "One-pan shakshuka",
        summary: "Tomatoes become the sauce and the eggs finish under a lid. Other ingredients can stay in the bowl.",
        minutes: Math.min(ctx.input.minutes, 30),
        servings,
        method: methodLabel("stove"),
        honor: constraintsSentence(ctx.input),
        ingredients: pack([
          fromTag(ctx, "tomato", qty(scale(400, servings), "g"), "tomatoes"),
          fromTag(ctx, "egg", count(servings, 4), "eggs"),
          onion ? fromTag(ctx, "onion", "1", "onion") : null,
          ctx.has("garlic") ? fromTag(ctx, "garlic", "1 clove", "garlic") : null,
          staple(ctx, "oil", spoons(servings), "oil"),
          staple(ctx, "salt", "to taste"),
        ]),
        steps: [
          "Chop the tomatoes. Chop the onion too, if you are using it.",
          "Warm the oil, soften the onion for 4 minutes if it is there, then add the tomatoes.",
          "Simmer the sauce 8–10 minutes, until it thickens. Salt it.",
          "Make wells and crack in the eggs. Cover for 4–5 minutes, until the whites set and the yolks stay soft.",
        ],
      }
    },
  },
  {
    id: "oats",
    heat: "stove",
    maxMinutes: 20,
    anchors: ["oat"],
    weight: 22,
    build: (ctx) => {
      const servings = ctx.input.servings
      const milk = Boolean(ctx.has("milk") && !ctx.blocked("milk"))
      return {
        title: milk ? "Oats with milk" : "Oats with water",
        summary: "A pot of porridge. Fruit can go in the bowl at the end, and savory leftovers stay out.",
        minutes: Math.min(ctx.input.minutes, 15),
        servings,
        method: methodLabel("stove"),
        honor: constraintsSentence(ctx.input),
        ingredients: pack([
          fromTag(ctx, "oat", qty(scale(160, servings), "g"), "oats"),
          milk ? fromTag(ctx, "milk", qty(scale(500, servings), "ml"), "milk") : staple(ctx, "water", qty(scale(500, servings), "ml")),
          ctx.has("banana") ? fromTag(ctx, "banana", "1", "banana") : null,
          ctx.has("honey") && !ctx.blocked("honey") ? fromTag(ctx, "honey", "1 tsp", "honey") : null,
          staple(ctx, "salt", "a pinch"),
        ]),
        steps: [
          milk ? "Bring the milk almost to a boil and stir in the oats." : "Boil the water, salt it, and stir in the oats.",
          "Cook 5–7 minutes over low heat, stirring near the end so the bottom does not catch.",
          "Cover and wait 2 minutes. Add banana or honey in the bowl, if you kept them.",
        ],
      }
    },
  },
  {
    id: "grain",
    heat: "stove",
    maxMinutes: 30,
    anchors: ["buckwheat", "rice"],
    match: "any",
    weight: 18,
    build: (ctx) => {
      const tag = ctx.has("buckwheat") ? "buckwheat" : "rice"
      const grain = tag === "buckwheat" ? "Buckwheat" : "Rice"
      const cook = tag === "buckwheat" ? 18 : 15
      const servings = ctx.input.servings
      return {
        title: ctx.has("onion") ? `${grain} with onion` : `${grain}, separate grains`,
        summary: `${grain} cooked in a measured amount of water. It does not need the rest of the shelf.`,
        minutes: Math.min(ctx.input.minutes, cook + 5),
        servings,
        method: methodLabel("stove"),
        honor: constraintsSentence(ctx.input),
        ingredients: pack([
          fromTag(ctx, tag, qty(scale(200, servings), "g"), grain.toLowerCase()),
          staple(ctx, "water", qty(scale(400, servings), "ml")),
          staple(ctx, "salt", "1/2 tsp"),
          staple(ctx, "oil", "1 tbsp", "oil"),
          ctx.has("onion") ? fromTag(ctx, "onion", "1", "onion") : null,
        ]),
        steps: [
          "Rinse the grain. Salt the water and bring it to a boil.",
          `Add the grain and the oil, cover, and cook ${cook} minutes on low. Leave the lid on.`,
          "Turn off the heat and wait 5 minutes. Fluff with a fork.",
          ctx.has("onion") ? "Chop the onion and fold it through the hot grain." : "Taste the salt in the bowl.",
        ],
      }
    },
  },
  {
    id: "pasta",
    heat: "stove",
    maxMinutes: 25,
    anchors: ["pasta"],
    weight: 30,
    build: (ctx) => {
      const servings = ctx.input.servings
      const sauce = ctx.has("tomato") ? "tomato" : ctx.has("cheese") ? "cheese" : ctx.has("butter") ? "butter" : null
      return {
        title: sauce === "tomato" ? "Pasta with tomatoes" : sauce === "cheese" ? "Pasta with cheese" : "Pasta from the shelf",
        summary: "Pasta, salt, and at most one thing to dress it. A second sauce ingredient would be a different recipe.",
        minutes: Math.min(ctx.input.minutes, sauce ? 25 : 15),
        servings,
        method: methodLabel("stove"),
        honor: constraintsSentence(ctx.input),
        ingredients: pack([
          fromTag(ctx, "pasta", qty(scale(320, servings), "g"), "pasta"),
          staple(ctx, "salt", "for the water"),
          sauce === "tomato" ? fromTag(ctx, "tomato", qty(scale(300, servings), "g"), "tomatoes") : null,
          sauce === "cheese" ? fromTag(ctx, "cheese", qty(scale(60, servings), "g"), "cheese") : null,
          sauce === "butter" ? fromTag(ctx, "butter", qty(scale(30, servings), "g"), "butter") : null,
          ctx.has("garlic") && sauce ? fromTag(ctx, "garlic", "1 clove", "garlic") : null,
          staple(ctx, "oil", spoons(servings), "oil"),
        ]),
        steps: [
          "Boil a large pot of well-salted water. Cook the pasta until it still has a bite.",
          sauce
            ? "While it cooks, warm oil with the garlic if you have it, then add the tomatoes, cheese, or butter for a minute."
            : "Before draining, save a ladle of the pasta water.",
          "Toss the pasta with the dressing, or with oil and a spoon of pasta water, so it shines instead of clumping.",
          sauce === "cheese" ? "Take the pan off the heat before the cheese goes in, or it will seize." : "Taste the salt and eat it now.",
        ],
      }
    },
  },
  {
    id: "potato",
    heat: "stove",
    maxMinutes: 40,
    anchors: ["potato"],
    weight: 22,
    build: (ctx) => {
      const servings = ctx.input.servings
      const mash = !ctx.forbids("whisk")
      return {
        title: mash ? "Potatoes mashed with a whisk" : "Boiled potatoes",
        summary: "Potatoes, and that is the dish. A whisk keeps the mash from turning to glue.",
        minutes: Math.min(ctx.input.minutes, mash ? 35 : 30),
        servings,
        method: methodLabel("stove"),
        honor: constraintsSentence(ctx.input, mash && ctx.forbids("mixer") ? "Mashed with a whisk, which keeps it from going gluey." : undefined),
        ingredients: pack([
          fromTag(ctx, "potato", qty(scale(800, servings), "g"), "potatoes"),
          ctx.has("milk") && !ctx.blocked("milk") && mash ? fromTag(ctx, "milk", qty(scale(120, servings), "ml"), "milk") : null,
          ctx.has("butter") && mash ? fromTag(ctx, "butter", qty(scale(30, servings), "g"), "butter") : null,
          staple(ctx, "salt", "to taste"),
        ]),
        steps: [
          "Peel the potatoes and cut them into even pieces.",
          "Cover with cold water, bring to a boil, and cook 15–20 minutes, until a knife meets no resistance.",
          "Salt them 5 minutes before they are done.",
          mash
            ? "Drain, leaving a spoon of water. Mash with a whisk, adding warm milk if you have it. Do not keep beating."
            : "Drain and let the steam leave for a minute.",
        ],
      }
    },
  },
  {
    id: "chicken",
    heat: "stove",
    maxMinutes: 30,
    anchors: ["chicken"],
    weight: 32,
    build: (ctx) => {
      const servings = ctx.input.servings
      const company = firstOf(ctx, ["onion", "garlic", "mushroom"])
      return {
        title: company ? "Skillet chicken" : "Salted skillet chicken",
        summary: company
          ? `Chicken and ${company.name}. The pan has room for one companion, not the whole shelf.`
          : "Dry chicken, a hot pan, and salt. Vegetables can be another meal.",
        minutes: Math.min(ctx.input.minutes, 30),
        servings,
        method: methodLabel("stove"),
        honor: constraintsSentence(ctx.input),
        ingredients: pack([
          fromTag(ctx, "chicken", qty(scale(500, servings), "g"), "chicken"),
          company ? line(company.name, "1", true) : null,
          staple(ctx, "oil", spoons(servings), "oil"),
          staple(ctx, "salt", "to taste"),
        ]),
        steps: [
          "Pat the chicken dry and salt it. A wet surface will not brown.",
          "Heat the oil until it shimmers. Lay the chicken in and leave it alone for 4–5 minutes.",
          company
            ? `Turn it. Push it to the side and soften the ${company.name} for 5 minutes.`
            : "Turn it and cook the second side until the thickest part is no longer pink.",
          "Rest it off the heat for a few minutes before you cut.",
        ],
      }
    },
  },
  {
    id: "fish",
    heat: "stove",
    maxMinutes: 25,
    anchors: ["fish"],
    weight: 28,
    build: (ctx) => ({
      title: ctx.has("lemon") ? "Fish with lemon" : "Pan-fried fish",
      summary: "Fish wants a hot pan and one flip. Lemon is welcome. A pile of other ingredients is not.",
      minutes: Math.min(ctx.input.minutes, 20),
      servings: ctx.input.servings,
      method: methodLabel("stove"),
      honor: constraintsSentence(ctx.input),
      ingredients: pack([
        fromTag(ctx, "fish", qty(scale(480, ctx.input.servings), "g"), "fish"),
        ctx.has("lemon") ? fromTag(ctx, "lemon", "a few wedges", "lemon") : null,
        staple(ctx, "oil", "1 tbsp", "oil"),
        staple(ctx, "salt", "a pinch"),
      ]),
      steps: [
        "Dry the fish and salt both sides.",
        "Lay it in a hot oiled pan and do not move it for 3–4 minutes.",
        "Flip once and give it 2–3 minutes more. It should flake.",
        ctx.has("lemon") ? "Squeeze the lemon over the plated fish, not into the hot pan." : "Serve it straight away.",
      ],
    }),
  },
  {
    id: "soup",
    heat: "stove",
    maxMinutes: 50,
    anchors: SOUP,
    match: "any",
    weight: 12,
    ok: (ctx) => countTags(ctx, SOUP) >= 2 && !ctx.has("egg") && !ctx.has("apple") && !ctx.has("flour"),
    build: (ctx) => {
      const names = ctx.items.filter((item) => item.tags.some((tag) => SOUP.includes(tag))).map((item) => item.name)
      return {
        title: "One-pot soup",
        summary: `A plain soup from ${names.join(", ")}. Nothing is blended.`,
        minutes: Math.min(ctx.input.minutes, 45),
        servings: ctx.input.servings,
        method: methodLabel("stove"),
        honor: constraintsSentence(ctx.input, ctx.forbids("blender") ? "Cut, not blended." : undefined),
        ingredients: pack([
          ...names.map((name) => line(name, "a handful", true)),
          staple(ctx, "water", qty(scale(1200, ctx.input.servings), "ml")),
          staple(ctx, "salt", "to taste"),
        ]),
        steps: [
          "Cut the firm pieces so they are close to the same size.",
          "Cover with cold water. If there is chicken, simmer it 15 minutes and skim the foam.",
          "Add the vegetables or grain so they have 15–20 minutes.",
          "Salt at the end.",
        ],
      }
    },
  },
  {
    id: "saute",
    heat: "stove",
    maxMinutes: 30,
    anchors: VEG,
    match: "any",
    weight: 10,
    ok: (ctx) => countTags(ctx, VEG) >= 2 && !ctx.has("egg") && !ctx.has("chicken") && !ctx.has("fish") && !ctx.has("flour"),
    build: (ctx) => {
      const names = ctx.items.filter((item) => item.tags.some((tag) => VEG.includes(tag))).slice(0, 4).map((item) => item.name)
      return {
        title: "Vegetable sauté",
        summary: `${names.join(", ")} in one pan. Firm pieces go in first.`,
        minutes: Math.min(ctx.input.minutes, 25),
        servings: ctx.input.servings,
        method: methodLabel("stove"),
        honor: constraintsSentence(ctx.input),
        ingredients: pack([
          ...names.map((name) => line(name, "1 or 2", true)),
          staple(ctx, "oil", spoons(ctx.input.servings), "oil"),
          staple(ctx, "salt", "to taste"),
        ]),
        steps: [
          "Cut the vegetables. Potatoes and carrots smaller than tomatoes or zucchini.",
          "Heat the oil. Start with the firm pieces and cook 7–8 minutes, stirring.",
          "Add the softer ones and cook another 6–8 minutes. They should be tender, not a mash.",
          "Salt at the end and let the extra water cook off for a minute.",
        ],
      }
    },
  },
  {
    id: "salad",
    heat: "none",
    maxMinutes: 15,
    anchors: SALAD,
    match: "any",
    weight: (ctx) => (ctx.input.minutes <= 20 ? 20 : 8),
    ok: (ctx) => countTags(ctx, SALAD) >= 2,
    build: (ctx) => {
      const names = ctx.items
        .filter((item) => item.tags.some((tag) => SALAD.includes(tag)))
        .slice(0, 4)
        .map((item) => item.name)
      return {
        title: "A plate, no stove",
        summary: "When the clock is short, a knife is enough. A few vegetables, salt, and oil.",
        minutes: Math.min(ctx.input.minutes, 12),
        servings: ctx.input.servings,
        method: methodLabel("none"),
        honor: constraintsSentence(ctx.input),
        ingredients: pack([
          ...names.map((name) => line(name, "a handful", true)),
          staple(ctx, "oil", "1 tbsp", "oil"),
          staple(ctx, "salt", "a pinch"),
          ctx.has("lemon") ? fromTag(ctx, "lemon", "a squeeze", "lemon") : null,
        ]),
        steps: [
          "Rinse what grew above ground. Cut it in large pieces so it does not weep too soon.",
          "Put it in a bowl. Stir the oil, salt, and lemon, if you have it, in a cup first.",
          "Dress it just before you sit down.",
        ],
      }
    },
  },
  {
    id: "baked-apples",
    heat: "oven",
    maxMinutes: 30,
    anchors: ["apple"],
    weight: 14,
    build: (ctx) => ({
      title: "Baked apples",
      summary: "When there is no time, or no flour, for a cake. The apples bake as halves.",
      minutes: Math.min(ctx.input.minutes, 25),
      servings: ctx.input.servings,
      method: methodLabel("oven"),
      honor: constraintsSentence(ctx.input),
      ingredients: pack([
        fromTag(ctx, "apple", String(Math.max(2, ctx.input.servings)), "apples"),
        !ctx.blocked("sugar") ? staple(ctx, "sugar", "1 tbsp", "sugar") : null,
        ctx.has("cinnamon") ? fromTag(ctx, "cinnamon", "a pinch", "cinnamon") : null,
        ctx.has("butter") && !ctx.blocked("butter") ? fromTag(ctx, "butter", "a small piece", "butter") : null,
      ]),
      steps: [
        "Heat the oven to 190°C.",
        "Halve the apples and cut out the cores.",
        "Set them cut side up. Sugar, cinnamon, and butter only if they are allowed and on hand.",
        "Bake 18–20 minutes, until a knife finds soft flesh.",
      ],
    }),
  },
]

function recipeText(built: Built): string {
  return [built.title, built.summary, ...built.steps, ...built.ingredients.map((line) => line.item)].join("\n")
}

function usesName(built: Built, name: string): boolean {
  return mentions(recipeText(built), name)
}

function requiredItems(ctx: Ctx): Item[] {
  return ctx.items.filter((item) => ctx.input.required.some((name) => mentions(item.name, name) || mentions(name, item.name)))
}

function coverCount(built: Built, items: Item[]): number {
  return items.filter((item) => usesName(built, item.name)).length
}

const GRAINS = ["rice", "bulgur", "pasta", "buckwheat", "oat"]
const SLICED = ["avocado", "olive", "tomato", "onion", "cheese", "cucumber", "lemon", "apple", "banana", "zucchini", "pepperveg"]
const STIRRED = ["milk", "oil", "flour", "sugar", "honey", "butter", "cream", "kefir", "yogurt", "sourcream"]

function hasTag(item: Item, tags: string[]): boolean {
  return item.tags.some((tag) => tags.includes(tag))
}

function foldStep(item: Item): string {
  const name = item.name
  if (hasTag(item, GRAINS)) return `Rinse the ${name} and simmer it in salted water until tender. Serve it as the side, in its own bowl.`
  if (hasTag(item, ["potato"])) return `Cut the ${name} into pieces and simmer them until tender. Serve them beside the main.`
  if (hasTag(item, ["egg"])) return `Fry the ${name} and set it on the plate.`
  if (hasTag(item, STIRRED)) return `Stir the ${name} into the dish. Leave it out of any slicing.`
  if (hasTag(item, SLICED)) return `Slice the ${name} and add it to the plate.`
  return `Cook the ${name} and serve it with the dish.`
}

function foldNote(item: Item): string {
  if (hasTag(item, GRAINS) || hasTag(item, ["potato"])) return `${lead(item.name)} is simmered as the side.`
  return `${lead(item.name)} is in the dish.`
}

function foldRequired(built: Built, items: Item[]): Built {
  const missing = items.filter((item) => !usesName(built, item.name))
  if (missing.length === 0) return built
  return {
    ...built,
    summary: `${built.summary.replace(/\.$/, "")}. ${missing.map(foldNote).join(" ")}`,
    ingredients: pack([
      ...built.ingredients,
      ...missing.map((item) => line(item.name, hasTag(item, GRAINS) ? "a small pot" : "enough for the plate", true)),
    ]),
    steps: [...built.steps, ...missing.map(foldStep)],
  }
}

function annotate(ctx: Ctx, built: Built): Built {
  const used = new Set(built.ingredients.filter((item) => item.onHand).map((item) => normalizeName(item.item)))
  const left = ctx.items.filter((item) => !used.has(normalizeName(item.name)))
  if (left.length === 0) return built
  return {
    ...built,
    honor: `${built.honor} Left on the shelf: ${left.map((item) => item.name).join(", ")}.`,
  }
}

function fallback(ctx: Ctx): Built {
  const focus = ctx.items.slice(0, 3)
  const names = focus.map((item) => item.name)
  const list = names.join(", ")
  let title = "A small plate"
  let heat: HeatId | "none" = "none"
  let steps: string[]
  let minutes = Math.min(ctx.input.minutes, 12)

  if (ctx.heat("stove") && ctx.has("egg") && ctx.input.minutes >= 12) {
    heat = "stove"
    title = "Eggs, and little else"
    minutes = Math.min(ctx.input.minutes, 12)
    steps = [
      "Whisk the eggs with a pinch of salt until the color is even.",
      names.length > 1 ? `Keep the company to ${list}. Anything else waits.` : "Pour them into a warm oiled pan.",
      "Cook over medium heat, pulling the set parts aside, for 2–3 minutes.",
    ]
  } else if (ctx.heat("stove") && ctx.input.minutes >= 12) {
    heat = "stove"
    title = "A small skillet"
    minutes = Math.min(ctx.input.minutes, 20)
    steps = [
      `${lead(list)}: cut what needs cutting, and leave the rest of the shelf alone.`,
      "Heat a pan. Add a spoon of oil if oil is allowed.",
      `Cook ${Math.max(6, minutes - 6)} minutes over medium heat, firm pieces first.`,
      "Salt at the end.",
    ]
  } else if (ctx.heat("oven") && ctx.input.minutes >= 20) {
    heat = "oven"
    title = "A small tray"
    minutes = Math.min(ctx.input.minutes, 30)
    steps = [
      "Heat the oven to 200°C.",
      `${lead(list)}: dry it, cut it into even pieces, and leave anything else out.`,
      "Spread it in one layer. Oil and salt if they are allowed.",
      `Roast ${Math.max(12, minutes - 8)} minutes and turn once.`,
    ]
  } else {
    steps = [
      `${lead(list)}: rinse and cut into pieces you can eat.`,
      "Put that on a plate. Salt and oil only if they are not excluded.",
      "This is a plate, not a composed dish. The heat you allowed does not cover a longer cook.",
    ]
  }

  return {
    title,
    summary: `A short dish from ${list}. The point is a good plate, not an empty shelf.`,
    minutes,
    servings: ctx.input.servings,
    method: methodLabel(heat),
    honor: constraintsSentence(ctx.input),
    ingredients: pack([...focus.map((item) => line(item.name, "as much as you want to cook", true)), staple(ctx, "salt", "to taste"), staple(ctx, "oil", "1 tbsp", "oil")]),
    steps,
  }
}

const SIDE_TAGS = ["rice", "bulgur", "pasta", "buckwheat", "potato"]
const WITH_MAIN = ["olive", "lemon", "onion", "garlic", "tomato", "herb", "cheese", "spinach", "avocado", "mushroom"]

function shelfUsed(ctx: Ctx, built: Built): number {
  return ctx.items.filter((item) => usesName(built, item.name)).length
}

function buildSavoryPlate(ctx: Ctx): Built | null {
  const fish = ctx.has("fish")
  const chicken = ctx.has("chicken")
  const main = fish ?? chicken ?? ctx.has("mince")
  if (!main) return null
  const stove = ctx.heat("stove")
  const oven = ctx.heat("oven")
  if (!stove && !oven) return null
  if (ctx.input.minutes < 25) return null

  const side = ctx.input.minutes >= 30 ? firstOf(ctx, SIDE_TAGS) : undefined
  const company = WITH_MAIN.map((tag) => ctx.has(tag)).filter((item): item is Item => Boolean(item))
  const eggs = ctx.has("egg")
  if (!side && company.length === 0 && !eggs) return null

  const bake = oven && ctx.input.minutes >= 35
  if (!bake && !stove) return null
  const olive = company.find((item) => item.tags.includes("olive"))
  const feature = olive ?? company.find((item) => item !== eggs)
  const mainWord = fish ? "fish" : chicken ? "chicken" : main.name
  const cooked = bake ? `Baked ${mainWord}` : fish ? "Pan-fried fish" : chicken ? "Skillet chicken" : lead(main.name)
  const title = [cooked, feature ? `with ${feature.name}` : "", side ? `and ${side.name}` : ""].filter(Boolean).join(" ")
  const cheese = company.find((item) => item.tags.includes("cheese"))
  const scatter = [olive, cheese].filter((item): item is Item => Boolean(item))
  const minutes = Math.min(ctx.input.minutes, side ? 40 : 30)
  const servings = ctx.input.servings

  const steps: string[] = []
  if (bake) steps.push("Heat the oven to 200°C.")
  if (side && stove) {
    steps.push(`For the side, rinse the ${side.name} and simmer it in its own pot of salted water until tender. Keep it off the ${mainWord}.`)
  } else if (side && bake) {
    steps.push(`For the side, put the ${side.name} in a covered dish with twice its volume of water and bake it beside the ${mainWord}.`)
  }

  if (bake) {
    const topping = scatter.length > 0 ? ` Scatter the ${scatter.map((item) => item.name).join(" and ")} over it.` : ""
    steps.push(`Lay the ${main.name} in an oven dish.${topping} Oil the top.`)
    steps.push(`Bake about 18 minutes, until the ${mainWord} is cooked through.`)
  } else {
    const withPan = olive ? ` Add the ${olive.name} once the first side has colored.` : ""
    steps.push(`Heat a pan with a little oil. Lay in the ${main.name} and leave it for 4 minutes.${withPan}`)
    const cheeseLine = cheese ? ` Lay the ${cheese.name} over it.` : ""
    steps.push(`Turn the ${mainWord}.${cheeseLine} Give it another 3–4 minutes.`)
  }

  if (eggs && stove) {
    steps.push(`Fry the ${eggs.name} in the last few minutes and set ${ctx.input.servings > 2 ? "them" : "it"} on the plate.`)
  } else if (eggs && bake) {
    steps.push(`Crack the ${eggs.name} into a small cup of the oven dish for the last 8 minutes.`)
  }

  const beside = company.filter((item) => !scatter.includes(item))
  if (beside.length > 0) {
    const besideNames = beside.map((item) => item.name)
    const besideLabel = besideNames.length === 1 ? besideNames[0] : besideNames.join(" and ")
    steps.push(`Slice the ${besideLabel} and set ${besideNames.length > 1 ? "them" : "it"} beside the ${mainWord}.`)
  }

  const plated = [
    main.name,
    ...scatter.map((item) => item.name),
    ...beside.map((item) => item.name),
    side?.name,
    eggs && !scatter.includes(eggs) ? eggs.name : undefined,
  ].filter((name): name is string => Boolean(name))
  const platedLine =
    plated.length <= 1 ? plated[0] : plated.length === 2 ? `${plated[0]} and ${plated[1]}` : `${plated.slice(0, -1).join(", ")}, and ${plated[plated.length - 1]}`
  steps.push(`Bring the ${platedLine} to the table together.`)

  const withBits = [olive?.name, cheese?.name].filter((name): name is string => Boolean(name))
  const withLine = withBits.map((name) => `the ${name}`).join(" and ")
  const cookedLine = bake ? `The ${mainWord} bakes` : `The ${mainWord} cooks in a pan`
  const summary = [
    `${cookedLine}${withLine ? ` with ${withLine}` : ""}.`,
    side ? `The ${side.name} is the side.` : "",
    eggs ? `The ${eggs.name} finish the plate.` : "",
  ]
    .filter(Boolean)
    .join(" ")

  return {
    title,
    summary,
    minutes,
    servings,
    method: bake && stove ? "Oven and stove" : bake ? "Oven" : "Stove",
    honor: constraintsSentence(ctx.input),
    ingredients: pack([
      line(main.name, fish || chicken ? qty(scale(fish ? 480 : 500, servings), "g") : "as much as you are cooking", true),
      side ? line(side.name, qty(scale(200, servings), "g"), true) : null,
      ...scatter.map((item) => line(item.name, "a handful", true)),
      ...company
        .filter((item) => !scatter.includes(item))
        .map((item) => line(item.name, "to taste", true)),
      eggs ? line(eggs.name, count(servings, 2), true) : null,
      staple(ctx, "oil", "1 tbsp", "oil"),
      staple(ctx, "salt", "to taste"),
    ]),
    steps,
  }
}

export function composeLocalRecipe(input: GenerateInput, skipTitles: string[] = []): RecipeDraft {
  const ctx = context(input)
  if (!ctx) {
    return {
      title: "Nothing left to cook",
      summary: "Every ingredient you named is also excluded. Take one out of the leave-out list, or add something else.",
      minutes: Math.min(input.minutes, 10),
      servings: input.servings,
      method: input.heat.length === 0 ? "No heat" : input.heat.join(" · "),
      honor: constraintsSentence(input),
      ingredients: [],
      steps: ["Go back to the shelf and keep at least one ingredient you are willing to cook."],
      source: "kitchen",
    }
  }

  const must = requiredItems(ctx)
  const ranked: { built: Built; covered: number; score: number; shelf: number }[] = []
  let best: { built: Built; score: number; covered: number } | null = null
  for (const technique of TECHNIQUES) {
    const score = rate(technique, ctx)
    if (score < 0) continue
    const built = technique.build(ctx)
    const covered = must.length === 0 ? 0 : coverCount(built, must)
    ranked.push({ built, covered, score, shelf: shelfUsed(ctx, built) })
    if (!best || covered > best.covered || (covered === best.covered && score > best.score)) {
      best = { built, score, covered }
    }
  }

  let raw = best ? best.built : fallback(ctx)
  const plate = buildSavoryPlate(ctx)
  if (plate) {
    const plateMust = coverCount(plate, must)
    const rawMust = coverCount(raw, must)
    const plateShelf = shelfUsed(ctx, plate)
    const rawShelf = shelfUsed(ctx, raw)
    ranked.push({ built: plate, covered: plateMust, score: 0, shelf: plateShelf })
    if (plateMust > rawMust || (plateMust === rawMust && plateShelf > rawShelf)) raw = plate
  }

  const finish = (built: Built): RecipeDraft => ({ ...annotate(ctx, foldRequired(built, must)), source: "kitchen" })
  const winner = finish(raw)
  const ordered = [winner]
  const byFit = [...ranked].sort((a, b) => b.covered - a.covered || b.shelf - a.shelf || b.score - a.score)
  for (const item of byFit) {
    const recipe = finish(item.built)
    if (ordered.some((existing) => sameDish(existing.title, recipe.title))) continue
    ordered.push(recipe)
  }

  const fresh = ordered.find((recipe) => !skipTitles.some((title) => sameDish(title, recipe.title)))
  if (fresh) return fresh
  const last = skipTitles.at(-1)
  const at = ordered.findIndex((recipe) => last !== undefined && sameDish(recipe.title, last))
  return ordered[(at + 1) % ordered.length]
}

function sameDish(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}
