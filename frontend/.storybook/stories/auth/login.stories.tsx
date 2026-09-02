/**
 * T050 Login 5 组件 Storybook 快照 + axe-core a11y 断言
 */
import type { Meta, StoryObj } from '@storybook/react';
import { MemoryRouter } from 'react-router-dom';
import { LoginForm } from '../../../src/features/auth/components/LoginForm';
import { PhoneInput } from '../../../src/features/auth/components/PhoneInput';
import { CodeInput } from '../../../src/features/auth/components/CodeInput';
import { PasswordInput } from '../../../src/features/auth/components/PasswordInput';
import { CountdownButton } from '../../../src/features/auth/components/CountdownButton';

const meta: Meta<typeof LoginForm> = {
  title: 'Auth/LoginForm',
  component: LoginForm,
  decorators: [(Story) => <MemoryRouter>{Story()}</MemoryRouter>]
};
export default meta;

export const Default: StoryObj = {};

export const PhoneInputDefault: StoryObj<typeof PhoneInput> = {
  render: () => <PhoneInput id="p" value="" onChange={() => {}} />
};

export const PhoneInputError: StoryObj<typeof PhoneInput> = {
  render: () => <PhoneInput id="p" value="123" error="请输入正确的 11 位手机号" onChange={() => {}} />
};

export const CodeInputDefault: StoryObj<typeof CodeInput> = {
  render: () => <CodeInput id="c" value="" onChange={() => {}} />
};

export const PasswordInputDefault: StoryObj<typeof PasswordInput> = {
  render: () => <PasswordInput id="pw" value="" onChange={() => {}} />
};

export const CountdownButtonIdle: StoryObj<typeof CountdownButton> = {
  render: () => <CountdownButton onSend={() => {}} />
};

export const CountdownButtonDisabled: StoryObj<typeof CountdownButton> = {
  render: () => <CountdownButton disabled onSend={() => {}} />
};
