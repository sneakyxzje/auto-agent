import { z } from 'zod';
import { departmentSlugSchema } from './common.js';

export const departmentSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1).max(255),
  slug: departmentSlugSchema,
  description: z.string().nullable(),
  isActive: z.boolean(),
});
export type Department = z.infer<typeof departmentSchema>;

export const createDepartmentSchema = z.object({
  name: z.string().min(1).max(255),
  slug: departmentSlugSchema,
  description: z.string().max(2000).nullish().default(null),
});
export type CreateDepartment = z.infer<typeof createDepartmentSchema>;

export const updateDepartmentSchema = createDepartmentSchema
  .omit({ slug: true })
  .extend({ isActive: z.boolean() })
  .partial();
export type UpdateDepartment = z.infer<typeof updateDepartmentSchema>;
