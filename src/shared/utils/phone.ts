import { AppError } from '../errors/app-error';

/** Trim and validate a phone number. */
export function parsePhoneInput(
  phone: string | undefined | null,
  options: { required?: boolean } = {}
): string | null {
  const { required = false } = options;
  const trimmed = phone?.trim() ?? '';

  if (!trimmed) {
    if (required) throw new AppError('Phone number is required.', 400);
    return null;
  }

  if (trimmed.length < 7) {
    throw new AppError('Enter a valid phone number.', 400);
  }

  return trimmed;
}
