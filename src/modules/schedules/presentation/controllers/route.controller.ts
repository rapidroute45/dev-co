import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../../../shared/errors/app-error';
import { CreateRouteUseCase } from '../../application/use-cases/createRoute.use-case';
import { GetRouteUseCase } from '../../application/use-cases/getRoute.use-case';
import { UpdateRouteUseCase } from '../../application/use-cases/updateRoute.use-case';
import { DeleteRouteUseCase } from '../../application/use-cases/deleteRoute.use-case';
import { AcceptRouteUseCase } from '../../application/use-cases/acceptRoute.use-case';
import { DeclineRouteUseCase } from '../../application/use-cases/declineRoute.use-case';
import { ListPendingRouteOffersUseCase } from '../../application/use-cases/listPendingRouteOffers.use-case';
import { ListRoutesUseCase } from '../../application/use-cases/listRoutes.use-case';
import { ListMyRoutesUseCase } from '../../application/use-cases/listMyRoutes.use-case';
import { ListMyCompletedRoutesUseCase } from '../../application/use-cases/listMyCompletedRoutes.use-case';
import { StartRouteUseCase } from '../../application/use-cases/startRoute.use-case';
import { RouteDeliveryUseCase } from '../../application/use-cases/routeDelivery.use-case';
import { GetRouteTrackingUseCase } from '../../application/use-cases/getRouteTracking.use-case';
import { GetRoutePlannedSegmentUseCase } from '../../application/use-cases/getRoutePlannedSegment.use-case';
import { ListLiveRoutesUseCase } from '../../application/use-cases/listLiveRoutes.use-case';
import { sanitizeRoutePayloadForRole } from '../../../../shared/utils/routeCategoryAccess';
import { UserRole } from '../../../../shared/constants/roles';
import { RouteStopStatus } from '../../../../shared/constants/routeStopStatuses';

function sanitizeRouteData<T>(data: T, role: UserRole | null | undefined): T {
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeRoutePayloadForRole(item as Record<string, unknown>, role)) as T;
  }
  if (data && typeof data === 'object') {
    return sanitizeRoutePayloadForRole(data as Record<string, unknown>, role) as T;
  }
  return data;
}

