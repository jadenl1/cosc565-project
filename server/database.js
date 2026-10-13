import { MongoClient } from 'mongodb';

export async function connectDatabase() {
  if (!process.env.MONGODB_URI) throw new Error('Set MONGODB_URI in .env to your Atlas connection string.');
  const client = new MongoClient(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
  });
  await client.connect();
  return { client, collection: client.db(process.env.MONGODB_DB || 'buzzword_techtionary').collection('terms') };
}
