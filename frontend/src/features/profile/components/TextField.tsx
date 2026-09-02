interface TextFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  maxLength: number;
  multiline?: boolean;
  required?: boolean;
}

export function TextField({ id, label, value, onChange, error, maxLength, multiline, required }: TextFieldProps) {
  const describedBy = `${id}-count${error ? ` ${id}-error` : ''}`;
  const common = {
    id,
    value,
    maxLength,
    required,
    'aria-invalid': !!error,
    'aria-describedby': describedBy,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(event.target.value)
  };
  return (
    <div className="field">
      <label htmlFor={id}>{label}{required ? ' *' : ''}</label>
      {multiline ? <textarea {...common} rows={5} /> : <input {...common} type="text" />}
      <span id={`${id}-count`} className="field-hint">{value.length}/{maxLength}</span>
      {error ? <span id={`${id}-error`} className="error-text">{error}</span> : null}
    </div>
  );
}
