import { UserRole } from '../../../../shared/constants/roles';
import { TeamLeadScheduleAlertService } from '../services/teamLeadScheduleAlert.service';

export class ListTeamLeadScheduleAlertsUseCase {
  constructor(private alertService: TeamLeadScheduleAlertService) {}

  async execute(actor?: { id?: string; role?: UserRole | null }) {
    if (actor?.role !== UserRole.TEAM_LEAD || !actor.id) {
      return [];
    }
    return this.alertService.listPending(actor.id);
  }
}
