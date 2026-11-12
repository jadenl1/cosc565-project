import { readFile, writeFile } from 'node:fs/promises';
import { ObjectId } from 'mongodb';
import { connectDatabase } from '../server/database.js';

const batch = 'us02-100-terms';
const normalize = (value) => value.trim().toLowerCase();
const dataPath = new URL('../data/us02-terms.txt', import.meta.url);
const checksPath = new URL('../data/us02-reference-checks.json', import.meta.url);
const rows = (await readFile(dataPath, 'utf8')).trim().split('\n').map((line) => {
  const [name, aliases, slug, related, definition] = line.split('|');
  if (!name || !slug || !related || !definition) throw new Error(`Invalid row: ${name}`);
  return { name, aliases: aliases ? aliases.split(',') : [], slug, related: related.split(','), definition };
});
if (new Set(rows.map((row) => normalize(row.name))).size !== rows.length) throw new Error('Duplicate candidate names.');

if (process.argv.includes('--check-references')) {
  const checks = [];
  // Keep requests modest while checking the actual linked article, not just its URL format.
  for (let start = 0; start < rows.length; start += 5) {
    checks.push(...await Promise.all(rows.slice(start, start + 5).map(async ({ name, slug }) => {
      const url = slug.startsWith('https://') ? slug : `https://developer.mozilla.org/en-US/docs/Glossary/${slug}`;
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
        const html = await response.text();
        const title = html.match(/<title>(.*?)<\/title>/s)?.[1];
        const valid = response.ok && Boolean(title) && !/Page not found/i.test(title);
        return { name, url: response.url, title, valid, status: response.status, checkedAt: new Date().toISOString() };
      } catch (error) {
        return { name, url, valid: false, error: error.message };
      }
    })));
  }
  await writeFile(checksPath, `${JSON.stringify(checks, null, 2)}\n`);
  console.log(JSON.stringify({ candidates: rows.length, verified: checks.filter((row) => row.valid).length, failed: checks.filter((row) => !row.valid) }, null, 2));
} else {
  const checks = new Map(JSON.parse(await readFile(checksPath, 'utf8')).map((row) => [row.name, row]));
  const { client, collection } = await connectDatabase();
  try {
    const existing = await collection.find({}, { projection: { name: 1, aliases: 1, searchKey: 1, importBatch: 1, relatedTerms: 1 } }).toArray();
    const previous = existing.filter((term) => term.importBatch === batch);
    if (previous.length) {
      if (previous.length !== 100) throw new Error(`Batch has ${previous.length} records; inspect before continuing.`);
      console.log('This batch already contains 100 terms; no changes made.');
    } else {
      const names = new Set(existing.flatMap((term) => [term.name, term.searchKey, ...(term.aliases || [])].filter(Boolean).map(normalize)));
      const candidates = rows.filter((term) => checks.get(term.name)?.valid && ![term.name, ...term.aliases].some((value) => names.has(normalize(value))));
      if (candidates.length < 100) throw new Error(`Only ${candidates.length} verified, nonduplicate candidates; need 100.`);
      // Sample throughout the list so all subject areas are represented.
      const selected = Array.from({ length: 100 }, (_, i) => candidates[Math.floor(i * candidates.length / 100)]);
      const timestamp = new Date();
      const docs = selected.map((term) => ({
        _id: new ObjectId(), name: term.name, aliases: term.aliases, definition: term.definition,
        searchKey: normalize(term.name),
        searchPrefixes: [...new Set([term.name, ...term.aliases].flatMap((value) => Array.from({ length: normalize(value).length }, (_, i) => normalize(value).slice(0, i + 1))))],
        references: [{ title: checks.get(term.name).title, url: checks.get(term.name).url, checkedAt: new Date(checks.get(term.name).checkedAt) }],
        origin: 'ai-generated', importBatch: batch, createdAt: timestamp, updatedAt: timestamp,
      }));
      const lookup = new Map();
      for (const term of [...existing, ...docs]) for (const name of [term.name, ...(term.aliases || [])]) lookup.set(normalize(name), term._id);
      for (const [i, doc] of docs.entries()) {
        doc.relatedTerms = selected[i].related.map((name) => lookup.get(normalize(name))).filter((id) => id && !id.equals(doc._id));
      }
      // Relatedness is symmetric for these glossary links; add backlinks within the new batch.
      const byId = new Map(docs.map((doc) => [String(doc._id), doc]));
      for (const doc of docs) for (const id of doc.relatedTerms) {
        const target = byId.get(String(id));
        if (target && !target.relatedTerms.some((related) => related.equals(doc._id))) target.relatedTerms.push(doc._id);
      }
      const isolated = docs.filter((doc) => !doc.relatedTerms.length);
      if (isolated.length) throw new Error(`Unresolved related terms: ${isolated.map((doc) => doc.name).join(', ')}`);
      console.log(JSON.stringify({ mode: process.argv.includes('--apply') ? 'apply' : 'dry-run', existing: existing.length, additions: docs.length, relatedLinks: docs.reduce((n, doc) => n + doc.relatedTerms.length, 0), names: docs.map((doc) => doc.name) }, null, 2));
      if (process.argv.includes('--apply')) {
        // Atlas transactions prevent a partially imported batch on failure.
        const session = client.startSession();
        try {
          await session.withTransaction(async () => {
            if (await collection.countDocuments({ importBatch: batch }, { session })) throw new Error('Batch was imported concurrently.');
            const duplicate = await collection.findOne({ $or: [{ searchKey: { $in: docs.map((doc) => doc.searchKey) } }, { name: { $in: docs.map((doc) => doc.name) } }] }, { session });
            if (duplicate) throw new Error('A candidate already exists; rerun the dry run.');
            await collection.insertMany(docs, { session });
          });
        } finally { await session.endSession(); }
        const saved = await collection.find({ importBatch: batch }).toArray();
        const allIds = new Set((await collection.find({}, { projection: { _id: 1 } }).toArray()).map((doc) => String(doc._id)));
        if (saved.length !== 100 || saved.some((doc) => !doc.relatedTerms.length || doc.relatedTerms.some((id) => !allIds.has(String(id))))) throw new Error('Post-import verification failed.');
        console.log(JSON.stringify({ insertedAndVerified: saved.length, totalTerms: await collection.countDocuments(), danglingRelatedLinks: 0 }));
      }
    }
  } finally { await client.close(); }
}
