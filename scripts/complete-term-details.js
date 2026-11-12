import { readFile } from 'node:fs/promises';
import { connectDatabase } from '../server/database.js';

const mappings = [
  ['Application Programming Interface', 'API', ['REST', 'HTTP', 'Function']],
  ['Artificial Intelligence', null, ['Machine Learning', 'Algorithm']],
  ['Continuous Integration', 'Continuous integration', ['Git', 'Version Control']],
  ['Database', 'Database', ['SQL', 'CRUD', 'Data type']],
  ['Domain Name System', 'DNS', ['IP address', 'URL']],
  ['Hypertext Transfer Protocol', 'HTTP', ['HTTPS', 'Web server', 'REST']],
  ['JavaScript', 'JavaScript', ['HTML', 'DOM', 'Function']],
  ['Machine Learning', null, ['Artificial Intelligence', 'Algorithm', 'Database']],
  ['Structured Query Language', 'SQL', ['Database', 'SQL injection', 'CRUD']],
  ['Version Control', 'Version control', ['Git', 'Continuous Integration']],
];
const checks = JSON.parse(
  await readFile(new URL('../data/us02-reference-checks.json', import.meta.url), 'utf8'),
);
const references = new Map();
for (const [name, source] of mappings) {
  const url = source
    ? checks.find((check) => check.name === source)?.url
    : 'https://developers.google.com/machine-learning/glossary';
  if (!url) throw new Error(`Missing reference for ${name}`);
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  const html = await response.text();
  const title = html.match(/<title>(.*?)<\/title>/s)?.[1]?.trim();
  if (!response.ok || !title || /Page not found/i.test(title))
    throw new Error(`Reference failed: ${name}`);
  references.set(name, [{ title, url: response.url, checkedAt: new Date() }]);
}
const { client, collection } = await connectDatabase();
try {
  const terms = await collection.find({}).toArray();
  const lookup = new Map();
  for (const term of terms)
    for (const name of [term.name, ...(term.aliases || [])]) lookup.set(name.toLowerCase(), term);
  const updates = mappings.flatMap(([name, , related]) => {
    const term = lookup.get(name.toLowerCase());
    if (!term) throw new Error(`Missing term: ${name}`);
    const fields = {};
    if (!term.relatedTerms?.length)
      fields.relatedTerms = related.map((name) => {
        const target = lookup.get(name.toLowerCase());
        if (!target) throw new Error(`Missing related term: ${name}`);
        return target._id;
      });
    if (!term.references?.length) fields.references = references.get(name);
    return Object.keys(fields).length
      ? [
          {
            updateOne: {
              filter: { _id: term._id },
              update: { $set: { ...fields, updatedAt: new Date() } },
            },
          },
        ]
      : [];
  });
  console.log(
    JSON.stringify({
      mode: process.argv.includes('--apply') ? 'apply' : 'preview',
      updates: updates.length,
    }),
  );
  if (process.argv.includes('--apply') && updates.length) await collection.bulkWrite(updates);
  const saved = await collection
    .find({}, { projection: { relatedTerms: 1, references: 1 } })
    .toArray();
  const ids = new Set(saved.map((term) => String(term._id)));
  const report = {
    total: saved.length,
    withoutRelatedTerms: saved.filter((term) => !term.relatedTerms?.length).length,
    withoutReferences: saved.filter((term) => !term.references?.length).length,
    danglingLinks: saved
      .flatMap((term) => term.relatedTerms || [])
      .filter((id) => !ids.has(String(id))).length,
  };
  console.log(JSON.stringify(report));
  if (
    process.argv.includes('--apply') &&
    (report.withoutRelatedTerms || report.withoutReferences || report.danglingLinks)
  )
    throw new Error('Incomplete term coverage');
} finally {
  await client.close();
}
