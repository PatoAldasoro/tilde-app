"use client";

import { Archive, ArchiveRestore, Calendar, Ellipsis, FileText, Pencil, Trash2, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId } from "react";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Progress } from "@/components/ui/progress";
import type { Progress as ProgressValue } from "@/lib/domain/progress";
import { isArchived, subjectClass } from "@/lib/domain/subjects";
import type { SubjectRow } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";
import { useTermLabel } from "./term";

type SubjectCardProps = {
  subject: SubjectRow;
  progress: ProgressValue;
  taskCounts: { done: number; total: number };
  documentCount: number;
  onOpen: () => void;
  onEdit: () => void;
  onArchive: (archived: boolean) => void;
  onDelete: () => void;
};

export function SubjectCard({ subject, progress, taskCounts, documentCount, onOpen, onEdit, onArchive, onDelete }: SubjectCardProps) {
  const t = useTranslations();
  const titleId = useId();
  const termLabel = useTermLabel();
  const archived = isArchived(subject);
  const meta = [subject.commission, termLabel(subject)].filter(Boolean).join(" · ");

  return (
    <article className={cn("subject-card", subjectClass(subject.color_key), archived && "is-archived")} aria-labelledby={titleId}>
      <button type="button" className="card-open" aria-label={t("open_subject", { name: subject.name })} onClick={onOpen} />
      <div className="card-top">
        <h3 className="card-title" id={titleId}>
          {subject.name}
        </h3>
        {archived ? (
          <button type="button" className="btn btn-secondary btn-sm card-menu m-0" onClick={() => onArchive(false)}>
            <ArchiveRestore size={16} />
            {t("unarchive")}
          </button>
        ) : (
          <Menu>
            <MenuTrigger className="btn btn-ghost btn-icon card-menu" aria-label={t("subject_options", { name: subject.name })}>
              <Ellipsis size={20} />
            </MenuTrigger>
            <MenuContent>
              <MenuItem icon={<Pencil size={18} />} onSelect={onEdit}>
                {t("edit")}
              </MenuItem>
              <MenuItem icon={<Archive size={18} />} onSelect={() => onArchive(true)}>
                {t("archive")}
              </MenuItem>
              <MenuSeparator />
              <MenuItem icon={<Trash2 size={18} />} danger onSelect={onDelete}>
                {t("delete")}
              </MenuItem>
            </MenuContent>
          </Menu>
        )}
      </div>
      <div className="card-meta">
        <div className="row">
          <UserRound size={16} />
          <span>{subject.teacher || t("no_teacher")}</span>
        </div>
        <div className="row">
          <Calendar size={16} />
          <span>{meta || t("no_term")}</span>
        </div>
      </div>
      <div>
        <div className="card-progress">
          <Progress value={progress.percent} label={t("progress")} bar="var(--s-vivid)" />
          <span className="progress-label tnum">{progress.percent} %</span>
        </div>
        <div className="field-hint mt-1.5">
          {taskCounts.total > 0 ? t("tasks_done_of", { done: taskCounts.done, total: taskCounts.total }) : t("no_tasks_yet")}
        </div>
      </div>
      <div className="card-foot">
        <span className="left">
          <FileText size={16} />
          {t("docs_count", { n: documentCount })}
        </span>
        {subject.credits !== null ? <span className="tnum">{t("credits_count", { n: subject.credits })}</span> : null}
      </div>
    </article>
  );
}
