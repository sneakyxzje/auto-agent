import sharp from 'sharp';

export const MAX_IMAGE_EDGE = 1536;

export type NormalizedImage = {
  data: Buffer;
  width: number;
  height: number;
  bytes: number;
};

export const normalizeImage = async (
  buffer: Buffer,
): Promise<NormalizedImage> => {
  const { data, info } = await sharp(buffer)
    .rotate()
    .resize(MAX_IMAGE_EDGE, MAX_IMAGE_EDGE, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .toBuffer({ resolveWithObject: true });

  return { data, width: info.width, height: info.height, bytes: info.size };
};
