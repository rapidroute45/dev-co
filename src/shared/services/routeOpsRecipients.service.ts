import { UserRole } from '../constants/roles';
import { IUserRepository } from '../../modules/auth/domain/interfaces/user-repository.interface';

/** Admins, dispatch managers, and dispatch team members for a schedule city. */
export async function resolveRouteOpsRecipientIds(
  userRepo: IUserRepository,
  scheduleCity: string | null | undefined,
  excludeUserIds: string[] = []
): Promise<string[]> {
  const exclude = new Set(excludeUserIds.filter(Boolean));
  const ids = new Set<string>();

  const opsUsers = await userRepo.findActiveByRoles([
    UserRole.ADMIN,
    UserRole.DISPATCH_MANAGER,
  ]);
  for (const user of opsUsers) {
    if (user.id && !exclude.has(user.id)) ids.add(user.id);
  }

  if (scheduleCity?.trim()) {
    const dispatchTeam = await userRepo.findActiveDispatchTeamMembersByCity(scheduleCity.trim());
    for (const member of dispatchTeam) {
      if (member.id && !exclude.has(member.id)) ids.add(member.id);
    }
  }

  return [...ids];
}

/** Active admins and dispatch managers only (no dispatch team). */
export async function resolveManagerAndAdminRecipientIds(
  userRepo: IUserRepository,
  excludeUserIds: string[] = []
): Promise<string[]> {
  const exclude = new Set(excludeUserIds.filter(Boolean));
  const ids = new Set<string>();

  const opsUsers = await userRepo.findActiveByRoles([
    UserRole.ADMIN,
    UserRole.DISPATCH_MANAGER,
  ]);
  for (const user of opsUsers) {
    if (user.id && !exclude.has(user.id)) ids.add(user.id);
  }

  return [...ids];
}
