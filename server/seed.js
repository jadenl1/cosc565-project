import { readFile } from 'node:fs/promises';
import { connectDatabase } from './database.js';
import { importTerms } from './terms.js';

const entries = JSON.parse(await readFile(new URL('./data/terms.json', import.meta.url), 'utf8'));
const { client, collection } = await connectDatabase();
try {
  await importTerms(collection, entries);
  console.log(`Imported ${entries.length} terms; existing entries were preserved.`);
} finally {
  await client.close();
}