export class RouteController {
  constructor(
    private createRouteUseCase: CreateRouteUseCase,
    private getRouteUseCase: GetRouteUseCase,
    private updateRouteUseCase: UpdateRouteUseCase,
    private deleteRouteUseCase: DeleteRouteUseCase,
    private acceptRouteUseCase: AcceptRouteUseCase,
    private declineRouteUseCase: DeclineRouteUseCase,
    private listPendingRouteOffersUseCase: ListPendingRouteOffersUseCase,
    private listRoutesUseCase: ListRoutesUseCase,
    private listMyRoutesUseCase: ListMyRoutesUseCase,
    private listMyCompletedRoutesUseCase: ListMyCompletedRoutesUseCase,
    private startRouteUseCase: StartRouteUseCase,
    private routeDeliveryUseCase: RouteDeliveryUseCase,
    private getRouteTrackingUseCase: GetRouteTrackingUseCase,
    private getRoutePlannedSegmentUseCase: GetRoutePlannedSegmentUseCase,
    private listLiveRoutesUseCase: ListLiveRoutesUseCase
  ) {}

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) return next(new AppError('Unauthorized', 401));
      const data = await this.createRouteUseCase.execute(req.body, req.user.id, req.user);
      res.status(201).json({
        success: true,
        message: 'Route created. Driver notified to accept the offer.',
        data: sanitizeRouteData(data, req.user.role),
      });
    } catch (error) {
      next(error);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.listRoutesUseCase.execute(
        req.query as Record<string, string>,
        req.user
      );
      res.status(200).json({
        success: true,
        data: sanitizeRouteData(result.items, req.user?.role),
        count: result.items.length,
        total: result.total,
        page: result.page,
        limit: result.limit,
      });
    } catch (error) {
      next(error);
    }
  };

  listMyRoutes = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) return next(new AppError('Unauthorized', 401));
      const result = await this.listMyRoutesUseCase.execute(
        req.user.id,
        req.query as Record<string, string>
      );
      res.status(200).json({
        success: true,
        data: sanitizeRouteData(result.items, req.user.role),
        count: result.count,
        date: result.date,
      });
    } catch (error) {
      next(error);
    }
  };

  listMyCompletedRoutes = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) return next(new AppError('Unauthorized', 401));
      const result = await this.listMyCompletedRoutesUseCase.execute(
        req.user.id,
        req.query as Record<string, string>
      );
      res.status(200).json({
        success: true,
        data: sanitizeRouteData(result.items, req.user.role),
        count: result.count,
      });
    } catch (error) {
      next(error);
    }
  };

  startRoute = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) return next(new AppError('Unauthorized', 401));
      const data = await this.startRouteUseCase.execute(
        String(req.params.id),
        req.user.id
      );
      res.status(200).json({
        success: true,
        message: 'Route started.',
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  listPendingOffers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) return next(new AppError('Unauthorized', 401));
      const data = await this.listPendingRouteOffersUseCase.execute(req.user.id);
      res.status(200).json({ success: true, data, count: data.length });
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.getRouteUseCase.execute(String(req.params.id), req.user);
      res.status(200).json({ success: true, data: sanitizeRouteData(data, req.user?.role) });
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) return next(new AppError('Unauthorized', 401));
      const data = await this.updateRouteUseCase.execute(
        String(req.params.id),
        req.body,
        req.user.id,
        req.user
      );
      res.status(200).json({
        success: true,
        message: 'Route updated successfully.',
        data: sanitizeRouteData(data, req.user.role),
      });
    } catch (error) {
      next(error);
    }
  };

  /** Team lead assigns/changes the driver on a route they own (sends an offer). */
  assignDriver = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) return next(new AppError('Unauthorized', 401));

      const { driverId } = req.body as { driverId?: string };
      if (!driverId) return next(new AppError('driverId is required.', 400));

      const route = await this.getRouteUseCase.execute(String(req.params.id), req.user);
      if (!req.user.teamId || route.teamId !== req.user.teamId) {
        return next(new AppError('You can only assign drivers to your own team routes.', 403));
      }

      const data = await this.updateRouteUseCase.execute(
        String(req.params.id),
        { driverId },
        req.user.id,
        req.user
      );
      res.status(200).json({
        success: true,
        message: 'Driver offer sent. The route stays pending until the driver accepts.',
        data: sanitizeRouteData(data, req.user.role),
      });
    } catch (error) {
      next(error);
    }
  };

  accept = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) return next(new AppError('Unauthorized', 401));
      const data = await this.acceptRouteUseCase.execute(String(req.params.id), req.user.id);
      res.status(200).json({
        success: true,
        message: 'Route accepted.',
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  decline = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) return next(new AppError('Unauthorized', 401));
      const data = await this.declineRouteUseCase.execute(String(req.params.id), req.user.id);
      res.status(200).json({
        success: true,
        message: 'Route declined.',
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.deleteRouteUseCase.execute(String(req.params.id), req.user);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  getTracking = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.getRouteTrackingUseCase.execute(
        String(req.params.id),
        req.user
      );
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  getPlannedSegment = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.getRoutePlannedSegmentUseCase.execute(
        String(req.params.id),
        req.user
      );
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  listLive = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.listLiveRoutesUseCase.execute(
        req.query as Record<string, string>,
        req.user
      );
      res.status(200).json({
        success: true,
        data: sanitizeRouteData(result.items, req.user?.role),
        date: result.date,
        count: result.items.length,
      });
    } catch (error) {
      next(error);
    }
  };

  reportLocation = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) return next(new AppError('Unauthorized', 401));
      const { lat, lng } = req.body as { lat?: number; lng?: number };
      const data = await this.routeDeliveryUseCase.reportCurrentLocation(
        String(req.params.id),
        req.user.id,
        Number(lat),
        Number(lng)
      );
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  reportLocationBatch = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) return next(new AppError('Unauthorized', 401));
      const body = req.body as {
        locations?: Array<{
          lat?: number;
          lng?: number;
          recordedAt?: string;
        }>;
        plannedStopId?: string;
        progressIndex?: number;
      };
      const rawLocations = Array.isArray(body.locations) ? body.locations : [];
      const points = rawLocations.map((point) => ({
        lat: Number(point?.lat),
        lng: Number(point?.lng),
        recordedAt: point?.recordedAt,
      }));
      const data = await this.routeDeliveryUseCase.reportLocationBatch(
        String(req.params.id),
        req.user.id,
        points,
        {
          plannedStopId: body.plannedStopId,
          progressIndex: body.progressIndex,
        }
      );
      res.status(200).json({ success: true, data });
    } catch (error) {
      console.error('[routes] reportLocationBatch failed', {
        routeId: req.params.id,
        pointCount: Array.isArray((req.body as { locations?: unknown[] })?.locations)
          ? (req.body as { locations: unknown[] }).locations.length
          : 0,
        error,
      });
      next(error);
    }
  };

  completeStop = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) return next(new AppError('Unauthorized', 401));
      const data = await this.routeDeliveryUseCase.completeStop(
        String(req.params.routeId),
        String(req.params.stopId),
        req.user.id
      );
      res.status(200).json({
        success: true,
        message: data.routeCompleted ? 'Stop completed. Route finished.' : 'Stop completed.',
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  returnStop = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) return next(new AppError('Unauthorized', 401));
      const { reason, customReason } = req.body as {
        reason?: string;
        customReason?: string;
      };
      if (!reason) return next(new AppError('reason is required.', 400));

      const data = await this.routeDeliveryUseCase.returnStop(
        String(req.params.routeId),
        String(req.params.stopId),
        req.user.id,
        reason,
        customReason
      );
      res.status(200).json({
        success: true,
        message: data.routeCompleted ? 'Stop marked as return. Route finished.' : 'Stop marked as return.',
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  opsCompleteStop = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.routeDeliveryUseCase.completeStopAsDispatch(
        String(req.params.routeId),
        String(req.params.stopId),
        req.user
      );
      res.status(200).json({
        success: true,
        message: data.routeCompleted ? 'Stop delivered. Route finished.' : 'Stop marked as delivered.',
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  opsReturnStop = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { reason, customReason } = req.body as {
        reason?: string;
        customReason?: string;
      };
      if (!reason) return next(new AppError('reason is required.', 400));

      const data = await this.routeDeliveryUseCase.returnStopAsDispatch(
        String(req.params.routeId),
        String(req.params.stopId),
        reason,
        customReason,
        req.user
      );
      res.status(200).json({
        success: true,
        message: data.routeCompleted ? 'Stop marked as failure. Route finished.' : 'Stop marked as failure.',
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  opsUpdateStopStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status, reason, customReason } = req.body as {
        status?: RouteStopStatus;
        reason?: string;
        customReason?: string;
      };
      if (!status) return next(new AppError('status is required.', 400));

      const data = await this.routeDeliveryUseCase.updateStopStatusAsDispatch(
        String(req.params.routeId),
        String(req.params.stopId),
        status,
        req.user,
        reason,
        customReason
      );
      res.status(200).json({
        success: true,
        message: 'Stop status updated.',
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  setAccessCode = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { accessCode } = req.body as { accessCode?: string };
      if (!accessCode) return next(new AppError('accessCode is required.', 400));

      const data = await this.routeDeliveryUseCase.setStopAccessCode(
        String(req.params.routeId),
        String(req.params.stopId),
        accessCode,
        req.user
      );
      res.status(200).json({ success: true, message: 'Access code saved.', data });
    } catch (error) {
      next(error);
    }
  };

  completeRoute = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) return next(new AppError('Unauthorized', 401));
      const data = await this.routeDeliveryUseCase.completeRoute(
        String(req.params.id),
        req.user.id
      );
      res.status(200).json({ success: true, message: 'Route completed.', data });
    } catch (error) {
      next(error);
    }
  };
}
