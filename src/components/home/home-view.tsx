"use client";

import { Archive, ArrowLeft, BookOpen, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { PageFrame } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { confirm } from "@/components/ui/confirm";
import { Empty } from "@/components/ui/empty";
import { LoadError, Skeletons } from "@/components/ui/query-state";
import { toast } from "@/components/ui/toast";
import { subjectProgress, taskCounts } from "@/lib/domain/progress";
import { activeSubjects, archivedSubjects } from "@/lib/domain/subjects";
import { useDocuments, useSubjectMutations, useSubjects } from "@/lib/queries/subjects";
import { useTasks } from "@/lib/queries/tasks";
import type { SubjectRow } from "@/lib/supabase/types";
import { GradesView } from "./grades-view";
import { SortableSubjects } from "./sortable-subjects";
import { SubjectCard } from "./subject-card";
import { SubjectFormDialog } from "./subject-form-dialog";
import { SubjectSheet } from "./subject-sheet";

type HomeTab = "subjects" | "grades";

/** Cambia ?tab / ?view sin navegar: el router de Next sigue al History API. */
function setQuery(params: Record<string, string | null>) {
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries(params)) {
    if (value === null) url.searchParams.delete(key);
    else url.searchParams.set(key, value);
  }
  window.history.pushState(null, "", url);
}

