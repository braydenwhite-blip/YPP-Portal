/**
 * Validates a string value against a Prisma enum.
 * Throws an error if the value is not a member of the enum.
 */
export function validateEnum<T extends Record<string, string>>(
  enumType: T,
  value: string,
  fieldName: string
): T[keyof T] {
  const validValues = Object.values(enumType);
  if (!validValues.includes(value)) {
    throw new Error(
      `Invalid value for ${fieldName}: "${value}". Must be one of: ${validValues.join(", ")}`
    );
  }
  return value as T[keyof T];
}
