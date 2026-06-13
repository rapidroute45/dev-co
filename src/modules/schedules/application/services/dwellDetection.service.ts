import { RouteDwellStatus } from '../../../../shared/constants/routeDwellStatuses';
import {
  DWELL_RADIUS_METERS,
  DWELL_THRESHOLD_MINUTES,
  DWELL_THRESHOLD_MS,
} from '../../../../shared/constants/dwellDetection';
import { UserRole } from '../../../../shared/constants/roles';
import { IUserRepository } from '../../../auth/domain/interfaces/user-repository.interface';
import { NotificationService } from '../../../notifications/application/services/notification.service';
import { ITeamRepository } from '../../../teams/domain/interfaces/team-repository.interface';
import { IRouteRepository } from '../../domain/interfaces/route-repository.interface';
import { IScheduleRepository } from '../../domain/interfaces/schedule-repository.interface';
import { RouteDwellSessionRepository } from '../../infrastructure/repositories/routeDwellSession.repository';
import { haversineMeters } from '../utils/haversine';
import { emitDriverStationaryAlert } from '../../../chat/socket/chat.socket';

export type DwellEvaluationResult = {
  active: boolean;
  minutes: number;
  alertSent: boolean;
  sessionId: string | null;
  startedAt: string | null;
};

export class DwellDetectionService {
  constructor(
    private dwellSessionRepo: RouteDwellSessionRepository,
    private teamRepo: ITeamRepository,
    private userRepo: IUserRepository,
    private notificationService: NotificationService,
    private routeRepo: IRouteRepository,
    private scheduleRepo: IScheduleRepository
  ) {}

  async evaluateLocationPing(params: {
    routeId: string;
    driverId: string;
    teamId: string;
    lat: number;
    lng: number;
    recordedAt: Date;
  }): Promise<DwellEvaluationResult> {
    const { routeId, driverId, teamId, lat, lng, recordedAt } = params;
    let session = await this.dwellSessionRepo.findActiveByRoute(routeId);

    if (!session) {
      session = await this.startSession({
        routeId,
        driverId,
        teamId,
        lat,
        lng,
        recordedAt,
      });
      const result = this.toResult(session, recordedAt);
      console.log('[dwell-eval]', {
        routeId,
        event: 'session_started',
        lat,
        lng,
        ...result,
      });
      return result;
    }

    const distanceM = haversineMeters(session.centerLat, session.centerLng, lat, lng);
    const radius = session.radiusMeters ?? DWELL_RADIUS_METERS;

    if (distanceM <= radius) {
      session =
        (await this.dwellSessionRepo.updateById(session.id, {
          lastSeenAt: recordedAt,
        })) ?? session;

      const dwellMs = recordedAt.getTime() - session.startedAt.getTime();
      // Always use live config — old sessions may have thresholdMinutes: 20 stored in Mongo.
      const thresholdMs = DWELL_THRESHOLD_MS;

      if (dwellMs >= thresholdMs && session.alertSentAt) {
        console.log('[dwell-eval]', {
          routeId,
          event: 'threshold_met_but_alert_already_sent',
          dwellMs,
          alertSentAt: session.alertSentAt,
        });
      }

      if (dwellMs >= thresholdMs && !session.alertSentAt) {
        const alertResult = await this.sendDwellAlert(session, dwellMs, recordedAt);
        if (alertResult.notificationIds.length > 0) {
          session =
            (await this.dwellSessionRepo.updateById(session.id, {
              alertSentAt: recordedAt,
              alertNotificationId: alertResult.notificationIds[0] ?? null,
            })) ?? session;
          console.info(
            `[dwell] Alert sent route=${session.routeId} recipients=${alertResult.recipientIds.length} minutes~${Math.floor(dwellMs / 60_000)} thresholdMin=${DWELL_THRESHOLD_MINUTES}`
          );
        } else {
          console.warn(
            `[dwell] Threshold reached but no notifications created route=${session.routeId} — check dispatch manager/admin users are active in DB`
          );
        }
      }

      const result = this.toResult(session, recordedAt);
      console.log('[dwell-eval]', {
        routeId,
        event: session.alertSentAt ? 'still_within_radius_alert_sent' : 'within_radius',
        distanceM: Math.round(distanceM),
        radiusM: radius,
        dwellMs,
        thresholdMin: DWELL_THRESHOLD_MINUTES,
        ...result,
      });
      return result;
    }

    await this.dwellSessionRepo.updateById(session.id, {
      status: RouteDwellStatus.RESOLVED,
      endedAt: recordedAt,
    });

    const next = await this.startSession({
      routeId,
      driverId,
      teamId,
      lat,
      lng,
      recordedAt,
    });
    const result = this.toResult(next, recordedAt);
    console.log('[dwell-eval]', {
      routeId,
      event: 'moved_outside_radius_new_session',
      distanceM: Math.round(distanceM),
      radiusM: radius,
      ...result,
    });
    return result;
  }