/** Inicio: pestañas Materias y Notas, más la vista de Archivadas. */
export function HomeView() {
  const t = useTranslations();
  const params = useSearchParams();
  const tab: HomeTab = params.get("tab") === "grades" ? "grades" : "subjects";
  const showArchived = tab === "subjects" && params.get("view") === "archived";

  const subjectsQuery = useSubjects();
  const documentsQuery = useDocuments();
  const tasksQuery = useTasks();
  const mutations = useSubjectMutations();

  const [form, setForm] = useState<{ subject: SubjectRow | null } | null>(null);
  const [openSubjectId, setOpenSubjectId] = useState<string | null>(null);

  const subjects = useMemo(() => subjectsQuery.data ?? [], [subjectsQuery.data]);
  const documents = documentsQuery.data ?? [];
  const tasks = tasksQuery.data ?? [];
  const active = activeSubjects(subjects);
  const archived = archivedSubjects(subjects);
  const openSubject = subjects.find((subject) => subject.id === openSubjectId) ?? null;
  const isFirstRun = subjectsQuery.isSuccess && subjects.length === 0;

  function setArchived(subject: SubjectRow, value: boolean) {
    mutations.setArchived(subject.id, value);
    setOpenSubjectId(null);
    toast(t(value ? "subject_archived" : "subject_unarchived", { name: subject.name }), {
      action: { label: t("undo"), onAction: () => mutations.setArchived(subject.id, !value) },
    });
  }

  async function remove(subject: SubjectRow) {
    const ok = await confirm({
      title: t("delete_subject_q", { name: subject.name }),
      body: t("delete_subject_body"),
      confirmLabel: t("delete_subject"),
      danger: true,
    });
    if (!ok) return;
    setOpenSubjectId(null);
    mutations.remove(subject.id);
    toast(t("subject_deleted", { name: subject.name }));
  }

  const addSubject = () => setForm({ subject: null });
  const list = showArchived ? archived : active;
  const card = (subject: SubjectRow, grip?: ReactNode, className?: string) => (
    <SubjectCard
      key={subject.id}
      subject={subject}
      progress={subjectProgress(tasks, subject.id)}
      taskCounts={taskCounts(tasks.filter((task) => task.subject_id === subject.id))}
      documentCount={documents.filter((document) => document.subject_id === subject.id).length}
      grip={grip}
      className={className}
      onOpen={() => setOpenSubjectId(subject.id)}
      onEdit={() => setForm({ subject })}
      onArchive={(value) => setArchived(subject, value)}
      onDelete={() => void remove(subject)}
    />
  );

  return (
    <PageFrame
      title={t("nav_home")}
      actions={
        tab === "subjects" && !isFirstRun && !showArchived ? (
          <Button variant="primary" onClick={addSubject}>
            <Plus size={18} />
            {t("add_subject")}
          </Button>
        ) : null
      }
    >
      {!isFirstRun || tab === "grades" ? (
        <div className="home-head">
          <div className="tabs" role="tablist" aria-label={t("tabs_home")}>
            <button
              type="button"
              role="tab"
              id="tab-subjects"
              className="tab"
              aria-selected={tab === "subjects"}
              aria-controls="home-panel"
              onClick={() => setQuery({ tab: null })}
            >
              {t("tab_subjects")}
            </button>
            <button
              type="button"
              role="tab"
              id="tab-grades"
              className="tab"
              aria-selected={tab === "grades"}
              aria-controls="home-panel"
              onClick={() => setQuery({ tab: "grades", view: null })}
            >
              {t("tab_grades")}
            </button>
          </div>
          <div className="grow" />
          {tab === "subjects" ? (
            <Button
              variant={showArchived ? "secondary" : "ghost"}
              aria-pressed={showArchived}
              onClick={() => setQuery({ view: showArchived ? null : "archived" })}
            >
              {showArchived ? <ArrowLeft size={18} /> : <Archive size={18} />}
              {showArchived ? t("back_to_subjects") : t("archived")}
              {showArchived ? null : <span className="badge tnum">{archived.length}</span>}
            </Button>
          ) : null}
        </div>
      ) : null}

      <div id="home-panel" role="tabpanel" aria-labelledby={tab === "grades" ? "tab-grades" : "tab-subjects"}>
        {subjectsQuery.isError ? (
          <LoadError onRetry={() => void subjectsQuery.refetch()} />
        ) : subjectsQuery.isPending ? (
          <div className="subject-grid">
            <Skeletons count={3} className="h-[212px] rounded-md" label={t("subjects_loading")} />
          </div>
        ) : tab === "grades" ? (
          <GradesView subjects={subjects} onAddSubject={addSubject} />
        ) : isFirstRun ? (
          <FirstRun onAdd={addSubject} />
        ) : (
          <>
            {showArchived ? (
              <div className="archived-banner">
                <Archive size={18} className="flex-none" />
                <span>{t("archived_banner")}</span>
              </div>
            ) : null}
            {list.length === 0 && showArchived ? (
              <Empty icon={<Archive size={32} strokeWidth={1.75} />} title={t("archived_empty_title")} text={t("archived_empty_text")} />
            ) : list.length === 0 ? (
              <Empty icon={<BookOpen size={32} strokeWidth={1.75} />} title={t("subjects_empty_title")} text={t("subjects_empty_text")}>
                <Button variant="primary" onClick={addSubject}>
                  <Plus size={18} />
                  {t("add_subject")}
                </Button>
              </Empty>
            ) : showArchived ? (
              <div className="subject-grid">{list.map((subject) => card(subject))}</div>
            ) : (
              <SortableSubjects subjects={list} renderCard={card} onReorder={mutations.reorder}>
                <button type="button" className="subject-ghost" onClick={addSubject}>
                  <Plus size={22} />
                  <strong>{t("add_subject")}</strong>
                  <span>{t("add_subject_hint")}</span>
                </button>
              </SortableSubjects>
            )}
          </>
        )}
      </div>

      <SubjectFormDialog
        open={form !== null}
        onOpenChange={(open) => !open && setForm(null)}
        subject={form?.subject ?? null}
        activeColors={active.map((subject) => subject.color_key)}
      />
      <SubjectSheet
        subject={openSubject}
        documents={openSubject ? documents.filter((document) => document.subject_id === openSubject.id) : []}
        onClose={() => setOpenSubjectId(null)}
        onArchive={setArchived}
        onDelete={(subject) => void remove(subject)}
      />
    </PageFrame>
  );
}

/** Primer uso: todavía no hay ninguna materia. */
function FirstRun({ onAdd }: { onAdd: () => void }) {
  const t = useTranslations();
  return (
    <section className="first-run">
      <div>
        <h2>{t("first_run_title")}</h2>
        <p>{t("first_run_text")}</p>
        <ol className="steps">
          <li>{t("first_run_s1")}</li>
          <li>{t("first_run_s2")}</li>
          <li>{t("first_run_s3")}</li>
        </ol>
        <div className="mt-8">
          <Button variant="primary" size="lg" onClick={onAdd}>
            <Plus size={20} />
            {t("add_subject")}
          </Button>
        </div>
      </div>
      <div className="first-run-stack" aria-hidden="true">
        <div className="subject-ghost min-h-[150px]">
          <span className="badge">{t("example")}</span>
          <strong>{t("first_run_ghost1")}</strong>
          <span>{t("first_run_ghost1_meta")}</span>
        </div>
        <div className="subject-ghost min-h-[110px] opacity-70">
          <strong>{t("first_run_ghost2")}</strong>
        </div>
        <div className="subject-ghost min-h-20 opacity-45" />
      </div>
    </section>
  );
}
