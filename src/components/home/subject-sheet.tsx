"use client";

import { Archive, ArchiveRestore, ExternalLink, File, FileSpreadsheet, FileText, FolderOpen, Image as ImageIcon, Link as LinkIcon, Presentation, Trash2, type LucideIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { IconPicker } from "@/components/icon-picker";
import { SubjectTile } from "@/components/subject-icon";
import { Button } from "@/components/ui/button";
import { CommitInput } from "@/components/ui/commit-input";
import { Field } from "@/components/ui/field";
import { Sheet, SheetBody, SheetContent, SheetFooter } from "@/components/ui/sheet";
import { toast } from "@/components/ui/toast";
import { documentKind, parseDriveLink, type DocumentKind } from "@/lib/domain/documents";
import { isArchived, subjectClass, type ColorKey } from "@/lib/domain/subjects";
import { isPickerConfigured, pickDriveFiles, preloadPicker } from "@/lib/google-picker";
import { useDocumentMutations, useSubjectMutations } from "@/lib/queries/subjects";
import type { SubjectDocumentRow, SubjectRow } from "@/lib/supabase/types";
import { ColorSwatches } from "./color-swatches";
import { TermFields } from "./term-fields";

const DOCUMENT_ICON: Record<DocumentKind, LucideIcon> = {
  doc: FileText,
  sheet: FileSpreadsheet,
  slides: Presentation,
  image: ImageIcon,
  pdf: File,
  folder: FolderOpen,
  file: File,
  link: LinkIcon,
};

type SubjectSheetProps = {
  subject: SubjectRow | null;
  documents: SubjectDocumentRow[];
  onClose: () => void;
  onArchive: (subject: SubjectRow, archived: boolean) => void;
  onDelete: (subject: SubjectRow) => void;
};

/** Panel lateral de una materia: datos editables en el lugar y documentos. */
export function SubjectSheet({ subject, documents, onClose, onArchive, onDelete }: SubjectSheetProps) {
  const t = useTranslations();
  // Mientras el selector de Drive está abierto, tocar "afuera" (el selector) no cierra el panel.
  const pickingRef = useRef(false);

  return (
    <Sheet open={subject !== null} onOpenChange={(open) => !open && onClose()}>
      {subject ? (
        <SheetContent
          label={subject.name}
          className={subjectClass(subject.color_key)}
          head={
            <>
              {subject.icon ? <SubjectTile icon={subject.icon} /> : <span className="size-3.5 flex-none rounded-xs bg-(--s-vivid)" aria-hidden="true" />}
              <h2 className="sheet-title" aria-hidden="true">
                {subject.name}
              </h2>
            </>
          }
          onInteractOutside={(event) => pickingRef.current && event.preventDefault()}
        >
          <SheetBody>
            <SubjectDetails subject={subject} />
            <SubjectDocuments
              subject={subject}
              documents={documents}
              onPickingChange={(value) => {
                pickingRef.current = value;
              }}
            />
          </SheetBody>
          <SheetFooter>
            <Button variant="ghost" onClick={() => onArchive(subject, !isArchived(subject))}>
              {isArchived(subject) ? <ArchiveRestore size={18} /> : <Archive size={18} />}
              {isArchived(subject) ? t("unarchive") : t("archive")}
            </Button>
            <Button variant="danger-ghost" onClick={() => onDelete(subject)}>
              <Trash2 size={18} />
              {t("delete")}
            </Button>
            <span className="flex-1" />
            <Button variant="primary" onClick={onClose}>
              {t("done")}
            </Button>
          </SheetFooter>
        </SheetContent>
      ) : null}
    </Sheet>
  );
}

function SubjectDetails({ subject }: { subject: SubjectRow }) {
  const t = useTranslations();
  const id = useId();
  const { update } = useSubjectMutations();
  const [year, setYear] = useState(String(subject.term_year ?? ""));

  function commitYear() {
    const value = year === "" ? null : Number(year);
    if (value !== null && (value < 2000 || value > 2100)) {
      setYear(String(subject.term_year ?? ""));
      return;
    }
    if (value !== subject.term_year) update(subject.id, { term_year: value });
  }

  return (
    <section className="flex flex-col gap-3.5">
      <h3 className="section-label">{t("details")}</h3>
      <Field label={t("name")} htmlFor={`${id}-name`}>
        <CommitInput
          id={`${id}-name`}
          className="input"
          maxLength={120}
          value={subject.name}
          onCommit={(name) => {
            if (!name) return false;
            update(subject.id, { name });
          }}
        />
      </Field>
      <div className="form-grid">
        <Field label={t("commission")} htmlFor={`${id}-commission`}>
          <CommitInput
            id={`${id}-commission`}
            className="input"
            maxLength={60}
            value={subject.commission ?? ""}
            onCommit={(commission) => update(subject.id, { commission: commission || null })}
          />
        </Field>
        <Field label={t("term")} htmlFor={`${id}-term-period`}>
          <TermFields
            idPrefix={`${id}-term`}
            period={String(subject.term_period ?? "")}
            year={year}
            onPeriodChange={(value) => update(subject.id, { term_period: value === "" ? null : Number(value) })}
            onYearChange={setYear}
            onYearBlur={commitYear}
          />
        </Field>
        <Field label={t("teacher")} htmlFor={`${id}-teacher`}>
          <CommitInput
            id={`${id}-teacher`}
            className="input"
            maxLength={120}
            value={subject.teacher ?? ""}
            onCommit={(teacher) => update(subject.id, { teacher: teacher || null })}
          />
        </Field>
        <Field label={t("credits")} htmlFor={`${id}-credits`}>
          <CommitInput
            id={`${id}-credits`}
            className="input tnum"
            inputMode="numeric"
            maxLength={2}
            value={subject.credits !== null ? String(subject.credits) : ""}
            onCommit={(text) => {
              if (text !== "" && !/^\d{1,2}$/.test(text)) return false;
              update(subject.id, { credits: text === "" ? null : Number(text) });
            }}
          />
        </Field>
      </div>
      <Field label={t("color")} labelId={`${id}-color`}>
        <ColorSwatches value={subject.color_key} labelledBy={`${id}-color`} onChange={(color: ColorKey) => update(subject.id, { color_key: color })} />
      </Field>
      <Field label={t("icon")} labelId={`${id}-icon-label`} optionalLabel={t("optional")}>
        <IconPicker
          id={`${id}-icon`}
          value={subject.icon}
          colorClass={subjectClass(subject.color_key)}
          labelledBy={`${id}-icon-label`}
          onChange={(icon) => update(subject.id, { icon })}
        />
      </Field>
    </section>
  );
}

type SubjectDocumentsProps = { subject: SubjectRow; documents: SubjectDocumentRow[]; onPickingChange: (picking: boolean) => void };

function SubjectDocuments({ subject, documents, onPickingChange }: SubjectDocumentsProps) {
  const t = useTranslations();
  const locale = useLocale();
  const id = useId();
  const mutations = useDocumentMutations();
  const [pasting, setPasting] = useState(false);
  const [url, setUrl] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [openingDrive, setOpeningDrive] = useState(false);

  useEffect(preloadPicker, []);

  function addLink(event: FormEvent) {
    event.preventDefault();
    const link = parseDriveLink(url);
    if (!link) {
      setInvalid(true);
      document.getElementById(`${id}-url`)?.focus();
      return;
    }
    mutations.add([
      { subject_id: subject.id, source: "link", name: t("new_link_name"), url: link.url, drive_file_id: link.driveFileId, mime_type: null },
    ]);
    setUrl("");
    setPasting(false);
  }

  async function addFromDrive() {
    setOpeningDrive(true);
    onPickingChange(true);
    try {
      const files = await pickDriveFiles(locale);
      if (files?.length) {
        mutations.add(
          files.map((file) => ({
            subject_id: subject.id,
            source: "drive" as const,
            name: file.name.slice(0, 200) || t("new_link_name"),
            url: file.url,
            drive_file_id: file.id,
            mime_type: file.mimeType,
          })),
        );
        toast(t("docs_added", { n: files.length }));
      }
    } catch {
      toast(t("drive_error"));
    } finally {
      onPickingChange(false);
      setOpeningDrive(false);
    }
  }

  function remove(document: SubjectDocumentRow) {
    mutations.remove(document.id);
    toast(t("doc_removed", { name: document.name }), { action: { label: t("undo"), onAction: () => mutations.restore(document) } });
  }

  return (
    <section className="flex flex-col gap-3">
      <h3 className="section-label">
        {t("documents")} · <span className="tnum">{documents.length}</span>
      </h3>
      {documents.length > 0 ? (
        <ul className="doc-list">
          {documents.map((document) => {
            const Icon = DOCUMENT_ICON[documentKind(document)];
            return (
              <li className="doc-row" key={document.id}>
                <span className="doc-icon">
                  <Icon size={18} />
                </span>
                <div className="doc-name">
                  <CommitInput
                    className="input input-inline"
                    aria-label={t("doc_name")}
                    maxLength={200}
                    value={document.name}
                    onCommit={(name) => {
                      if (!name) return false;
                      mutations.rename(document.id, name);
                    }}
                  />
                </div>
                <div className="doc-actions">
                  <a
                    className="btn btn-ghost btn-icon"
                    href={document.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={t("open_new_tab", { name: document.name })}
                    data-tip={t("open_new_tab_short")}
                    data-tip-pos="left"
                  >
                    <ExternalLink size={18} />
                  </a>
                  <button
                    type="button"
                    className="btn btn-ghost btn-icon"
                    aria-label={t("remove_doc", { name: document.name })}
                    data-tip={t("remove")}
                    data-tip-pos="left"
                    onClick={() => remove(document)}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="doc-empty">{t("docs_empty")}</div>
      )}
      <div className="btn-row">
        {isPickerConfigured ? (
          <Button loading={openingDrive} onClick={addFromDrive}>
            <FolderOpen size={18} />
            {t("add_from_drive")}
          </Button>
        ) : null}
        <Button aria-expanded={pasting} onClick={() => setPasting((value) => !value)}>
          <LinkIcon size={18} />
          {t("paste_link")}
        </Button>
      </div>
      {pasting ? (
        <form onSubmit={addLink} noValidate>
          <Field
            label={t("drive_link")}
            htmlFor={`${id}-url`}
            hint={t("paste_hint")}
            error={invalid ? t("link_invalid") : undefined}
            errorId={`${id}-url-error`}
          >
            <div className="paste-row">
              <input
                id={`${id}-url`}
                className="input"
                type="url"
                inputMode="url"
                placeholder="https://docs.google.com/…"
                autoComplete="off"
                autoFocus
                value={url}
                aria-invalid={invalid || undefined}
                aria-describedby={invalid ? `${id}-url-error` : undefined}
                onChange={(event) => {
                  setUrl(event.target.value);
                  setInvalid(false);
                }}
              />
              <Button type="submit" variant="primary">
                {t("add")}
              </Button>
            </div>
          </Field>
        </form>
      ) : null}
      <p className="field-hint">{t("docs_note")}</p>
    </section>
  );
}
