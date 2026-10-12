# COSC 565 Project - Jaden Leonard

[Software Writeup](https://docs.google.com/document/d/1lgDlIp-6suhqtUDul4hD9NUN0OtezQXp/edit)

## Run locally

Requires Node.js 22.18+ and MongoDB running locally or a MongoDB connection URI.

```sh
npm install
cp .env.example .env
npm run seed
npm run dev
```

Set `MONGODB_URI` in `.env` if needed. Open the Vite URL printed in the terminal.
The seed command imports ten starter entries and preserves existing terms.

## Search

Search the beginning of a term or alias, ignoring case and surrounding spaces.
Suggestions appear after 250 ms; use arrow keys and Enter to select one, or submit
with Enter or the Search button. Results include definitions and aliases.

`GET /api/terms?q=api` returns up to 50 matches. Add `suggest=true` for up to eight
suggestions. `hasMore` indicates additional matches. Queries must contain 1–120
characters. MongoDB stores indexed search prefixes for names and aliases.

## Check and build

```sh
npm test
npm run build
npm start
```

Tests start a temporary MongoDB instance and download its binary on first run.
The production server serves the built app at `http://localhost:3001`.
