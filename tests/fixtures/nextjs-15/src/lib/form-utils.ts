export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validateRequired(value: string): boolean {
  return value.trim().length > 0;
}

export function validateMinLength(value: string, min: number): boolean {
  return value.length >= min;
}

interface FieldError {
  field: string;
  message: string;
}

export function formatErrors(errors: FieldError[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const error of errors) {
    result[error.field] = error.message;
  }
  return result;
}
