import { randomInt } from 'node:crypto';

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;

export const generateInviteCode = (): string =>
  Array.from(
    { length: CODE_LENGTH },
    () => ALPHABET[randomInt(ALPHABET.length)],
  ).join('');
