import express from 'express';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { connectDatabase } from './database.js';
import { createTermRepository, initializeTerms } from './terms.js';

const { client, collection } = await connectDatabase();
await initializeTerms(collection);
const app = createApp(createTermRepository(collection));
app.use(express.static(fileURLToPath(new URL('../dist', import.meta.url))));
const server = app.listen(process.env.PORT || 3001, () => console.log('Techtionary API is ready.'));

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => server.close(async () => {
    await client.close();
    process.exit(0);
  }));
}
