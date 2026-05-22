import { normalizeAddress } from '../../application/utils/normalizeAddress';
import { AddressAccessCodeModel } from '../models/addressAccessCode.model';

export class AddressAccessCodeRepository {
  async findByAddress(address: string): Promise<string | null> {
    const normalized = normalizeAddress(address);
    const doc = await AddressAccessCodeModel.findOne({ normalizedAddress: normalized });
    return doc?.accessCode ?? null;
  }

  async upsert(address: string, accessCode: string, sampleName?: string): Promise<void> {
    const normalized = normalizeAddress(address);
    const code = accessCode.trim();
    if (!code) return;

    await AddressAccessCodeModel.findOneAndUpdate(
      { normalizedAddress: normalized },
      {
        $set: {
          accessCode: code,
          sampleName: sampleName?.trim() || null,
          lastUsedAt: new Date(),
        },
      },
      { upsert: true }
    );
  }
}
