interface Props { previewUrl: string; nickname: string; error?: string; onChoose: (file: File) => void }

export function AvatarField({ previewUrl, nickname, error, onChoose }: Props) {
  return (
    <div className="avatar-field field">
      <span className="field-label">头像（选填）</span>
      <div className="avatar-preview">
        {previewUrl ? <img src={previewUrl} alt="新头像预览" width={96} height={96} /> : <span aria-hidden="true">{nickname.trim().slice(0, 1) || 'U'}</span>}
      </div>
      <label className="file-btn" htmlFor="avatar">选择头像</label>
      <input id="avatar" className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" aria-describedby={`avatar-help${error ? ' avatar-error' : ''}`} onChange={(event) => { const file = event.target.files?.[0]; if (file) onChoose(file); event.target.value = ''; }} />
      <span id="avatar-help" className="field-hint">JPEG、PNG 或 WebP，最大 5 MB</span>
      {error ? <span id="avatar-error" className="error-text">{error}</span> : null}
    </div>
  );
}
