import { subjectClass, type SubjectBadge } from "@/lib/domain/subjects";
import { cn } from "@/lib/utils";
import { SubjectMark } from "./subject-icon";

type SubjectChipProps = { subject: SubjectBadge; className?: string };

/** Chip de materia: su ícono (o un punto de color) + nombre (se trunca; el nombre completo queda en el title). */
export function SubjectChip({ subject, className }: SubjectChipProps) {
  return (
    <span className={cn("chip", subjectClass(subject.color_key), className)} title={subject.name}>
      <SubjectMark icon={subject.icon} size={13} />
      <span>{subject.name}</span>
    </span>
  );
}
