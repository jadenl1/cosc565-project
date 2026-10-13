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
      return collection.findOne({ _id: new ObjectId(id) }, {
        projection: { name: 1, aliases: 1, definition: 1 },
      });
    },
    async search(query, limit) {
      return collection.find({ searchPrefixes: normalize(query) }, {
        projection: { name: 1, aliases: 1, definition: 1 },
      }).sort({ searchKey: 1 }).limit(limit).toArray();
    },
  };
}
