import { randomUUID } from 'node:crypto';

export type AvatarStatus = 'temporary' | 'active' | 'superseded';

export interface ProfileImageRecord {
  imageId: string;
  ownerUserId: string;
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp';
  byteSize: number;
  data: Buffer;
  publicUrl: string;
  status: AvatarStatus;
  createdAt: string;
  expiresAt: string | null;
}

export class AvatarStorage {
  private readonly images = new Map<string, ProfileImageRecord>();

  create(ownerUserId: string, data: Buffer, mediaType: ProfileImageRecord['mediaType']): ProfileImageRecord {
    const imageId = `img_${randomUUID()}`;
    const record: ProfileImageRecord = {
      imageId,
      ownerUserId,
      mediaType,
      byteSize: data.byteLength,
      data,
      publicUrl: `data:${mediaType};base64,${data.toString('base64')}`,
      status: 'temporary',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60_000).toISOString()
    };
    this.images.set(imageId, record);
    return record;
  }

  findOwnedBindable(ownerUserId: string, imageId: string): ProfileImageRecord | null {
    const image = this.images.get(imageId);
    if (!image || image.ownerUserId !== ownerUserId) return null;
    if (image.status === 'temporary' && image.expiresAt && image.expiresAt <= new Date().toISOString()) return null;
    return image.status === 'temporary' || image.status === 'active' ? image : null;
  }

  activate(ownerUserId: string, imageId: string): ProfileImageRecord | null {
    const next = this.findOwnedBindable(ownerUserId, imageId);
    if (!next) return null;
    for (const image of this.images.values()) {
      if (image.ownerUserId === ownerUserId && image.status === 'active' && image.imageId !== imageId) {
        image.status = 'superseded';
      }
    }
    next.status = 'active';
    next.expiresAt = null;
    return next;
  }
}

export const avatarStorage = new AvatarStorage();
