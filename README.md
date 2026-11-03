# COSC 565 Project - Jaden Leonard

[Software Writeup](https://docs.google.com/document/d/1lgDlIp-6suhqtUDul4hD9NUN0OtezQXp/edit)

## Run locally

Requires Node.js 22.18+ and access to the existing MongoDB Atlas database.

```sh
npm install
```

Create `.env` in the project root with your Atlas connection string:

```dotenv
MONGODB_URI=mongodb+srv://USERNAME:PASSWORD@YOUR_CLUSTER.mongodb.net/
MONGODB_DB=buzzword_techtionary
PORT=3001
```

Replace the placeholders with your Atlas credentials and cluster address.
`.env` is ignored by Git. Keep an existing `.env` if already configured.

Start the app:

```sh
npm run dev
```

Open the Vite URL printed in the terminal. Terms are read directly from Atlas.

## Search

Search the beginning of a term or alias, ignoring case and surrounding spaces.
Suggestions appear after 250 ms. Enter opens the first match; arrow keys select
another match. Clicking a suggestion opens its definition page. Definition URLs
use `/#/terms/<id>` and work on refresh.

`GET /api/terms?q=api` returns up to 50 matches. Add `suggest=true` for up to eight
suggestions. `GET /api/terms/:id` returns a single definition. `hasMore` indicates additional matches. Queries must contain 1–120
characters. MongoDB stores indexed search prefixes for names and aliases.

## Check and build

```sh
npm test
npm run build
npm start
```

Tests start a temporary MongoDB instance and download its binary on first run.
The production server serves the built app at `http://localhost:3001`.
