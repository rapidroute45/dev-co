import { RouteCategory } from '../../../../shared/constants/routeCategories';
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
  overtimeHours: number;
  overtimeHourlyRate: number;
  overtimeTotal: number;
};

export type StoreInvoiceLineItem = {
  date: string;
  description: string;
  pay: number;
  routeBase: number;
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
  totalOvertimeHours: number;
  overtimeHourlyRate: number;
  overtimeTotal: number;
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

type StoreMeta = { id: string; storeName: string };

export function buildStoreInvoiceData(input: {
  periodStart: string;
  periodEnd: string;
  billToName: string;
  billToAddress: string;
  weeklyPerformanceIncentiveRate: number;
  stores: StoreMeta[];
  routes: Route[];
  scheduleStoreIdByScheduleId: Map<string, string>;
  defaults: StoreBillingSettings;
  overrides: StoreBillingRateOverride[];
}): StoreInvoiceData {
  const overrideByStoreId = mapOverridesByStoreId(input.overrides);
  const storeById = new Map(input.stores.map((s) => [s.id, s]));

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

  type GroupKey = string;
  const dayStoreCategoryCounts = new Map<
    GroupKey,
    { date: string; storeId: string; category: RouteCategory; count: number }
  >();

  const storeCategoryTotals = new Map<
    string,
    Map<RouteCategory, { count: number; routeBase: number }>
  >();
  const storeOvertimeHours = new Map<string, number>();
  let totalOvertimeHours = 0;
  let overtimeTotal = 0;
  let totalRouteCount = 0;

  for (const route of input.routes) {
    const storeId = input.scheduleStoreIdByScheduleId.get(route.scheduleId);
    if (!storeId) continue;
    const rates = ratesByStoreId.get(storeId);
    if (!rates) continue;

    const category = (route.routeCategory as RouteCategory) ?? RouteCategory.SMALL;
    const date = route.scheduleDate.toISOString().slice(0, 10);
    const groupKey = `${date}|${storeId}|${category}`;
    const existing = dayStoreCategoryCounts.get(groupKey);
    if (existing) existing.count += 1;
    else dayStoreCategoryCounts.set(groupKey, { date, storeId, category, count: 1 });

    const storeCats =
      storeCategoryTotals.get(storeId) ?? new Map<RouteCategory, { count: number; routeBase: number }>();
    const catEntry = storeCats.get(category) ?? {
      count: 0,
      routeBase: storeBillingRateForCategory(rates, category),
    };
    catEntry.count += 1;
    storeCats.set(category, catEntry);
    storeCategoryTotals.set(storeId, storeCats);

    const otHours = route.overtimeHours ?? 0;
    if (otHours > 0) {
      storeOvertimeHours.set(storeId, (storeOvertimeHours.get(storeId) ?? 0) + otHours);
      totalOvertimeHours += otHours;
      overtimeTotal += otHours * rates.overtimeHourlyRate;
    }
    totalRouteCount += 1;
  }

  const storeLines: StoreInvoiceStoreLine[] = input.stores
    .map((store) => {
      const cats = storeCategoryTotals.get(store.id);
      if (!cats) return null;
      const rates = ratesByStoreId.get(store.id)!;
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

      const otHours = storeOvertimeHours.get(store.id) ?? 0;
      return {
        storeId: store.id,
        storeName: store.storeName,
        routeCount: categories.reduce((sum, c) => sum + c.count, 0),
        categories,
        overtimeHours: otHours,
        overtimeHourlyRate: rates.overtimeHourlyRate,
        overtimeTotal: otHours * rates.overtimeHourlyRate,
      };
    })
    .filter((line): line is StoreInvoiceStoreLine => Boolean(line && line.routeCount > 0))
    .sort((a, b) => a.storeName.localeCompare(b.storeName));

  const sortedGroups = [...dayStoreCategoryCounts.values()].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    const storeA = storeById.get(a.storeId)?.storeName ?? '';
    const storeB = storeById.get(b.storeId)?.storeName ?? '';
    if (storeA !== storeB) return storeA.localeCompare(storeB);
    return CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
  });

  const lineItems: StoreInvoiceLineItem[] = [];
  const leadTime = `${formatLeadDate(input.periodStart)}-${formatLeadDate(input.periodEnd)}`;

  lineItems.push({
    date: leadTime,
    description: 'DELIVERY SERVICES',
    pay: 0,
    routeBase: 0,
    total: 0,
  });

  let routeBaseSubtotal = 0;
  for (const group of sortedGroups) {
    const store = storeById.get(group.storeId);
    const rates = ratesByStoreId.get(group.storeId)!;
    const routeBase = storeBillingRateForCategory(rates, group.category);
    const total = group.count * routeBase;
    routeBaseSubtotal += total;
    lineItems.push({
      date: group.date,
      description: `${store?.storeName ?? 'Store'} - Route Base Pay`,
      pay: group.count,
      routeBase,
      total,
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
      total: weeklyPerformanceIncentiveTotal,
    });
  }

  const defaultOtRate = input.defaults.overtimeHourlyRate;
  if (totalOvertimeHours > 0) {
    lineItems.push({
      date: leadTime,
      description: `overtime hours${totalOvertimeHours}*$${defaultOtRate}`,
      pay: totalOvertimeHours,
      routeBase: defaultOtRate,
      total: overtimeTotal,
    });
  }

  lineItems.push({
    date: '',
    description: 'Rural',
    pay: 0,
    routeBase: 0,
    total: 0,
  });

  const subtotal = routeBaseSubtotal + weeklyPerformanceIncentiveTotal + overtimeTotal;
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
    totalOvertimeHours,
    overtimeHourlyRate: defaultOtRate,
    overtimeTotal,
    weeklyPerformanceIncentiveRate: input.weeklyPerformanceIncentiveRate,
    weeklyPerformanceIncentiveTotal,
    subtotal,
    taxRate,
    taxAmount,
    total: subtotal + taxAmount,
  };
}
