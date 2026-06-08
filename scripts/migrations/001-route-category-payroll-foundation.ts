/**
 * Backfill routeCategory=SMALL on existing routes and seed PayrollSettings.
 * Run: npx ts-node scripts/migrations/001-route-category-payroll-foundation.ts
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('MONGO_URI is required');
  process.exit(1);
}

async function run() {
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db!;

  const routes = db.collection('routes');
  const routeResult = await routes.updateMany(
    { $or: [{ routeCategory: { $exists: false } }, { routeCategory: null }, { routeCategory: '' }] },
    { $set: { routeCategory: 'SMALL' } }
  );
  console.log(`Routes backfilled to SMALL: ${routeResult.modifiedCount}`);

  const settings = db.collection('payrollsettings');
  const existing = await settings.findOne({});
  if (!existing) {
    await settings.insertOne({
      smallRouteRate: 200,
      mediumRouteRate: 300,
      fullRouteRate: 400,
      updatedBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log('PayrollSettings seeded (200/300/400).');
  } else {
    console.log('PayrollSettings already exists — skipped seed.');
  }

  await mongoose.disconnect();
  console.log('Migration complete.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
