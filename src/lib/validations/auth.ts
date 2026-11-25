import { z } from "zod";
import { DEMO_EMAILS } from "@/lib/demo-users";

export const demoSwitchSchema = z
  .object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .refine(
        (value): value is (typeof DEMO_EMAILS)[number] =>
          (DEMO_EMAILS as readonly string[]).includes(value),
        { message: "Invalid demo account email" }
      ),
  })
  .strict();

