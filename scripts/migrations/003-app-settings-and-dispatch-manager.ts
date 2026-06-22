/**
 * Seed AppSettings (default PINs) and dispatch manager user Harry Mohsin.
 * Run: npx ts-node scripts/migrations/003-app-settings-and-dispatch-manager.ts
 */
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI_TEST || process.env.MONGODB_URI;
if (!MONGO_URI) {
  console.error('MONGO_URI is required');
  process.exit(1);
}

const MONGO_URI_RESOLVED: string = MONGO_URI;

const MANAGER_EMAIL = 'manager@dispatch.com';

async function run() {
  await mongoose.connect(MONGO_URI_RESOLVED);
  const db = mongoose.connection.db!;

  const settings = db.collection('appsettings');
  const existingSettings = await settings.findOne({});
  if (!existingSettings) {
    await settings.insertOne({
      dispatchElevationPin: '4545',
      payrollElevationPin: '4545',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log('AppSettings seeded (PIN 4545 for dispatch and payroll).');
  } else {
    console.log('AppSettings already exists — skipped seed.');
  }

  const users = db.collection('users');
  const existingUser = await users.findOne({ email: MANAGER_EMAIL });
  if (!existingUser) {
    const passwordHash = await bcrypt.hash('test4545', 10);
    await users.insertOne({
      email: MANAGER_EMAIL,
      password: passwordHash,
      fullName: 'Harry Mohsin',
      phone: '+92 317 4093436',
      role: 'dispatch manager',
      status: 'active',
      teamId: null,
      assignedCity: null,
      assignedCities: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log(`Dispatch manager created: ${MANAGER_EMAIL} / test4545`);
  } else {
    console.log(`User ${MANAGER_EMAIL} already exists — skipped user seed.`);
  }

  await mongoose.disconnect();
  console.log('Migration complete.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
