import { Router } from 'express';
import multer from 'multer';
import sharp, { type Metadata } from 'sharp';
import { ErrorCode } from '@spec/shared-schemas';
import { requireAuth } from '../../common/middleware/require-auth.js';
import { ApiError, ok } from '../../common/filters/response-filter.js';
import { profileService } from './profile.instance.js';
import { avatarStorage } from './avatar-storage.js';
import { securityLog } from '../../common/logs/security-log.service.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
const allowed = new Set(['jpeg', 'png', 'webp']);

export const profileRouter = Router();
profileRouter.use(requireAuth);

profileRouter.get('/', (req, res, next) => {
  try {
    ok(res, profileService.get(req.auth!.sub));
  } catch (error) {
    next(error);
  }
});

profileRouter.patch('/', (req, res, next) => {
  try {
    const profile = profileService.update(req.auth!.sub, req.body);
    void securityLog.write(req, { eventType: 'PROFILE_UPDATED', actorType: 'USER', actorRef: req.auth!.sub, result: 'ALLOWED', details: { version: profile.version } });
    ok(res, profile);
  } catch (error) {
    if (error instanceof ApiError && error.code === ErrorCode.PROFILE_CONFLICT) {
      void securityLog.write(req, { eventType: 'PROFILE_CONFLICT', actorType: 'USER', actorRef: req.auth!.sub, result: 'BLOCKED', details: { reason: 'stale-version' } });
    }
    next(error);
  }
});

profileRouter.post('/avatar', (req, res, next) => {
  upload.single('avatar')(req, res, async (uploadError) => {
    try {
      if (uploadError instanceof multer.MulterError && uploadError.code === 'LIMIT_FILE_SIZE') {
        throw new ApiError(ErrorCode.AVATAR_TOO_LARGE, 413, '头像图片不能超过 5 MB');
      }
      if (uploadError) throw uploadError;
      if (!req.file) throw new ApiError(ErrorCode.AVATAR_CORRUPT, 400, '头像文件无法读取，请重新选择');

      let metadata: Metadata;
      try {
        metadata = await sharp(req.file.buffer).metadata();
      } catch {
        throw new ApiError(ErrorCode.AVATAR_CORRUPT, 400, '头像文件无法读取，请重新选择');
      }
      if (!metadata.format || !allowed.has(metadata.format)) {
        throw new ApiError(ErrorCode.AVATAR_TYPE, 400, '请选择 JPEG、PNG 或 WebP 图片');
      }
      const normalized = await sharp(req.file.buffer)
        .rotate()
        .resize(512, 512, { fit: 'cover', withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer();
      const image = avatarStorage.create(req.auth!.sub, normalized, 'image/webp');
      void securityLog.write(req, { eventType: 'PROFILE_AVATAR_UPLOADED', actorType: 'USER', actorRef: req.auth!.sub, result: 'ALLOWED', details: { imageId: image.imageId, byteSize: image.byteSize, mediaType: image.mediaType } });
      res.status(201);
      ok(res, {
        imageId: image.imageId,
        previewUrl: image.publicUrl,
        mediaType: image.mediaType,
        byteSize: image.byteSize,
        expiresAt: image.expiresAt
      });
    } catch (error) {
      next(error);
    }
  });
});
