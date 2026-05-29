import { AppError } from '../../../../shared/errors/app-error';
import { Team } from '../../domain/entities/team.entity';
import { ITeamRepository } from '../../domain/interfaces/team-repository.interface';
import { CreateTeamDTO } from '../dto/create-team.dto';
import {
  buildTeamCodePrefix,
  formatTeamCode,
  nextTeamNumber,
} from '../utils/generateTeamCode';

export class CreateTeamUseCase {
  constructor(private teamRepo: ITeamRepository) {}

  async execute(dto: CreateTeamDTO, createdByUserId: string) {
    const name = dto.name?.trim();
    if (!name || name.length < 2) {
      throw new AppError('Team name must be at least 2 characters.', 400);
    }

    const prefix = buildTeamCodePrefix(name);
    const existingCount = await this.teamRepo.countByCodePrefix(prefix);
    const code = formatTeamCode(prefix, existingCount + 1);

    const existingCode = await this.teamRepo.findByCode(code);
    if (existingCode) {
      throw new AppError('Team code collision. Please try again.', 409);
    }

    const currentMax = await this.teamRepo.getMaxTeamNumber();
    const teamNumber = nextTeamNumber(currentMax);

    const team = new Team({
      name,
      code,
      teamNumber,
      createdBy: createdByUserId,
      teamLeadId: null,
    });

    const saved = await this.teamRepo.save(team);
    return {
      id: saved.id,
      name: saved.name,
      code: saved.code,
      teamNumber: saved.teamNumber,
      teamLeadId: saved.teamLeadId,
      createdBy: saved.createdBy,
      createdAt: saved.createdAt,
    };
  }
}
