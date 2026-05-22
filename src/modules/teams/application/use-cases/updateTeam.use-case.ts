import { IUserRepository } from '../../../auth/domain/interfaces/user-repository.interface';
import { ITeamRepository } from '../../domain/interfaces/team-repository.interface';
import { UserRole } from '../../../../shared/constants/roles';
import { AppError } from '../../../../shared/errors/app-error';
import { GetTeamDetailUseCase } from './getTeamDetail.use-case';

export interface UpdateTeamDTO {
  name?: string;
  teamLeadId?: string | null;
  driverIds?: string[];
}

export class UpdateTeamUseCase {
  constructor(
    private teamRepo: ITeamRepository,
    private userRepo: IUserRepository
  ) {}

  async execute(teamId: string, dto: UpdateTeamDTO) {
    const team = await this.teamRepo.findById(teamId);
    if (!team) throw new AppError('Team not found', 404);

    if (dto.name !== undefined && dto.name.trim().length < 2) {
      throw new AppError('Team name must be at least 2 characters.', 400);
    }

    if (dto.teamLeadId !== undefined) {
      if (dto.teamLeadId) {
        const lead = await this.userRepo.findById(dto.teamLeadId);
        if (!lead) throw new AppError('Team lead user not found', 404);
        if (lead.role !== UserRole.TEAM_LEAD) {
          throw new AppError('Selected user must have the team lead role.', 400);
        }
        await this.userRepo.update(dto.teamLeadId, { teamId });
      }
      await this.teamRepo.update(teamId, {
        name: dto.name?.trim(),
        teamLeadId: dto.teamLeadId,
      });
    } else if (dto.name !== undefined) {
      await this.teamRepo.update(teamId, { name: dto.name.trim() });
    }

    if (dto.driverIds !== undefined) {
      const currentMembers = await this.userRepo.findManyByTeamId(teamId);
      const currentDrivers = currentMembers.filter((m) => m.role === UserRole.DRIVER);

      for (const driverId of dto.driverIds) {
        const driver = await this.userRepo.findById(driverId);
        if (!driver) throw new AppError(`Driver not found: ${driverId}`, 404);
        if (driver.role !== UserRole.DRIVER) {
          throw new AppError(`${driver.email} is not a driver.`, 400);
        }
        await this.userRepo.updateTeamId(driverId, teamId);
      }

      for (const driver of currentDrivers) {
        if (!dto.driverIds.includes(driver.id!)) {
          await this.userRepo.updateTeamId(driver.id!, null);
        }
      }
    }

    return new GetTeamDetailUseCase(this.teamRepo, this.userRepo).execute(teamId);
  }
}
