const MAX_SLUG_LENGTH = 48;

const removeDiacritics = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');

export const toSlug = (text: string): string =>
  removeDiacritics(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG_LENGTH);

export const randomSuffix = (): string =>
  Math.random().toString(36).slice(2, 8);
