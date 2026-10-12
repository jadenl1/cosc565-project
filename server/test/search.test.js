import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';
import { createApp } from '../app.js';
import { createTermRepository, importTerms, prepareTerm } from '../terms.js';

let mongo, client, collection, server, base;
before(async () => {
  mongo = await MongoMemoryServer.create();
  client = await new MongoClient(mongo.getUri()).connect();
  collection = client.db('test').collection('terms');
  const entries = JSON.parse(await readFile(new URL('../data/terms.json', import.meta.url), 'utf8'));
  await importTerms(collection, entries);
  server = createApp(createTermRepository(collection)).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await client?.close();
  await mongo?.stop();
});

async function search(query, suffix = '') {
  const response = await fetch(`${base}/api/terms?q=${encodeURIComponent(query)}${suffix}`);
  return { status: response.status, ...await response.json() };
}

test('matches names and aliases regardless of case and surrounding whitespace', async () => {
  for (const query of [' APPLICATION PROGRAMMING ', 'aPi', ' API ']) {
    const result = await search(query);
    assert.equal(result.status, 200);
    assert.equal(result.terms[0].name, 'Application Programming Interface');
    assert.equal(result.terms.length, 1);
  }
});

test('autocomplete returns matching prefixes and no duplicate terms', async () => {
  const result = await search('a', '&suggest=true');
  assert.deepEqual(result.terms.map((term) => term.name), ['Application Programming Interface', 'Artificial Intelligence']);
});

test('treats regex characters as literal input', async () => {
  assert.deepEqual((await search('.*')).terms, []);
});

test('returns an empty result for unknown terms', async () => {
  assert.deepEqual((await search('missing-term')).terms, []);
});

test('rejects blank, oversized, control-character and non-string queries', async () => {
  for (const query of ['', '   ', 'a'.repeat(121), 'api\n']) assert.equal((await search(query)).status, 400);
  for (const query of ['', '?q=a&q=b', '?q[$ne]=']) {
    assert.equal((await fetch(`${base}/api/terms${query}`)).status, 400);
  }
});

test('import is idempotent and enforces unique normalized names', async () => {
  const count = await collection.countDocuments();
  await importTerms(collection, [{ name: ' DATABASE ', aliases: [], definition: 'Duplicate' }]);
  assert.equal(await collection.countDocuments(), count);
  assert.notEqual((await search('database')).terms[0].definition, 'Duplicate');
  await assert.rejects(collection.insertOne(prepareTerm({ name: 'Database', definition: 'Duplicate' })), { code: 11000 });
});

test('rejects invalid seed entries before writing', async () => {
  await assert.rejects(importTerms(collection, [{ name: 'Valid', definition: 'Definition' }, { name: 'Bad', aliases: [null] }]));
  assert.equal(await collection.countDocuments({ searchKey: 'valid' }), 0);
});

test('limits suggestions and results and signals additional matches', async () => {
  await importTerms(collection, Array.from({ length: 55 }, (_, i) => ({ name: `Test ${String(i).padStart(2, '0')}`, aliases: ['Testing'], definition: 'Test entry' })));
  const suggestions = await search('test', '&suggest=true');
  assert.equal(suggestions.terms.length, 8);
  assert.equal(suggestions.hasMore, true);
  const results = await search('test');
  assert.equal(results.terms.length, 50);
  assert.equal(results.hasMore, true);
});

test('returns a retryable service error without exposing internal details', async () => {
  const failingServer = createApp({ search() { throw new Error('private details'); } }).listen(0, '127.0.0.1');
  await new Promise((resolve) => failingServer.once('listening', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${failingServer.address().port}/api/terms?q=api`);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: 'Search is temporarily unavailable. Please try again.' });
  } finally {
    await new Promise((resolve) => failingServer.close(resolve));
  }
});
