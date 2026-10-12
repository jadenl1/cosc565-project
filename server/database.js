import { MongoClient } from 'mongodb';

export async function connectDatabase() {
  const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017', {
    serverSelectionTimeoutMS: 5000,
  });
  await client.connect();
  return { client, collection: client.db(process.env.MONGODB_DB || 'buzzword_techtionary').collection('terms') };
}
