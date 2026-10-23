import { useCallback, useState } from 'react';
import type { TestSettingsFormErrors, TestSettingsFormValues } from './test-settings-form';

export type UpdateTestSettings = (
  changeValues: (values: TestSettingsFormValues) => TestSettingsFormValues,
  changedField?: keyof TestSettingsFormErrors,
) => void;

export function useTestSettingsForm<Errors extends TestSettingsFormErrors>(
  initialValues: () => TestSettingsFormValues,
) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<Errors>({} as Errors);

  const updateValues: UpdateTestSettings = useCallback((changeValues, changedField) => {
    setValues(changeValues);
    if (changedField) {
      setErrors((currentErrors) => ({ ...currentErrors, [changedField]: undefined }));
    }
  }, []);

  return { values, errors, setErrors, updateValues };
}
