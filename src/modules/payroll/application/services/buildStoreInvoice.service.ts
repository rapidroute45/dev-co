import { RouteCategory } from '../../../../shared/constants/routeCategories';
import { routeDurationHours as computeRouteDurationHours } from '../../../schedules/application/utils/routeDuration';
import type { Route } from '../../../schedules/domain/entities/route.entity';
import { storeBillingRateForCategory } from './storeBillingCalculation.service';
import {
  mapOverridesByStoreId,
  resolveFullStoreBillingRates,
  type FullStoreBillingRates,
} from './storeBillingResolution.service';
import type { StoreBillingSettings } from '../../domain/entities/storeBillingSettings.entity';
import type { StoreBillingRateOverride } from '../../domain/entities/storeBillingRateOverride.entity';

export type StoreInvoiceStoreLine = {
  storeId: string;
  storeName: string;
  routeCount: number;
  categories: {
    category: RouteCategory;
    label: string;
    count: number;
    routeBase: number;
    total: number;
  }[];
  hoursSpent: number;
};

export type StoreInvoiceLineItem = {
  date: string;
  description: string;
  pay: number;
  routeBase: number;
  hoursSpent: number;
  total: number;
};

export type StoreInvoiceData = {
  vendor: {
    name: string;
    bankName: string;
    routingNumber: string;
    accountNumber: string;
    checksPayableTo: string;
  };
  billTo: { name: string; address: string };
  invoiceDate: string;
  invoiceNumber: string;
  paymentDueDate: string;
  leadTime: string;
  periodStart: string;
  periodEnd: string;
  storeLines: StoreInvoiceStoreLine[];
  lineItems: StoreInvoiceLineItem[];
  totalRouteCount: number;
  totalHoursSpent: number;
  ruralAmount: number;
  overtimeAmount: number;
  weeklyPerformanceIncentiveRate: number;
  weeklyPerformanceIncentiveTotal: number;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
};

const CATEGORY_ORDER: RouteCategory[] = [
  RouteCategory.FULL,
  RouteCategory.MEDIUM,
  RouteCategory.SMALL,
];

const CATEGORY_LABELS: Record<RouteCategory, string> = {
  [RouteCategory.SMALL]: 'Small',
  [RouteCategory.MEDIUM]: 'Medium',
  [RouteCategory.FULL]: 'Full',
};

