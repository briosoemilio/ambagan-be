import {z} from "zod";

export const AmbagSchema = z.object({
  projectId: z.string(),
  amount: z.number(),
  note: z.string().optional(),
  photoUrl: z.string().url().optional(),
});

export type Ambag = z.infer<typeof AmbagSchema>;
