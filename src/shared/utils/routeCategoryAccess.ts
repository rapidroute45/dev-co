import { UserRole } from '../constants/roles';
import {
  DEFAULT_ROUTE_CATEGORY,
  RouteCategory,
  ROUTE_CATEGORIES,
} from '../constants/routeCategories';
import { AppError } from '../errors/app-error';

/** Ops roles that set and see route category (Small / Medium / Full). */
const ROUTE_CATEGORY_VIEWER_ROLES: UserRole[] = [
  UserRole.ADMIN,
  UserRole.DISPATCH_MANAGER,
  UserRole.DISPATCH_TEAM,
  UserRole.TEAM_LEAD,
];

export function canViewRouteCategory(role: UserRole | null | undefined): boolean {
  return role != null && ROUTE_CATEGORY_VIEWER_ROLES.includes(role);
}

export function parseRouteCategoryInput(raw: unknown): RouteCategory {
  if (raw === undefined || raw === null || raw === '') {
    return DEFAULT_ROUTE_CATEGORY;
  }
  const value = String(raw).trim().toUpperCase();
  if (!ROUTE_CATEGORIES.includes(value as RouteCategory)) {
    throw new AppError(`routeCategory must be one of: ${ROUTE_CATEGORIES.join(', ')}`, 400);
  }
  return value as RouteCategory;
}

export function sanitizeRoutePayloadForRole<T extends Record<string, unknown>>(
  payload: T,
  role: UserRole | null | undefined
): T {
  if (canViewRouteCategory(role)) return payload;
  const { routeCategory: _removed, ...rest } = payload;
  return rest as T;
}
