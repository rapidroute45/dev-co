/**
 * Backfill bonusesTotal, deductionsTotal, overtimeTotal on existing payroll bills.
 * Run: npx ts-node scripts/migrations/002-payroll-bill-driver-rollups.ts
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

type DriverLine = {
  bonus?: number;
  deduction?: number;
  overtime?: number;
};

function rollup(lineItems: DriverLine[]) {
  let bonusesTotal = 0;
  let deductionsTotal = 0;
  let overtimeTotal = 0;
  for (const line of lineItems) {
    bonusesTotal += line.bonus ?? 0;
    deductionsTotal += line.deduction ?? 0;
    overtimeTotal += line.overtime ?? 0;
  }
  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    bonusesTotal: round(bonusesTotal),
    deductionsTotal: round(deductionsTotal),
    overtimeTotal: round(overtimeTotal),
  };
}

async function run() {
  await mongoose.connect(MONGO_URI);
  const bills = mongoose.connection.db!.collection('payrollbills');
  const docs = await bills.find({}).toArray();
  let updated = 0;
  for (const doc of docs) {
    const lineItems = (doc.lineItems ?? []) as DriverLine[];
    const totals = rollup(lineItems);
    await bills.updateOne(
      { _id: doc._id },
      {
        $set: {
          bonusesTotal: totals.bonusesTotal,
          deductionsTotal: totals.deductionsTotal,
          overtimeTotal: totals.overtimeTotal,
        },
      }
    );
    updated += 1;
  }
  console.log(`Backfilled driver rollups on ${updated} payroll bill(s).`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
