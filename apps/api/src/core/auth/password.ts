import { hash, verify } from '@node-rs/argon2';

export const hashPassword = (plain: string): Promise<string> => hash(plain);
export const verifyPassword = async (
  plain: string,
  hashed: string,
): Promise<boolean> => {
  try {
    return await verify(hashed, plain);
  } catch {
    return false;
  }
};
