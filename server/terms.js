export const normalize = (value) => value.trim().toLowerCase();

export async function initializeTerms(collection) {
  await collection.createIndex({ searchKey: 1 }, { unique: true });
  await collection.createIndex({ searchPrefixes: 1, searchKey: 1 });
}

export function prepareTerm({ name, aliases = [], definition }) {
  if (typeof name !== 'string' || !name.trim() || name.length > 120 ||
      typeof definition !== 'string' || !definition.trim() ||
      !Array.isArray(aliases) || aliases.some((alias) => typeof alias !== 'string' || !alias.trim() || alias.length > 120)) {
    throw new Error('Each term requires a name, definition, and valid aliases.');
  }
  const searchKey = normalize(name);
  const searchPrefixes = new Set();
  // Materialized prefixes keep case-insensitive autocomplete queries indexed.
  for (const value of [searchKey, ...aliases.map(normalize)]) {
    for (let length = 1; length <= value.length; length++) {
      searchPrefixes.add(value.slice(0, length));
    }
  }
  return { name: name.trim(), aliases: aliases.map((alias) => alias.trim()), definition: definition.trim(), searchKey, searchPrefixes: [...searchPrefixes], origin: 'initial' };
}

export async function importTerms(collection, entries) {
  const terms = entries.map(prepareTerm);
  await initializeTerms(collection);
  for (const term of terms) {
    await collection.updateOne(
      { searchKey: term.searchKey },
      { $setOnInsert: { ...term, createdAt: new Date(), updatedAt: new Date() } },
      { upsert: true },
    );
  }
}

export function createTermRepository(collection) {
  return {
    async search(query, limit) {
      return collection.find({ searchPrefixes: normalize(query) }, {
        projection: { name: 1, aliases: 1, definition: 1 },
      }).sort({ searchKey: 1 }).limit(limit).toArray();
    },
  };
}
