import { RouteCategory } from '../../../../shared/constants/routeCategories';
import type { RouteRateTriple } from './storeBillingResolution.service';

export function storeBillingRateForCategory(
  rates: RouteRateTriple,
  category: RouteCategory
): number {
  switch (category) {
    case RouteCategory.MEDIUM:
      return rates.mediumRouteRate;
    case RouteCategory.FULL:
      return rates.fullRouteRate;
    case RouteCategory.SMALL:
    default:
      return rates.smallRouteRate;
  }
}
