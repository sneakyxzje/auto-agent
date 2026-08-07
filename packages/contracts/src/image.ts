import { z } from 'zod';

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'] as const;

export const MAX_IMAGES_PER_MESSAGE = 3;

export const imageAssetSchema = z.object({
  id: z.uuid(),
  width: z.number(),
  height: z.number(),
  mime: z.string(),
  hasText: z.boolean(),
});
export type ImageAssetSummary = z.infer<typeof imageAssetSchema>;
