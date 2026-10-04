import { CircleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type FieldProps = {
  label: ReactNode;
  /** id del control; si falta, la etiqueta se rinde como texto (grupos de botones). */
  htmlFor?: string;
  labelId?: string;
  hint?: ReactNode;
  error?: ReactNode;
  errorId?: string;
  required?: boolean;
  optionalLabel?: string;
  className?: string;
  children: ReactNode;
};

/** Campo de formulario: etiqueta arriba, ayuda y error debajo. */
export function Field({ label, htmlFor, labelId, hint, error, errorId, required, optionalLabel, className, children }: FieldProps) {
  const labelContent = (
    <>
      {label}
      {required ? (
        <span className="req" aria-hidden="true">
          *
        </span>
      ) : null}
      {optionalLabel ? <span className="subtle font-normal"> · {optionalLabel}</span> : null}
    </>
  );
  return (
    <div className={cn("field", error && "is-invalid", className)}>
      {htmlFor ? (
        <label className="field-label" htmlFor={htmlFor} id={labelId}>
          {labelContent}
        </label>
      ) : (
        <span className="field-label" id={labelId}>
          {labelContent}
        </span>
      )}
      {children}
      {error ? (
        <span className="field-error" id={errorId} role="alert">
          <CircleAlert size={14} />
          {error}
        </span>
      ) : hint ? (
        <span className="field-hint">{hint}</span>
      ) : null}
    </div>
  );
}
