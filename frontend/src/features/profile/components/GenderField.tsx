import type { ProfileGender } from '@spec/shared-schemas';

interface Props { value: ProfileGender; onChange: (value: ProfileGender) => void; error?: string }

const options: Array<[Exclude<ProfileGender, null>, string]> = [
  ['female', '女'], ['male', '男'], ['other', '其他'], ['undisclosed', '不公开']
];

export function GenderField({ value, onChange, error }: Props) {
  return (
    <fieldset className="profile-fieldset" aria-describedby={error ? 'gender-error' : undefined}>
      <legend>性别（选填）</legend>
      <div className="radio-row">
        {options.map(([key, label]) => (
          <label key={key}><input type="radio" name="gender" checked={value === key} onChange={() => onChange(key)} />{label}</label>
        ))}
      </div>
      <button type="button" className="text-btn" onClick={() => onChange(null)}>清除性别</button>
      {error ? <span id="gender-error" className="error-text">{error}</span> : null}
    </fieldset>
  );
}
