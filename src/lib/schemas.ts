/** Validación (Zod) de lo que se escribe en los formularios antes de guardarlo. */
import { z } from "zod";
import { SUBJECT_COLORS } from "@/lib/domain/subjects";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value));

/** Entero opcional escrito en un input: "" → null. */
const optionalInt = (min: number, max: number) =>
  z
    .string()
    .trim()
    .transform((value, ctx) => {
      if (value === "") return null;
      const number = Number(value);
      if (!Number.isInteger(number) || number < min || number > max) {
        ctx.addIssue({ code: "custom", message: "out_of_range" });
        return z.NEVER;
      }
      return number;
    });

export const subjectFormSchema = z.object({
  name: z.string().trim().min(1).max(120),
  commission: optionalText(60),
  teacher: optionalText(120),
  term_period: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]).nullable(),
  term_year: optionalInt(2000, 2100),
  credits: optionalInt(0, 99),
  color_key: z.enum(SUBJECT_COLORS),
});

export type SubjectFormInput = z.input<typeof subjectFormSchema>;
export type SubjectFormValues = z.output<typeof subjectFormSchema>;
