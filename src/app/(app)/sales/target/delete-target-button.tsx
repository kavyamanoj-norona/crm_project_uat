"use client";

import { useActionState } from "react";
import { Trash2 } from "lucide-react";
import type { FormState } from "@/lib/form";

type DeleteAction = (_prev: FormState, formData: FormData) => Promise<FormState>;

export function DeleteTargetButton({ id, deleteAction }: { id: string; deleteAction: DeleteAction }) {
  const [, action, pending] = useActionState<FormState, FormData>(deleteAction, {});

  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        title="Remove target"
        className="rounded p-1.5 text-text-muted hover:bg-danger/10 hover:text-danger disabled:opacity-40"
      >
        <Trash2 className="size-4" />
      </button>
    </form>
  );
}
