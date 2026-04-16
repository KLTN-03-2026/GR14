const specialCharsRegex = /[<>{}$`\\|;]/;

export function hasSpecialChars(value: string): boolean {
  return specialCharsRegex.test(value);
}

export function validateFieldsNoSpecialChars(
  fields: (string | undefined | null)[],
): boolean {
  return fields.some((field) => field && hasSpecialChars(field));
}
