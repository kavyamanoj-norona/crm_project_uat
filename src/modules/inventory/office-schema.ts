import { z } from "zod";
import { requiredText } from "@/lib/form";

/** Consuming an office-use unit: who gets it and what it is used for. */
export const officeConsumeSchema = z.object({
  employeeId: requiredText("Employee"),
  remarks: requiredText("Remarks").pipe(z.string().min(3, "Add remarks explaining its purpose").max(300, "Keep the remarks under 300 characters")),
});
