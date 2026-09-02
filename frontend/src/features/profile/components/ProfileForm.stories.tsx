import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import type { ProfileGender } from '@spec/shared-schemas';
import { AvatarField } from './AvatarField';
import { BirthdayField } from './BirthdayField';
import { GenderField } from './GenderField';
import { TextField } from './TextField';

function ProfileFieldsPreview() {
  const [nickname, setNickname] = useState('用户昵称');
  const [bio, setBio] = useState('保持好奇。');
  const [gender, setGender] = useState<ProfileGender>('undisclosed');
  const [birthDate, setBirthDate] = useState<string | null>('1995-08-20');
  return <main className="profile-page"><form className="profile-form">
    <AvatarField previewUrl="" nickname={nickname} onChoose={() => undefined} />
    <TextField id="story-nickname" label="昵称" value={nickname} maxLength={30} required onChange={setNickname} />
    <TextField id="story-bio" label="个人简介（选填）" value={bio} maxLength={200} multiline onChange={setBio} />
    <GenderField value={gender} onChange={setGender} />
    <BirthdayField value={birthDate} onChange={setBirthDate} />
  </form></main>;
}

const meta = { title: 'Profile/Profile form states', component: ProfileFieldsPreview, parameters: { a11y: { disable: false } } } satisfies Meta<typeof ProfileFieldsPreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const DefaultForm: Story = {};
export const TextFieldError: Story = { render: () => <TextField id="story-error" label="昵称" value="" maxLength={30} required error="昵称需为 2 至 30 个可见字符" onChange={() => undefined} /> };
export const TextFieldDisabled: Story = { render: () => <TextField id="story-disabled" label="昵称" value="只读状态" maxLength={30} disabled onChange={() => undefined} /> };
export const AvatarUploading: Story = { render: () => <AvatarField previewUrl="" nickname="用户" progress={48} disabled onChoose={() => undefined} /> };
export const AvatarError: Story = { render: () => <AvatarField previewUrl="" nickname="用户" error="头像图片不能超过 5 MB" onChoose={() => undefined} /> };
export const GenderKeyboard: Story = {
  render: () => <GenderField value="female" onChange={() => undefined} />,
  play: async ({ canvasElement }) => {
    const firstRadio = canvasElement.querySelector<HTMLInputElement>('input[type="radio"]');
    firstRadio?.focus();
    firstRadio?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  }
};
export const GenderError: Story = { render: () => <GenderField value={null} error="请选择有效的性别选项" onChange={() => undefined} /> };
export const BirthdayDefault: Story = { render: () => <BirthdayField value="1995-08-20" onChange={() => undefined} /> };
export const BirthdayError: Story = { render: () => <BirthdayField value={null} error="生日不能晚于今天" onChange={() => undefined} /> };
export const AccessibilityLabels: Story = { render: () => <main aria-label="个人资料无障碍示例"><ProfileFieldsPreview /></main> };
