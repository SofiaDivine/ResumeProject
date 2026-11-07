# Savoria

Recipes from what is already at home. You name the shelf, the time, the heat, and anything the plate should skip. A recipe you like goes into a collection: breakfasts, lunches, baking, or one of your own.

A recipe does not have to use every ingredient. If the apples, flour, and eggs make a better cake than a dish that also needs the chicken, the cake is the one you get. What stays on the shelf is named in the note under the summary.

Heat is two switches: stove and oven. A knife, board, bowl, and spoon are assumed. Anything else is a note you type when you need it, such as `no mixer` or `with a mixer`.

## Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Without a key, the local kitchen picks a technique that fits the ingredients, the time, and the heat. To have Llama write instead, copy `.env.example` to `.env.local` and fill in an OpenAI-compatible endpoint. For Groq that is `https://api.groq.com/openai/v1` and a current Llama model. If the model breaks a constraint, the local kitchen writes the recipe again.

```bash
npm test
```

## How it is built

Next.js (App Router) holds both the interface and the Node server. Kitchen actions are Server Actions. Collection reads happen in the request, behind `io()` and `<Suspense>`, so the page shell stays static and the shelf stays fresh.

`src/server/kitchen` is the recipe contract. Zod checks the input. The local kitchen scores dishes by how specific they are, not by how much of the shelf they empty. Llama gets the same contract and a second check: excluded foods, the time limit, notes such as `no mixer`, and heat that was switched off.

Recipes and collections live in `data/savoria.db` (built-in `node:sqlite`). The database file is not committed.
