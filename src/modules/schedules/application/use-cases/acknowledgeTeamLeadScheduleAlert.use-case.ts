import { AppError } from '../../../../shared/errors/app-error';
import { UserRole } from '../../../../shared/constants/roles';
import { TeamLeadScheduleAlertService } from '../services/teamLeadScheduleAlert.service';

export class AcknowledgeTeamLeadScheduleAlertUseCase {
  constructor(private alertService: TeamLeadScheduleAlertService) {}

  async execute(
    scheduleId: string,
    actor?: { id?: string; role?: UserRole | null }
  ) {
    if (actor?.role !== UserRole.TEAM_LEAD || !actor.id) {
      throw new AppError('Only team leads can dismiss schedule alerts.', 403);
    }
    await this.alertService.acknowledgeSchedule(scheduleId, actor.id);
    return { success: true };
  }
}
