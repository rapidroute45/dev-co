/**
 * Drop stale ChatConversation unique index on managerId+driverId (without partial filter).
 * That index blocks creating more than one group chat (both fields null).
 *
 * Run: npx ts-node scripts/migrations/004-fix-chat-group-index.ts
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI_TEST || process.env.MONGODB_URI;
if (!MONGO_URI) {
  console.error('MONGO_URI is required');
  process.exit(1);
}

const INDEX_NAME = 'managerId_1_driverId_1';

async function fixConversationIndexes(db: mongoose.mongo.Db) {
  const col = db.collection('chatconversations');
  const indexes = await col.indexes();

  for (const idx of indexes) {
    const keys = idx.key ?? {};
    const isPairIndex = keys.managerId === 1 && keys.driverId === 1;
    if (!isPairIndex) continue;

    if (!idx.partialFilterExpression && idx.name) {
      console.log(`Dropping stale index: ${idx.name}`);
      await col.dropIndex(idx.name);
    }
  }

  const after = await col.indexes();
  const hasPartial = after.some(
    (idx) =>
      idx.key?.managerId === 1 &&
      idx.key?.driverId === 1 &&
      idx.partialFilterExpression != null
  );

  if (!hasPartial) {
    console.log(`Creating partial unique index: ${INDEX_NAME}`);
    await col.createIndex(
      { managerId: 1, driverId: 1 },
      {
        unique: true,
        name: INDEX_NAME,
        partialFilterExpression: { kind: { $in: ['driver', 'internal'] } },
      }
    );
  } else {
    console.log('Partial unique index already present — nothing to create.');
  }
}

async function run() {
  await mongoose.connect(MONGO_URI!);
  const db = mongoose.connection.db!;
  await fixConversationIndexes(db);
  await mongoose.disconnect();
  console.log('Done.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
