import { subjectClass } from "@/lib/domain/subjects";
import { cn } from "@/lib/utils";

type SubjectChipProps = { subject: { name: string; color_key: string }; className?: string };

/** Chip de materia: punto de color + nombre (se trunca; el nombre completo queda en el title). */
export function SubjectChip({ subject, className }: SubjectChipProps) {
  return (
    <span className={cn("chip", subjectClass(subject.color_key), className)} title={subject.name}>
      <span className="dot" />
      <span>{subject.name}</span>
    </span>
  );
}
