import axios from 'axios';
import type { ProfileUpdatePayload, UserProfile } from '@spec/shared-schemas';
import http from '../../../shared/services/http';

interface Envelope<T> {
  code: number;
  message: string;
  data: T;
  requestId: string;
}

export class ProfileRequestError extends Error {
  constructor(
    message: string,
    public readonly code: number,
    public readonly errors: Array<{ field: string; message: string }> = [],
    public readonly currentProfile?: UserProfile
  ) {
    super(message);
  }
}

function rethrow(error: unknown): never {
  if (axios.isAxiosError(error)) {
    const body = error.response?.data as
      | { code?: number; message?: string; errors?: Array<{ field: string; message: string }>; data?: { currentProfile?: UserProfile } }
      | undefined;
    throw new ProfileRequestError(
      body?.message ?? '网络异常，请检查网络连接',
      body?.code ?? -1,
      body?.errors ?? [],
      body?.data?.currentProfile
    );
  }
  throw error;
}

export async function getProfile(): Promise<UserProfile> {
  try {
    const response = await http.get<Envelope<UserProfile>>('/profile');
    return response.data.data;
  } catch (error) {
    rethrow(error);
  }
}

export async function updateProfile(payload: ProfileUpdatePayload): Promise<UserProfile> {
  try {
    const response = await http.patch<Envelope<UserProfile>>('/profile', payload);
    return response.data.data;
  } catch (error) {
    rethrow(error);
  }
}

export interface AvatarUploadResult {
  imageId: string;
  previewUrl: string;
  mediaType: string;
  byteSize: number;
  expiresAt: string;
}

export async function uploadAvatar(file: File, onProgress?: (percent: number) => void): Promise<AvatarUploadResult> {
  const form = new FormData();
  form.append('avatar', file);
  try {
    const response = await http.post<Envelope<AvatarUploadResult>>('/profile/avatar', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: ({ loaded, total }) => {
        if (total) onProgress?.(Math.min(100, Math.round((loaded / total) * 100)));
      }
    });
    return response.data.data;
  } catch (error) {
    rethrow(error);
  }
}