  async resolveActiveSessions(routeId: string): Promise<void> {
    await this.dwellSessionRepo.resolveActiveByRoute(routeId, new Date());
  }

  private async startSession(params: {
    routeId: string;
    driverId: string;
    teamId: string;
    lat: number;
    lng: number;
    recordedAt: Date;
  }) {
    const team = await this.teamRepo.findById(params.teamId);
    return this.dwellSessionRepo.create({
      routeId: params.routeId,
      driverId: params.driverId,
      teamId: params.teamId,
      teamLeadId: team?.teamLeadId ?? null,
      centerLat: params.lat,
      centerLng: params.lng,
      startedAt: params.recordedAt,
    });
  }

  private async sendDwellAlert(
    session: {
      id: string;
      routeId: string;
      driverId: string;
      teamLeadId: string | null;
      centerLat: number;
      centerLng: number;
      startedAt: Date;
    },
    dwellMs: number,
    _recordedAt: Date
  ): Promise<{ notificationIds: string[]; recipientIds: string[] }> {
    const route = await this.routeRepo.findById(session.routeId);
    const schedule = route ? await this.scheduleRepo.findById(route.scheduleId) : null;

    const recipientIds = await this.resolveDwellAlertRecipients(
      session.teamLeadId,
      schedule?.city
    );
    console.log('[dwell-notify]', {
      routeId: session.routeId,
      dwellSessionId: session.id,
      recipientCount: recipientIds.length,
      recipientIds,
    });
    if (recipientIds.length === 0) {
      return { notificationIds: [], recipientIds: [] };
    }

    const driver = await this.userRepo.findById(session.driverId);
    const driverName =
      driver?.fullName?.trim() || driver?.email?.split('@')[0] || 'Driver';
    const dwellMinutes = Math.max(
      DWELL_THRESHOLD_MINUTES,
      Math.floor(dwellMs / 60_000)
    );

    const notifications = await this.notificationService.notifyDriverDwelling({
      recipientIds,
      routeId: session.routeId,
      driverId: session.driverId,
      driverName,
      dwellSessionId: session.id,
      centerLat: session.centerLat,
      centerLng: session.centerLng,
      dwellMinutes,
      startedAt: session.startedAt.toISOString(),
    });

    emitDriverStationaryAlert({
      routeId: session.routeId,
      scheduleId: route?.scheduleId ?? '',
      driverId: session.driverId,
      driverName,
      dwellMinutes,
      lat: session.centerLat,
      lng: session.centerLng,
      city: schedule?.city ?? '',
      state: schedule?.state ?? '',
      routeName: route?.routeName ?? null,
    });

    return {
      notificationIds: notifications.map((n) => n.id).filter((id): id is string => Boolean(id)),
      recipientIds,
    };
  }

  /** Admins, dispatch managers, dispatch team (city), and optional team lead. */
  private async resolveDwellAlertRecipients(
    teamLeadId: string | null,
    scheduleCity?: string | null
  ): Promise<string[]> {
    const ids = new Set<string>();

    const opsUsers = await this.userRepo.findActiveByRoles([
      UserRole.ADMIN,
      UserRole.DISPATCH_MANAGER,
    ]);

    let managerCount = 0;
    let adminCount = 0;
    for (const u of opsUsers) {
      if (!u.id) continue;
      ids.add(u.id);
      if (u.role === UserRole.DISPATCH_MANAGER) managerCount += 1;
      if (u.role === UserRole.ADMIN) adminCount += 1;
    }

    if (adminCount === 0) {
      console.warn(
        '[dwell] No active admin user in DB — create a user with role "admin" and status "active"'
      );
    }

    if (scheduleCity?.trim()) {
      const dispatchTeam = await this.userRepo.findActiveDispatchTeamMembersByCity(
        scheduleCity.trim()
      );
      for (const member of dispatchTeam) {
        if (member.id) ids.add(member.id);
      }
    }

    if (teamLeadId) ids.add(teamLeadId);

    return [...ids];
  }

  private toResult(
    session: {
      id: string;
      startedAt: Date;
      alertSentAt: Date | null;
      status: RouteDwellStatus;
    },
    at: Date
  ): DwellEvaluationResult {
    const dwellMs = at.getTime() - session.startedAt.getTime();
    const minutes = Math.max(0, Math.floor(dwellMs / 60_000));
    return {
      active: session.status === RouteDwellStatus.ACTIVE,
      minutes,
      alertSent: Boolean(session.alertSentAt),
      sessionId: session.id,
      startedAt: session.startedAt.toISOString(),
    };
  }
}
