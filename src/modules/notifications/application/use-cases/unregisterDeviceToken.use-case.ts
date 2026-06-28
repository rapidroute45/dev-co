import { IDeviceTokenRepository } from '../../domain/interfaces/device-token-repository.interface';

export class UnregisterDeviceTokenUseCase {
  constructor(private deviceTokenRepo: IDeviceTokenRepository) {}

  async execute(input: { userId: string; token?: string }) {
    const removed = await this.deviceTokenRepo.removeForUser(input.userId, input.token?.trim());
    return { removed };
  }
}
