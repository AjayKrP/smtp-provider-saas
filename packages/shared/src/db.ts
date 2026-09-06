import mongoose from 'mongoose';
import { loadSharedEnv } from './config.js';
import { logger } from './logger.js';

const { GridFSBucket } = mongoose.mongo;
type GridFSBucket = InstanceType<typeof GridFSBucket>;

let connectPromise: Promise<typeof mongoose> | undefined;

export async function connectMongo(): Promise<typeof mongoose> {
  if (connectPromise) return connectPromise;
  const { MONGO_URI } = loadSharedEnv();
  mongoose.set('strictQuery', true);
  connectPromise = mongoose.connect(MONGO_URI).then((m) => {
    logger.info({ db: m.connection.name }, 'mongo connected');
    return m;
  });
  return connectPromise;
}

export async function disconnectMongo(): Promise<void> {
  if (!connectPromise) return;
  await mongoose.disconnect();
  connectPromise = undefined;
}

const RAW_MESSAGE_BUCKET = 'raw_messages';

/** GridFS bucket that stores raw MIME payloads for queued messages. */
export function rawMessageBucket(): GridFSBucket {
  const db = mongoose.connection.db;
  if (!db) throw new Error('mongo not connected: call connectMongo() first');
  return new GridFSBucket(db, { bucketName: RAW_MESSAGE_BUCKET });
}

export { mongoose };
