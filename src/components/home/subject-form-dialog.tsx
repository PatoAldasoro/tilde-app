"use client";

import { useTranslations } from "next-intl";
import { useId, useState, type FormEvent } from "react";
import { IconPicker } from "@/components/icon-picker";
import { useToday } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import type { IconKey } from "@/lib/domain/icons";
import { firstFreeColor, subjectClass, type ColorKey } from "@/lib/domain/subjects";
import { useSubjectMutations } from "@/lib/queries/subjects";
import { subjectFormSchema } from "@/lib/schemas";
import type { SubjectRow } from "@/lib/supabase/types";
import { ColorSwatches } from "./color-swatches";
import { suggestedTerm } from "./term";
import { TermFields } from "./term-fields";

type SubjectFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Materia a editar; null para crear una nueva. */
  subject: SubjectRow | null;
  /** Colores que ya usan las materias activas (para preseleccionar uno libre). */
  activeColors: string[];
};

export function SubjectFormDialog({ open, onOpenChange, subject, activeColors }: SubjectFormDialogProps) {
  const t = useTranslations();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <DialogContent
          title={subject ? t("edit_subject") : t("new_subject")}
          description={subject ? undefined : t("new_subject_desc")}
        >
          <SubjectForm subject={subject} activeColors={activeColors} onDone={() => onOpenChange(false)} />
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

type FormErrors = { name?: boolean; term_year?: boolean; credits?: boolean };

function SubjectForm({ subject, activeColors, onDone }: { subject: SubjectRow | null; activeColors: string[]; onDone: () => void }) {
  const t = useTranslations();
  const id = useId();
  const today = useToday();
  const mutations = useSubjectMutations();
  const suggested = suggestedTerm(today);

  const [name, setName] = useState(subject?.name ?? "");
  const [commission, setCommission] = useState(subject?.commission ?? "");
  const [teacher, setTeacher] = useState(subject?.teacher ?? "");
  const [period, setPeriod] = useState(subject ? String(subject.term_period ?? "") : String(suggested.period));
  const [year, setYear] = useState(subject ? String(subject.term_year ?? "") : String(suggested.year));
  const [credits, setCredits] = useState(subject?.credits != null ? String(subject.credits) : "");
  const [color, setColor] = useState<ColorKey>((subject?.color_key as ColorKey | undefined) ?? firstFreeColor(activeColors));
  const [icon, setIcon] = useState<IconKey | null>((subject?.icon as IconKey | null | undefined) ?? null);
  const [errors, setErrors] = useState<FormErrors>({});

  function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = subjectFormSchema.safeParse({
      name,
      commission,
      teacher,
      term_period: period === "" ? null : Number(period),
      term_year: year,
      credits,
      color_key: color,
      icon,
    });
    if (!parsed.success) {
      const fields = new Set(parsed.error.issues.map((issue) => issue.path[0]));
      setErrors({ name: fields.has("name"), term_year: fields.has("term_year"), credits: fields.has("credits") });
      const first = fields.has("name") ? "name" : fields.has("term_year") ? "term-year" : "credits";
      document.getElementById(`${id}-${first}`)?.focus();
      return;
    }
    if (subject) {
      mutations.update(subject.id, parsed.data);
      toast(t("subject_saved", { name: parsed.data.name }));
    } else {
      mutations.create(parsed.data);
      toast(t("subject_added", { name: parsed.data.name }));
    }
    onDone();
  }

  return (
    <form onSubmit={submit} noValidate className="contents">
      <DialogBody>
        <div className="form-grid">
          <Field
            className="span-2"
            label={t("name")}
            htmlFor={`${id}-name`}
            required
            error={errors.name ? t("name_required") : undefined}
            errorId={`${id}-name-error`}
          >
            <input
              id={`${id}-name`}
              className="input"
              value={name}
              maxLength={120}
              placeholder={t("name_ph")}
              autoComplete="off"
              autoFocus
              aria-required="true"
              aria-invalid={errors.name || undefined}
              aria-describedby={errors.name ? `${id}-name-error` : undefined}
              onChange={(event) => {
                setName(event.target.value);
                if (event.target.value.trim()) setErrors((current) => ({ ...current, name: false }));
              }}
            />
          </Field>
          <Field label={t("commission")} htmlFor={`${id}-commission`}>
            <input
              id={`${id}-commission`}
              className="input"
              value={commission}
              maxLength={60}
              placeholder={t("commission_ph")}
              onChange={(event) => setCommission(event.target.value)}
            />
          </Field>
          <Field label={t("term")} htmlFor={`${id}-term-period`} error={errors.term_year ? t("year_invalid") : undefined}>
            <TermFields
              idPrefix={`${id}-term`}
              period={period}
              year={year}
              yearInvalid={errors.term_year}
              onPeriodChange={setPeriod}
              onYearChange={(value) => {
                setYear(value);
                setErrors((current) => ({ ...current, term_year: false }));
              }}
            />
          </Field>
          <Field label={t("teacher")} htmlFor={`${id}-teacher`}>
            <input
              id={`${id}-teacher`}
              className="input"
              value={teacher}
              maxLength={120}
              placeholder={t("teacher_ph")}
              onChange={(event) => setTeacher(event.target.value)}
            />
          </Field>
          <Field
            label={t("credits")}
            htmlFor={`${id}-credits`}
            hint={t("credits_hint")}
            error={errors.credits ? t("credits_invalid") : undefined}
          >
            <input
              id={`${id}-credits`}
              className="input tnum"
              inputMode="numeric"
              value={credits}
              maxLength={2}
              placeholder="6"
              aria-invalid={errors.credits || undefined}
              onChange={(event) => {
                setCredits(event.target.value.replace(/\D/g, ""));
                setErrors((current) => ({ ...current, credits: false }));
              }}
            />
          </Field>
          <Field className="span-2" label={t("color")} labelId={`${id}-color`} hint={t("color_hint")}>
            <ColorSwatches value={color} onChange={setColor} labelledBy={`${id}-color`} />
          </Field>
          <Field className="span-2" label={t("icon")} labelId={`${id}-icon-label`} optionalLabel={t("optional")} hint={t("icon_hint")}>
            <IconPicker id={`${id}-icon`} value={icon} onChange={setIcon} colorClass={subjectClass(color)} labelledBy={`${id}-icon-label`} />
          </Field>
        </div>
      </DialogBody>
      <DialogFooter>
        <Button onClick={onDone}>{t("cancel")}</Button>
        <Button type="submit" variant="primary">
          {subject ? t("save") : t("add_subject")}
        </Button>
      </DialogFooter>
    </form>
  );
}