function formatLeadDate(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${m}/${d}`;
}

function addDaysIso(iso: string, days: number): string {
  const dt = new Date(`${iso}T12:00:00`);
  dt.setDate(dt.getDate() + days);
  return dt.toISOString().slice(0, 10);
}

function invoiceNumberFromPeriodEnd(periodEndIso: string): string {
  return `BRT-LV ${periodEndIso.replace(/-/g, '')}`;
}

function routeDurationHours(route: Route): number {
  return computeRouteDurationHours(route) ?? 0;
}

type StoreMeta = { id: string; storeName: string };

export function buildStoreInvoiceData(input: {
  periodStart: string;
  periodEnd: string;
  billToName: string;
  billToAddress: string;
  weeklyPerformanceIncentiveRate: number;
  ruralAmount?: number;
  overtimeAmount?: number;
  stores: StoreMeta[];
  routes: Route[];
  scheduleStoreIdByScheduleId: Map<string, string>;
  defaults: StoreBillingSettings;
  overrides: StoreBillingRateOverride[];
}): StoreInvoiceData {
  const overrideByStoreId = mapOverridesByStoreId(input.overrides);
  const storeById = new Map(input.stores.map((s) => [s.id, s]));
  const ruralAmount = Math.max(0, Number(input.ruralAmount ?? 0) || 0);
  const overtimeAmount = Math.max(0, Number(input.overtimeAmount ?? 0) || 0);

  const ratesByStoreId = new Map<string, FullStoreBillingRates>();
  for (const store of input.stores) {
    ratesByStoreId.set(
      store.id,
      resolveFullStoreBillingRates(
        input.defaults,
        overrideByStoreId.get(store.id) ?? null
      )
    );
  }

  const storeCategoryTotals = new Map<
    string,
    Map<RouteCategory, { count: number; routeBase: number }>
  >();
  const storeHoursSpent = new Map<string, number>();

  type RouteRow = {
    date: string;
    storeId: string;
    storeName: string;
    category: RouteCategory;
    routeBase: number;
    hoursSpent: number;
  };

  const routeRows: RouteRow[] = [];
  let totalHoursSpent = 0;
  let totalRouteCount = 0;

  for (const route of input.routes) {
    const storeId = input.scheduleStoreIdByScheduleId.get(route.scheduleId);
    if (!storeId) continue;
    const rates = ratesByStoreId.get(storeId);
    const store = storeById.get(storeId);
    if (!rates || !store) continue;

    const category = (route.routeCategory as RouteCategory) ?? RouteCategory.SMALL;
    const date = route.scheduleDate.toISOString().slice(0, 10);
    const routeBase = storeBillingRateForCategory(rates, category);
    const hoursSpent = routeDurationHours(route);

    routeRows.push({
      date,
      storeId,
      storeName: store.storeName,
      category,
      routeBase,
      hoursSpent,
    });

    const storeCats =
      storeCategoryTotals.get(storeId) ?? new Map<RouteCategory, { count: number; routeBase: number }>();
    const catEntry = storeCats.get(category) ?? { count: 0, routeBase };
    catEntry.count += 1;
    storeCats.set(category, catEntry);
    storeCategoryTotals.set(storeId, storeCats);

    storeHoursSpent.set(storeId, (storeHoursSpent.get(storeId) ?? 0) + hoursSpent);
    totalHoursSpent += hoursSpent;
    totalRouteCount += 1;
  }

  routeRows.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    if (a.storeName !== b.storeName) return a.storeName.localeCompare(b.storeName);
    return CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
  });

  const storeLines: StoreInvoiceStoreLine[] = input.stores
    .map((store) => {
      const cats = storeCategoryTotals.get(store.id);
      if (!cats) return null;
      const categories = CATEGORY_ORDER.map((category) => {
        const entry = cats.get(category);
        if (!entry || entry.count === 0) return null;
        return {
          category,
          label: CATEGORY_LABELS[category],
          count: entry.count,
          routeBase: entry.routeBase,
          total: entry.count * entry.routeBase,
        };
      }).filter(Boolean) as StoreInvoiceStoreLine['categories'];

      return {
        storeId: store.id,
        storeName: store.storeName,
        routeCount: categories.reduce((sum, c) => sum + c.count, 0),
        categories,
        hoursSpent: Math.round((storeHoursSpent.get(store.id) ?? 0) * 100) / 100,
      };
    })
    .filter((line): line is StoreInvoiceStoreLine => Boolean(line && line.routeCount > 0))
    .sort((a, b) => a.storeName.localeCompare(b.storeName));

  const lineItems: StoreInvoiceLineItem[] = [];
  const leadTime = `${formatLeadDate(input.periodStart)}-${formatLeadDate(input.periodEnd)}`;

  lineItems.push({
    date: leadTime,
    description: 'DELIVERY SERVICES',
    pay: 0,
    routeBase: 0,
    hoursSpent: 0,
    total: 0,
  });

  let routeBaseSubtotal = 0;
  for (const row of routeRows) {
    routeBaseSubtotal += row.routeBase;
    lineItems.push({
      date: row.date,
      description: "Route Base Pay",
      pay: 1,
      routeBase: row.routeBase,
      hoursSpent: row.hoursSpent,
      total: row.routeBase,
    });
  }

  if (totalRouteCount > 0) {
    lineItems.push({
      date: leadTime,
      description: 'Total time on routes',
      pay: totalRouteCount,
      routeBase: 0,
      hoursSpent: Math.round(totalHoursSpent * 100) / 100,
      total: 0,
    });
  }

  const weeklyPerformanceIncentiveTotal =
    totalRouteCount * input.weeklyPerformanceIncentiveRate;
  if (weeklyPerformanceIncentiveTotal > 0 || input.weeklyPerformanceIncentiveRate > 0) {
    lineItems.push({
      date: input.periodEnd,
      description: 'Weekly Performance Incentive',
      pay: totalRouteCount,
      routeBase: input.weeklyPerformanceIncentiveRate,
      hoursSpent: 0,
      total: weeklyPerformanceIncentiveTotal,
    });
  }

  lineItems.push({
    date: '',
    description: 'Rural',
    pay: 0,
    routeBase: 0,
    hoursSpent: 0,
    total: ruralAmount,
  });

  lineItems.push({
    date: '',
    description: 'OT',
    pay: 0,
    routeBase: 0,
    hoursSpent: 0,
    total: overtimeAmount,
  });

  const subtotal =
    routeBaseSubtotal + weeklyPerformanceIncentiveTotal + ruralAmount + overtimeAmount;
  const taxRate = 0;
  const taxAmount = 0;

  return {
    vendor: {
      name: 'Brother Intl Management Inc',
      bankName: 'Chase',
      routingNumber: '322271627',
      accountNumber: '575519809',
      checksPayableTo: 'Brother Intl Management Inc',
    },
    billTo: {
      name: input.billToName.trim(),
      address: input.billToAddress.trim(),
    },
    invoiceDate: input.periodEnd,
    invoiceNumber: invoiceNumberFromPeriodEnd(input.periodEnd),
    paymentDueDate: addDaysIso(input.periodEnd, 7),
    leadTime,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    storeLines,
    lineItems,
    totalRouteCount,
    totalHoursSpent: Math.round(totalHoursSpent * 100) / 100,
    ruralAmount,
    overtimeAmount,
    weeklyPerformanceIncentiveRate: input.weeklyPerformanceIncentiveRate,
    weeklyPerformanceIncentiveTotal,
    subtotal,
    taxRate,
    taxAmount,
    total: subtotal + taxAmount,
  };
}
