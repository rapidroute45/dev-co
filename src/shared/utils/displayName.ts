export function displayNameFromEmail(email: string): string {
  const local = email.split('@')[0] ?? 'User';
  const part = local.split(/[._-]/)[0] ?? local;
  return part.charAt(0).toUpperCase() + part.slice(1);
}

export function resolveDisplayName(fullName: string | null | undefined, email: string): string {
  const trimmed = fullName?.trim();
  if (trimmed) return trimmed;
  return displayNameFromEmail(email);
}
