import type { FieldErrors } from '../lib/validation';

export function FieldError({ id, errors }: { id: string; errors: FieldErrors }) {
  if (!errors[id]) return null;
  return (
    <p id={`${id}-error`} className="field-error">
      {errors[id]}
    </p>
  );
}
