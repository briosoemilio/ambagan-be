import {z} from "zod";

export const AmbagSchema = z.object({
  projectId: z.string(),
  amount: z.number(),
  note: z.string().optional(),
  receipt: z
    .object({
      photoUrl: z.string().url(),
      uploadId: z.string(),
    })
    .optional(),
});

export type Ambag = z.infer<typeof AmbagSchema>;
