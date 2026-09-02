import type { Meta, StoryObj } from '@storybook/react';
import { AvatarField } from './AvatarField';
import { BirthdayField } from './BirthdayField';
import { GenderField } from './GenderField';
import { TextField } from './TextField';

function ProfileFieldsPreview() {
  return <main className="profile-page"><form className="profile-form">
    <AvatarField previewUrl="" nickname="用户" onChoose={() => undefined} />
    <TextField id="story-nickname" label="昵称" value="用户昵称" maxLength={30} required onChange={() => undefined} />
    <TextField id="story-bio" label="个人简介（选填）" value="保持好奇。" maxLength={200} multiline onChange={() => undefined} />
    <GenderField value="undisclosed" onChange={() => undefined} />
    <BirthdayField value="1995-08-20" onChange={() => undefined} />
  </form></main>;
}

const meta = { title: 'Profile/Profile form fields', component: ProfileFieldsPreview, parameters: { a11y: { disable: false } } } satisfies Meta<typeof ProfileFieldsPreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const WithErrors: Story = { render: () => <TextField id="story-error" label="昵称" value="" maxLength={30} required error="昵称需为 2 至 30 个可见字符" onChange={() => undefined} /> };
