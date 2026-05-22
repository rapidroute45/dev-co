import { IUserRepository } from '../../domain/interfaces/user-repository.interface';
import { mapUserToResponse } from '../../../users/application/mappers/userResponse.mapper';

/** Users awaiting role assignment (registered without role). */
export class GetPendingUsersUseCase {
  constructor(private userRepo: IUserRepository) {}

  async execute() {
    const users = await this.userRepo.findMany({ pendingApproval: true });
    return users.map((user) => mapUserToResponse(user, null));
  }
}
