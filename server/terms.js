import { ObjectId } from 'mongodb';

export const normalize = (value) => value.trim().toLowerCase();

export async function initializeTerms(collection) {
  await collection.createIndex({ searchKey: 1 }, { unique: true });
  await collection.createIndex({ searchPrefixes: 1, searchKey: 1 });
}

export function createTermRepository(collection) {
  return {
    async findById(id) {
      if (!/^[a-f0-9]{24}$/i.test(id)) return null;
      const term = await collection.findOne({ _id: new ObjectId(id) }, {
        projection: { name: 1, aliases: 1, definition: 1, relatedTerms: 1, references: 1, origin: 1 },
      });
      if (!term) return null;
      const ids = (Array.isArray(term.relatedTerms) ? term.relatedTerms : [])
        .filter((value) => /^[a-f0-9]{24}$/i.test(String(value)) && String(value).toLowerCase() !== String(term._id))
        .map((value) => new ObjectId(String(value)));
      term.relatedTerms = ids.length ? await collection.find({ _id: { $in: ids } }, {
        projection: { name: 1 },
      }).sort({ name: 1 }).toArray() : [];
      term.aliases = Array.isArray(term.aliases) ? term.aliases : [];
      term.references = (Array.isArray(term.references) ? term.references : []).filter((reference) => {
        try { return ['http:', 'https:'].includes(new URL(reference?.url).protocol); }
        catch { return false; }
      }).map(({ title, url }) => ({ title: typeof title === 'string' && title.trim() ? title : url, url }));
      return term;
    },
    async listForMap() {
      return collection.find({}, { projection: { name: 1, aliases: 1, category: 1 } }).sort({ name: 1 }).toArray();
    },
    async search(query, limit) {
      return collection.find({ searchPrefixes: normalize(query) }, {
        projection: { name: 1, aliases: 1, definition: 1 },
      }).sort({ searchKey: 1 }).limit(limit).toArray();
    },
  };
}
