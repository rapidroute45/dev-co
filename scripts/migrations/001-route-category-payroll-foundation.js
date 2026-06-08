"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Backfill routeCategory=SMALL on existing routes and seed PayrollSettings.
 * Run: npx ts-node scripts/migrations/001-route-category-payroll-foundation.ts
 */
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../.env') });
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
    console.error('MONGO_URI is required');
    process.exit(1);
}
async function run() {
    await mongoose_1.default.connect(MONGO_URI);
    const db = mongoose_1.default.connection.db;
    const routes = db.collection('routes');
    const routeResult = await routes.updateMany({ $or: [{ routeCategory: { $exists: false } }, { routeCategory: null }, { routeCategory: '' }] }, { $set: { routeCategory: 'SMALL' } });
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
    }
    else {
        console.log('PayrollSettings already exists — skipped seed.');
    }
    await mongoose_1.default.disconnect();
    console.log('Migration complete.');
}
run().catch((err) => {
    console.error(err);
    process.exit(1);
});
