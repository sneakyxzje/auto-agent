'use client';

import {
  IMAGE_EXTENSIONS,
  MAX_IMAGE_BYTES,
  MAX_IMAGES_PER_MESSAGE,
} from '@chatbot/contracts';
import { useCallback, useRef, useState } from 'react';
import { uploadImage } from './api';

export type PendingImage = {
  localId: string;
  previewUrl: string;
  imageId: string | null;
  error: string | null;
};

const extensionOf = (name: string): string =>
  name.slice(name.lastIndexOf('.') + 1).toLowerCase();

const validate = (file: File): string | null => {
  if (
    !(IMAGE_EXTENSIONS as readonly string[]).includes(extensionOf(file.name))
  ) {
    return `Chỉ nhận ảnh ${IMAGE_EXTENSIONS.join(', ')}`;
  }
  if (file.size > MAX_IMAGE_BYTES) return 'Ảnh vượt quá 10MB';

  return null;
};

export const useImageAttachments = () => {
  const [images, setImages] = useState<PendingImage[]>([]);
  const counterRef = useRef(0);

  const patch = useCallback(
    (localId: string, changes: Partial<PendingImage>) => {
      setImages((current) =>
        current.map((image) =>
          image.localId === localId ? { ...image, ...changes } : image,
        ),
      );
    },
    [],
  );

  const add = useCallback(
    (files: File[]) => {
      setImages((current) => {
        const room = MAX_IMAGES_PER_MESSAGE - current.length;
        const accepted = files.slice(0, Math.max(room, 0));
        const additions: PendingImage[] = [];

        for (const file of accepted) {
          counterRef.current += 1;
          const localId = `img-${counterRef.current}`;
          const invalid = validate(file);

          additions.push({
            localId,
            previewUrl: URL.createObjectURL(file),
            imageId: null,
            error: invalid,
          });

          if (invalid === null) {
            void uploadImage(file)
              .then((asset) => patch(localId, { imageId: asset.id }))
              .catch((error: unknown) =>
                patch(localId, {
                  error:
                    error instanceof Error
                      ? error.message
                      : 'Không tải được ảnh lên',
                }),
              );
          }
        }

        return [...current, ...additions];
      });
    },
    [patch],
  );

  const remove = useCallback((localId: string) => {
    setImages((current) => {
      const target = current.find((image) => image.localId === localId);
      if (target !== undefined) URL.revokeObjectURL(target.previewUrl);

      return current.filter((image) => image.localId !== localId);
    });
  }, []);

  const clear = useCallback(() => {
    setImages((current) => {
      for (const image of current) URL.revokeObjectURL(image.previewUrl);

      return [];
    });
  }, []);

  const uploading = images.some(
    (image) => image.imageId === null && image.error === null,
  );
  const readyIds = images
    .map((image) => image.imageId)
    .filter((id): id is string => id !== null);

  return { images, add, remove, clear, uploading, readyIds };
};
