const LEXICON: { tag: string; keys: string[] }[] = [
  { tag: "curd", keys: ["творог", "кисломолочн", "cottage", "farmer", "quark", "curd"] },
  { tag: "egg", keys: ["яйц", "яйк", "egg"] },
  { tag: "milk", keys: ["молок", "milk"] },
  { tag: "kefir", keys: ["кефір", "кефир", "kefir"] },
  { tag: "yogurt", keys: ["йогурт", "yogurt", "yoghurt"] },
  { tag: "flour", keys: ["борошн", "flour"] },
  { tag: "sugar", keys: ["цукор", "цукр", "sugar"] },
  { tag: "butter", keys: ["масло", "вершков", "butter"] },
  { tag: "olive", keys: ["olive", "оливки", "оливка", "оливку"] },
  { tag: "oil", keys: ["олія", "олії", "оливков", "oil"] },
  { tag: "apple", keys: ["яблук", "apple"] },
  { tag: "banana", keys: ["банан", "banana"] },
  { tag: "oat", keys: ["вівся", "геркулес", "oat"] },
  { tag: "buckwheat", keys: ["греч", "гречк", "buckwheat"] },
  { tag: "rice", keys: ["рис", "rice", "rise"] },
  { tag: "bulgur", keys: ["bulgur", "булгур"] },
  { tag: "pasta", keys: ["паста", "спагет", "макарон", "pasta", "spaghetti", "noodle"] },
  { tag: "potato", keys: ["картопл", "картоп", "potato"] },
  { tag: "onion", keys: ["цибул", "onion"] },
  { tag: "garlic", keys: ["часник", "часнику", "garlic"] },
  { tag: "tomato", keys: ["помідор", "томат", "tomato"] },
  { tag: "cucumber", keys: ["огірк", "огірок", "cucumber"] },
  { tag: "carrot", keys: ["моркв", "carrot"] },
  { tag: "cabbage", keys: ["капуст", "cabbage"] },
  { tag: "zucchini", keys: ["кабачок", "цукіні", "цукині", "zucchini"] },
  { tag: "mushroom", keys: ["гриб", "mushroom"] },
  { tag: "pepperveg", keys: ["перець", "перцю", "pepper", "capsicum"] },
  { tag: "herb", keys: ["кріп", "петруш", "зелень", "базилік", "кінза", "м'ята", "м’ята", "dill", "parsley", "basil", "cilantro", "mint", "herb"] },
  { tag: "chicken", keys: ["курк", "куря", "куряч", "chicken"] },
  { tag: "mince", keys: ["фарш", "mince"] },
  { tag: "fish", keys: ["риба", "лосос", "тунець", "хек", "минтай", "fish", "salmon", "tuna", "cod"] },
  { tag: "cheese", keys: ["сир", "cheese"] },
  { tag: "bread", keys: ["хліб", "батон", "багет", "bread"] },
  { tag: "honey", keys: ["мед", "honey"] },
  { tag: "lemon", keys: ["лимон", "lemon"] },
  { tag: "cocoa", keys: ["какао", "cocoa"] },
  { tag: "chocolate", keys: ["шоколад", "chocolate"] },
  { tag: "cinnamon", keys: ["кориц", "cinnamon"] },
  { tag: "sourcream", keys: ["сметан"] },
  { tag: "cream", keys: ["вершки", "cream"] },
  { tag: "legume", keys: ["квасол", "нут", "сочевиц", "bean", "lentil", "chickpea"] },
  { tag: "spinach", keys: ["шпинат", "spinach"] },
  { tag: "avocado", keys: ["авокадо", "avocado"] },
]

export function normalizeName(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("uk")
    .replace(/ё/g, "е")
    .replace(/[`'’ʼ]/g, "'")
    .replace(/\s+/g, " ")
}

function words(value: string): string[] {
  return normalizeName(value)
    .split(/[^\p{L}\p{N}']+/u)
    .filter(Boolean)
}

function wordHit(word: string, needle: string): boolean {
  if (word === needle) return true
  if (word.length <= 3 && needle.length <= 3) return word.startsWith(needle) || needle.startsWith(word)
  if (needle.length <= 3) return word.startsWith(needle)
  if (word.length <= 3) return false
  return word.startsWith(needle.slice(0, 4)) || needle.startsWith(word.slice(0, 4))
}

export function mentions(haystack: string, needle: string): boolean {
  const haystackWords = words(haystack)
  const needleWords = words(needle)
  if (haystackWords.length === 0 || needleWords.length === 0) return false
  return needleWords.every((part) => haystackWords.some((word) => wordHit(word, part)))
}

export function tagsFor(name: string): string[] {
  const tokens = words(name)
  const tags: string[] = []
  for (const entry of LEXICON) {
    const hit = entry.keys.some((key) =>
      tokens.some((token) => {
        if (entry.tag === "oil" && (/^olives?$/.test(token) || /^оливк(а|и|у|ою)?$/.test(token))) return false
        return token.startsWith(key) || (key.length >= 5 && token.includes(key))
      }),
    )
    if (hit) tags.push(entry.tag)
  }
  return tags
}

const FORBIDDEN_ALIASES: Record<string, string[]> = {
  mixer: ["mixer", "міксер"],
  blender: ["blender", "блендер"],
  oven: ["oven", "духов"],
  stove: ["stove", "hob", "плит"],
  whisk: ["whisk", "вінчик"],
}

export function forbiddenTerms(notes: string[]): string[] {
  const terms: string[] = []
  for (const note of notes) {
    const match = normalizeName(note).match(/^(?:no|without|don't use|do not use|never|avoid|без)\s+(.+)$/i)
    if (!match?.[1]) continue
    terms.push(match[1].replace(/^(?:a|an|the|using)\s+/, "").trim())
  }
  return terms.filter(Boolean)
}

export function forbids(notes: string[], thing: string): boolean {
  const aliases = FORBIDDEN_ALIASES[thing] ?? [thing]
  return forbiddenTerms(notes).some((term) => aliases.some((alias) => mentions(term, alias) || mentions(alias, term)))
}

export function dedupeNames(names: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const name of names) {
    const clean = name.trim().replace(/\s+/g, " ")
    const key = normalizeName(clean)
    if (!key || seen.has(key)) continue
    seen.add(key)
    result.push(clean)
  }
  return result
}
