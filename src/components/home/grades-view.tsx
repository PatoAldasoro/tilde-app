"use client";

import { BookOpen, Info, Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { SubjectMark } from "@/components/subject-icon";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/empty";
import { HelpTip } from "@/components/ui/help-tip";
import { formatDecimal, formatGrade } from "@/lib/format";
import { gradeScopes, parseGrade, subjectAverage, type Averages } from "@/lib/domain/grades";
import { isArchived, subjectClass } from "@/lib/domain/subjects";
import { useSubjectMutations } from "@/lib/queries/subjects";
import type { SubjectRow } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";
import { useTermLabel } from "./term";

type GradesViewProps = { subjects: SubjectRow[]; onAddSubject: () => void };

/** Pestaña Notas: los cuatro promedios arriba y una fila por materia, con edición en la celda. */
export function GradesView({ subjects, onAddSubject }: GradesViewProps) {
  const t = useTranslations();
  const locale = useLocale();
  const termLabel = useTermLabel();

  if (subjects.length === 0) {
    return (
      <Empty icon={<BookOpen size={32} strokeWidth={1.75} />} title={t("grades_empty_title")} text={t("grades_empty_text")}>
        <Button variant="primary" onClick={onAddSubject}>
          <Plus size={18} />
          {t("add_subject")}
        </Button>
      </Empty>
    );
  }

  const scopes = gradeScopes(subjects);
  const ordered = [...subjects].sort((a, b) => Number(isArchived(a)) - Number(isArchived(b)));

  return (
    <>
      <div className="stat-groups">
        <StatGroup title={t("current_term")} sub={t("current_term_sub")} averages={scopes.current} />
        <StatGroup title={t("overall")} sub={t("overall_sub")} averages={scopes.overall} />
      </div>
      <div className="table-wrap">
        <table className="grades">
          <caption className="visually-hidden">{t("grades_caption")}</caption>
          <thead>
            <tr>
              <th scope="col">{t("subject")}</th>
              <th scope="col">{t("term")}</th>
              <th scope="col" className="num">
                {t("credits")}
              </th>
              <th scope="col" className="num">
                {t("grade_course")}
              </th>
              <th scope="col" className="num">
                {t("grade_final")}
              </th>
              <th scope="col" className="num">
                {t("subject_avg")}
              </th>
            </tr>
          </thead>
          <tbody>
            {ordered.map((subject) => {
              const average = subjectAverage(subject);
              return (
                <tr key={subject.id} className={cn(subjectClass(subject.color_key), isArchived(subject) && "is-archived")}>
                  <th scope="row">
                    <div className="subject-cell">
                      <SubjectMark icon={subject.icon} size={16} />
                      <strong>{subject.name}</strong>
                      {isArchived(subject) ? <span className="badge">{t("archived_tag")}</span> : null}
                    </div>
                  </th>
                  <td className="tnum whitespace-nowrap">{termLabel(subject) || "—"}</td>
                  <td className="num tnum">{subject.credits ?? "—"}</td>
                  <GradeCell subject={subject} field="grade_course" />
                  <GradeCell subject={subject} field="grade_final" />
                  <td className="num">
                    <span className={cn("avg tnum", average === null && "is-empty")}>{formatDecimal(average, locale)}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="notes-foot">
        <Info size={16} className="flex-none" />
        {t("grades_foot")}
      </p>
    </>
  );
}

function StatGroup({ title, sub, averages }: { title: string; sub: string; averages: Averages }) {
  const t = useTranslations();
  const locale = useLocale();
  const value = (number: number | null) => (
    <span className={cn("stat-value tnum", number === null && "is-empty")}>{formatDecimal(number, locale)}</span>
  );
  return (
    <section className="stat-group">
      <div className="stat-group-head">
        <div>
          <div className="stat-group-title">{title}</div>
          <div className="stat-group-sub">{sub}</div>
        </div>
        <span className="badge tnum">{t("subjects_counted", { n: averages.counted })}</span>
      </div>
      <div className="stats">
        <div className="stat">
          <span className="stat-label">
            {t("avg_simple")}
            <HelpTip label={t("how_calculated")} text={t("avg_simple_help")} position="right" />
          </span>
          {value(averages.simple)}
        </div>
        <div className="stat">
          <span className="stat-label">
            {t("avg_weighted")}
            <HelpTip label={t("how_calculated")} text={t("avg_weighted_help")} />
          </span>
          {value(averages.weighted)}
        </div>
      </div>
    </section>
  );
}

type GradeField = "grade_course" | "grade_final";

/** Celda de nota editable: guarda al salir o con Enter; fuera de 0–10 muestra el error en la celda. */
function GradeCell({ subject, field }: { subject: SubjectRow; field: GradeField }) {
  const t = useTranslations();
  const locale = useLocale();
  const { update } = useSubjectMutations();
  const saved = formatGrade(subject[field], locale);
  const [draft, setDraft] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const errorId = `grade-error-${subject.id}-${field}`;

  function commit() {
    if (draft === null) return;
    const parsed = parseGrade(draft);
    if (!parsed.ok) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setDraft(null);
    if (parsed.value !== subject[field]) update(subject.id, { [field]: parsed.value });
  }

  return (
    <td className={cn("num", invalid && "cell-error is-invalid")}>
      <input
        className={cn("input input-number input-inline", invalid && "is-invalid")}
        inputMode="decimal"
        placeholder="—"
        maxLength={5}
        aria-label={`${t(field)} · ${subject.name}`}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? errorId : undefined}
        value={draft ?? saved}
        onChange={(event) => {
          setDraft(event.target.value);
          setInvalid(false);
        }}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit();
          if (event.key === "Escape" && draft !== null) {
            event.stopPropagation();
            setDraft(null);
            setInvalid(false);
          }
        }}
      />
      {invalid ? (
        <span className="field-error" id={errorId} role="alert">
          {t("grade_range")}
        </span>
      ) : null}
    </td>
  );
}
