import { useCallback, useState } from 'react';

interface FormState<T> {
  values: T;
  errors: Partial<Record<keyof T, string>>;
  isSubmitting: boolean;
}

export function useForm<T extends Record<string, unknown>>(initialValues: T) {
  const [state, setState] = useState<FormState<T>>({
    values: initialValues,
    errors: {},
    isSubmitting: false,
  });

  const setValue = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    setState((s) => ({
      ...s,
      values: { ...s.values, [field]: value },
      errors: { ...s.errors, [field]: undefined },
    }));
  }, []);

  const setError = useCallback(<K extends keyof T>(field: K, message: string) => {
    setState((s) => ({
      ...s,
      errors: { ...s.errors, [field]: message },
    }));
  }, []);

  const reset = useCallback(() => {
    setState({ values: initialValues, errors: {}, isSubmitting: false });
  }, [initialValues]);

  return { ...state, setValue, setError, reset };
}
