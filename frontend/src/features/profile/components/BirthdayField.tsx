interface Props { value: string | null; onChange: (value: string | null) => void; error?: string }

export function BirthdayField({ value, onChange, error }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="field">
      <label htmlFor="birthDate">生日（选填）</label>
      <input id="birthDate" type="date" value={value ?? ''} max={today} aria-invalid={!!error} aria-describedby={error ? 'birthDate-error' : undefined} onChange={(event) => onChange(event.target.value || null)} />
      {value ? <button type="button" className="text-btn" onClick={() => onChange(null)}>清除生日</button> : null}
      {error ? <span id="birthDate-error" className="error-text">{error}</span> : null}
    </div>
  );
}
