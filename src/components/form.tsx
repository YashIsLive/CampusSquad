import { cloneElement, isValidElement, useId, type ComponentProps, type ReactElement, type ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Label + control + hint/error, stacked, and wired for assistive tech:
 *  - with `htmlFor`: a real <label>, and the hint/error is linked to the control via aria-describedby
 *    (and aria-invalid on error);
 *  - without it (composite controls like skill pickers, uploads, chip groups): the children
 *    become a labelled group.
 */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
}: {
  label: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  const uid = useId();
  const labelId = `${uid}-label`;
  const noteId = error || hint ? `${uid}-note` : undefined;

  let control = children;
  if (htmlFor && noteId && isValidElement(children)) {
    const el = children as ReactElement<{ "aria-describedby"?: string; "aria-invalid"?: boolean }>;
    control = cloneElement(el, {
      "aria-describedby": [el.props["aria-describedby"], noteId].filter(Boolean).join(" "),
      ...(error ? { "aria-invalid": true } : {}),
    });
  }

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {htmlFor ? (
        <Label id={labelId} htmlFor={htmlFor}>
          {label}
        </Label>
      ) : (
        <span id={labelId} className="text-sm leading-none font-medium">
          {label}
        </span>
      )}
      {htmlFor ? (
        control
      ) : (
        <div role="group" aria-labelledby={labelId} aria-describedby={noteId}>
          {children}
        </div>
      )}
      {error ? (
        <p id={noteId} className="text-xs text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={noteId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Native <select> styled like the shadcn inputs. Native keeps mobile pickers and form semantics. */
export function NativeSelect({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-10 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus-visible:border-ink focus-visible:ring-3 focus-visible:ring-ink/15 disabled:opacity-50 sm:h-9",
        className,
      )}
      {...props}
    />
  );
}

export function FormSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-lg border border-rule bg-card p-4 sm:p-5">
      <div>
        <h2 className="text-lg font-bold">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}
