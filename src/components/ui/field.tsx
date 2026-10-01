import { cn } from "@/lib/cn";

const control =
  "h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none transition-colors placeholder:text-text-muted focus:border-primary disabled:bg-surface-muted aria-invalid:border-danger";

type FieldProps = {
  label: string;
  htmlFor: string;
  required?: boolean;
  error?: string[] | string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
};

/** Label + control + hint/error, the building block of every form. */
export function Field({ label, htmlFor, required, error, hint, className, children }: FieldProps) {
  const message = Array.isArray(error) ? error[0] : error;
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-[12.5px] font-bold text-brand-navy dark:text-text">
        {label}
        {required && <span className="ml-0.5 text-danger">*</span>}
      </label>
      {children}
      {message ? (
        <p className="mt-1 text-xs text-danger">{message}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(control, className)} {...props} />;
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(control, "h-auto min-h-10 py-2", className)} rows={2} {...props} />;
}

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  options: { value: string; label: string }[];
  placeholder?: string;
};

export function Select({ className, options, placeholder = "Select…", ...props }: SelectProps) {
  return (
    <select className={cn(control, "pr-8", className)} {...props}>
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

type SwitchProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & { label: string };

/** Checkbox styled as a toggle. Submits "on" when checked. */
export function Switch({ label, className, id, ...props }: SwitchProps) {
  return (
    <label htmlFor={id} className={cn("inline-flex cursor-pointer items-center gap-2 text-sm", className)}>
      <input id={id} type="checkbox" className="peer sr-only" {...props} />
      <span className="relative h-5 w-9 rounded-full bg-border transition-colors after:absolute after:top-0.5 after:left-0.5 after:size-4 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-primary peer-checked:after:translate-x-4 peer-focus-visible:outline-2 peer-focus-visible:outline-primary" />
      {label}
    </label>
  );
}
