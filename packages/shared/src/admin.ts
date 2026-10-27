import { z } from "zod";

export const adminLoginInputSchema = z.object({
  email: z.email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(256),
}).strict();

export const adminBootstrapInputSchema = z.object({
  email: z.email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(12).max(256),
}).strict();

export type AdminLoginInput = z.infer<typeof adminLoginInputSchema>;
export type AdminBootstrapInput = z.infer<typeof adminBootstrapInputSchema>;
