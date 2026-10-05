"use client";

import { ArrowLeft, CircleAlert, Ellipsis, FileUp, Link2, RefreshCw, Repeat, Trash2, Unlink } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useMemo, useRef, useState, type FormEvent } from "react";
import { useProfile, useToday } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { confirm } from "@/components/ui/confirm";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";
import { CALENDAR_CATEGORIES, generatesTask, linkedTaskFields, type CalendarCategory } from "@/lib/domain/calendar";
import { importRange, nextSkipped, normalizeFeedUrl, planCalendarImport, type ImportItem } from "@/lib/domain/calendar-import";
import { dateInTimeZone, formatDayMonth, weekdayOf } from "@/lib/domain/dates";
import { parseIcs } from "@/lib/domain/ics";
import { activeSubjects } from "@/lib/domain/subjects";
import { fetchFeedIcs, useCalendarMutations, type ImportedEvent, type MovedEvent } from "@/lib/queries/calendar";
import type { CalendarEventRow, CalendarFeedRow, SubjectRow } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

/** De dónde vienen las fechas: un archivo elegido o un calendario vinculado ya descargado. */
export type ImportSource = { kind: "file"; name: string; ics: string } | { kind: "feed"; feed: CalendarFeedRow; ics: string };

const MAX_FILE_BYTES = 6_000_000;
const FEED_ERRORS = ["unauthorized", "invalid_url", "unreachable", "too_large", "not_calendar"] as const;
type FeedError = (typeof FEED_ERRORS)[number];
const feedError = (error: unknown): FeedError =>
  error instanceof Error && (FEED_ERRORS as readonly string[]).includes(error.message) ? (error.message as FeedError) : "unreachable";

type CalendarImportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subjects: SubjectRow[];
  events: CalendarEventRow[];
  feeds: CalendarFeedRow[];
  /** Abrir directamente en la revisión de un calendario ya descargado (desde el aviso de novedades). */
  initialSource?: ImportSource | null;
};

export function CalendarImportDialog({ open, onOpenChange, subjects, events, feeds, initialSource }: CalendarImportDialogProps) {
  const t = useTranslations();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <DialogContent size="lg" className="dialog-xl" title={t("import_dates")} description={t("import_dates_desc")}>
          <ImportFlow subjects={subjects} events={events} feeds={feeds} initialSource={initialSource ?? null} onDone={() => onOpenChange(false)} />
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

type FlowProps = Pick<CalendarImportDialogProps, "subjects" | "events" | "feeds"> & { initialSource: ImportSource | null; onDone: () => void };

function ImportFlow({ subjects, events, feeds, initialSource, onDone }: FlowProps) {
  const [source, setSource] = useState<ImportSource | null>(initialSource);
  // El calendario vinculado se lee de la lista viva: así la revisión ve sus omitidos al día.
  const current = source?.kind === "feed" ? { ...source, feed: feeds.find((feed) => feed.id === source.feed.id) ?? source.feed } : source;
  return current ? (
    <ImportReview source={current} subjects={subjects} events={events} onBack={() => setSource(null)} onDone={onDone} />
  ) : (
    <ImportSources feeds={feeds} events={events} onPick={setSource} onDone={onDone} />
  );
}

// ---------- paso 1: de dónde ----------

type SourcesProps = { feeds: CalendarFeedRow[]; events: CalendarEventRow[]; onPick: (source: ImportSource) => void; onDone: () => void };

function ImportSources({ feeds, events, onPick, onDone }: SourcesProps) {
  const t = useTranslations();
  const id = useId();
  const timeZone = useProfile().timezone;
  const mutations = useCalendarMutations();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileError, setFileError] = useState<"too_big" | "not_ics" | null>(null);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [linkError, setLinkError] = useState<FeedError | null>(null);
  /** Id del calendario que se está descargando, o "new" mientras se vincula uno. */
  const [busy, setBusy] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<{ feedId: string; error: FeedError } | null>(null);

  async function readFile(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) return setFileError("too_big");
    const ics = await file.text();
    if (!/BEGIN:VCALENDAR/i.test(ics)) return setFileError("not_ics");
    setFileError(null);
    onPick({ kind: "file", name: file.name, ics });
  }

  async function sync(feed: CalendarFeedRow) {
    setBusy(feed.id);
    setSyncError(null);
    try {
      onPick({ kind: "feed", feed, ics: await fetchFeedIcs(feed.url) });
    } catch (error) {
      setSyncError({ feedId: feed.id, error: feedError(error) });
    } finally {
      setBusy(null);
    }
  }

  async function link(event: FormEvent) {
    event.preventDefault();
    const normalized = normalizeFeedUrl(url);
    if (!normalized) {
      setLinkError("invalid_url");
      document.getElementById(`${id}-url`)?.focus();
      return;
    }
    if (feeds.some((feed) => feed.url === normalized)) {
      setLinkError(null);
      return void sync(feeds.find((feed) => feed.url === normalized)!);
    }
    setBusy("new");
    setLinkError(null);
    try {
      // Primero se comprueba que la dirección devuelve un calendario; recién después se guarda.
      const ics = await fetchFeedIcs(normalized);
      const parsed = parseIcs(ics, { timeZone, from: "1970-01-01", to: "1970-01-01" });
      const feedName = name.trim() || (parsed.ok ? parsed.calendarName : null) || t("feed_default_name");
      const feed = mutations.addFeed(feedName.slice(0, 120), normalized);
      toast(t("feed_linked", { name: feed.name }));
      onPick({ kind: "feed", feed, ics });
    } catch (error) {
      setLinkError(feedError(error));
    } finally {
      setBusy(null);
    }
  }

  async function unlink(feed: CalendarFeedRow, withEvents: boolean) {
    const count = events.filter((item) => item.feed_id === feed.id).length;
    const ok = await confirm({
      title: t("feed_unlink_q", { name: feed.name }),
      body: withEvents ? t("feed_unlink_with_body", { n: count }) : t("feed_unlink_keep_body"),
      confirmLabel: withEvents ? t("feed_unlink_with") : t("feed_unlink"),
      danger: true,
    });
    if (!ok) return;
    mutations.removeFeed(feed.id, withEvents);
    toast(t("feed_unlinked", { name: feed.name }));
  }

  return (
    <>
      <DialogBody>
        <section className="import-source" aria-labelledby={`${id}-file-title`}>
          <div className="import-source-head">
            <FileUp size={20} className="flex-none" />
            <div className="min-w-0 flex-1">
              <h3 id={`${id}-file-title`}>{t("import_file_title")}</h3>
              <p className="field-hint">{t("import_file_text")}</p>
            </div>
            <Button onClick={() => fileRef.current?.click()}>
              <FileUp size={18} />
              {t("import_choose_ics")}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".ics,.ical,.ifb,text/calendar"
              className="visually-hidden"
              tabIndex={-1}
              aria-label={t("import_choose_ics")}
              onChange={(event) => {
                void readFile(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </div>
          {fileError ? (
            <p className="notice notice-danger" role="alert">
              <CircleAlert size={18} className="flex-none" />
              <span>{fileError === "too_big" ? t("import_ics_too_big") : t("import_ics_invalid")}</span>
            </p>
          ) : null}
          <details className="import-details">
            <summary>{t("import_file_help")}</summary>
            <p className="field-hint">{t("import_file_help_text")}</p>
          </details>
        </section>

        <section className="import-source" aria-labelledby={`${id}-feed-title`}>
          <div className="import-source-head">
            <Link2 size={20} className="flex-none" />
            <div className="min-w-0 flex-1">
              <h3 id={`${id}-feed-title`}>{t("feed_title")}</h3>
              <p className="field-hint">{t("feed_text")}</p>
            </div>
          </div>

          {feeds.length > 0 ? (
            <ul className="feed-list">
              {feeds.map((feed) => (
                <li key={feed.id} className="feed-row">
                  <div className="min-w-0 flex-1">
                    <strong className="block truncate">{feed.name}</strong>
                    <span className="field-hint">
                      {feed.last_synced_at ? t("feed_last_sync", { date: formatDayMonth(dateInTimeZone(feed.last_synced_at, timeZone)) }) : t("feed_never_synced")}
                    </span>
                    {syncError?.feedId === feed.id ? (
                      <span className="field-error" role="alert">
                        <CircleAlert size={14} />
                        {t(`feed_error_${syncError.error}`)}
                      </span>
                    ) : null}
                  </div>
                  <Button loading={busy === feed.id} disabled={busy !== null} onClick={() => void sync(feed)}>
                    <RefreshCw size={18} />
                    {t("feed_sync")}
                  </Button>
                  <Menu>
                    <MenuTrigger className="btn btn-ghost btn-icon" aria-label={t("feed_options", { name: feed.name })}>
                      <Ellipsis size={20} />
                    </MenuTrigger>
                    <MenuContent>
                      <MenuItem icon={<Unlink size={18} />} onSelect={() => void unlink(feed, false)}>
                        {t("feed_unlink")}
                      </MenuItem>
                      <MenuItem icon={<Trash2 size={18} />} danger onSelect={() => void unlink(feed, true)}>
                        {t("feed_unlink_with")}
                      </MenuItem>
                    </MenuContent>
                  </Menu>
                </li>
              ))}
            </ul>
          ) : null}

          <form className="feed-form" onSubmit={(event) => void link(event)} noValidate>
            <Field label={t("feed_url")} htmlFor={`${id}-url`} error={linkError ? t(`feed_error_${linkError}`) : undefined} errorId={`${id}-url-error`} className="feed-url">
              <input
                id={`${id}-url`}
                className="input"
                type="url"
                inputMode="url"
                value={url}
                maxLength={2000}
                placeholder="https://calendar.google.com/calendar/ical/…/basic.ics"
                autoComplete="off"
                spellCheck={false}
                aria-invalid={linkError ? true : undefined}
                aria-describedby={linkError ? `${id}-url-error` : undefined}
                onChange={(event) => {
                  setUrl(event.target.value);
                  setLinkError(null);
                }}
              />
            </Field>
            <Field label={t("name")} htmlFor={`${id}-name`} optionalLabel={t("optional")}>
              <input id={`${id}-name`} className="input" value={name} maxLength={120} placeholder={t("feed_default_name")} autoComplete="off" onChange={(event) => setName(event.target.value)} />
            </Field>
            <Button type="submit" variant="primary" loading={busy === "new"} disabled={busy !== null || url.trim() === ""}>
              <Link2 size={18} />
              {t("feed_link")}
            </Button>
          </form>
          <details className="import-details">
            <summary>{t("feed_help")}</summary>
            <ol className="feed-steps">
              <li>{t("feed_help_1")}</li>
              <li>{t("feed_help_2")}</li>
              <li>{t("feed_help_3")}</li>
            </ol>
            <p className="field-hint">{t("feed_help_note")}</p>
          </details>
        </section>
      </DialogBody>
      <DialogFooter>
        <span className="spacer" />
        <Button onClick={onDone}>{t("close")}</Button>
      </DialogFooter>
    </>
  );
}

// ---------- paso 2: qué fechas ----------

type ReviewProps = { source: ImportSource; subjects: SubjectRow[]; events: CalendarEventRow[]; onBack: () => void; onDone: () => void };
type Override = { selected?: boolean; category?: CalendarCategory; subjectId?: string | null };

function ImportReview({ source, subjects, events, onBack, onDone }: ReviewProps) {
  const t = useTranslations();
  const today = useToday();
  const profile = useProfile();
  const mutations = useCalendarMutations();
  const [includePast, setIncludePast] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, Override>>({});

  const feed = source.kind === "feed" ? source.feed : null;
  const active = useMemo(() => activeSubjects(subjects), [subjects]);
  const parsed = useMemo(
    () => parseIcs(source.ics, { timeZone: profile.timezone, ...importRange(today, includePast) }),
    [source.ics, profile.timezone, today, includePast],
  );
  const occurrences = useMemo(() => (parsed.ok ? parsed.occurrences : []), [parsed]);
  const plan = useMemo(() => planCalendarImport(occurrences, events, active, feed?.skipped ?? []), [occurrences, events, active, feed?.skipped]);
  const rows = useMemo(() => plan.items.map((item): ImportItem => ({ ...item, ...overrides[item.key] })), [plan, overrides]);
  const chosen = rows.filter((row) => row.selected);
  const chosenDates = chosen.reduce((total, row) => total + row.occurrences.length, 0);

  const patch = (key: string, change: Override) => setOverrides((current) => ({ ...current, [key]: { ...current[key], ...change } }));
  const setAll = (selected: boolean) => setOverrides((current) => Object.fromEntries(plan.items.map((item) => [item.key, { ...current[item.key], selected }])));
  const weekdayShort = t("wd_short").split(",");
  const sourceName = source.kind === "feed" ? source.feed.name : source.name;

  function submit() {
    const byExternalId = new Map(events.filter((event) => event.external_id).map((event) => [event.external_id!, event]));
    const subjectName = (subjectId: string | null) => (subjectId ? (subjects.find((subject) => subject.id === subjectId)?.name ?? null) : null);
    const imported: ImportedEvent[] = [];
    const moved: MovedEvent[] = [];
    for (const row of chosen) {
      for (const occurrence of row.occurrences) {
        const existing = byExternalId.get(occurrence.externalId);
        if (existing) {
          moved.push({ id: existing.id, date: occurrence.date, start_time: occurrence.time });
          continue;
        }
        const subjectId = row.category === "feriado" ? null : row.subjectId;
        const event = {
          category: row.category,
          subject_id: subjectId,
          title: occurrence.title,
          date: occurrence.date,
          start_time: occurrence.time,
          lead_days: generatesTask(row.category) ? profile.default_task_lead_days : null,
          external_id: occurrence.externalId,
          feed_id: feed?.id ?? null,
        };
        imported.push({
          event,
          task: generatesTask(row.category) ? linkedTaskFields(event, t("cat_tp"), subjectName(subjectId), profile.default_task_lead_days) : null,
        });
      }
    }
    const createdIds = mutations.importEvents(imported, moved);
    // Lo ofrecido y no elegido no se vuelve a proponer marcado.
    if (feed) mutations.markFeedSynced(feed.id, nextSkipped(plan, new Set(chosen.map((row) => row.key)), feed.skipped, occurrences));
    toast(
      t("dates_imported", { n: imported.length + moved.length }),
      createdIds.length > 0 ? { action: { label: t("undo"), onAction: () => mutations.remove(createdIds) } } : undefined,
    );
    onDone();
  }

  return (
    <>
      <DialogBody>
        <div className="import-review-head">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft size={18} />
            {t("import_other_source")}
          </Button>
          <span className="min-w-0 flex-1 truncate font-medium" title={sourceName}>
            {sourceName}
          </span>
          <Switch checked={includePast} onChange={setIncludePast}>
            {t("import_include_past")}
          </Switch>
        </div>

        {!parsed.ok ? (
          <p className="notice notice-danger" role="alert">
            <CircleAlert size={18} className="flex-none" />
            <span>{t("import_ics_invalid")}</span>
          </p>
        ) : rows.length === 0 ? (
          <p className="notice" role="status">
            <span>{plan.upToDate > 0 ? t("import_all_up_to_date", { n: plan.upToDate }) : t("import_no_dates")}</span>
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <span className="field-hint flex-1" role="status">
                {t("import_found", { n: rows.reduce((total, row) => total + row.occurrences.length, 0) })}
                {plan.upToDate > 0 ? ` · ${t("import_already", { n: plan.upToDate })}` : ""}
              </span>
              <Button variant="ghost" onClick={() => setAll(true)}>
                {t("select_all")}
              </Button>
              <Button variant="ghost" onClick={() => setAll(false)}>
                {t("select_none")}
              </Button>
            </div>
            <ul className="import-table" aria-label={t("import_preview")}>
              {rows.map((row) => {
                const first = row.occurrences[0];
                const last = row.occurrences[row.occurrences.length - 1];
                const isSeries = row.occurrences.length > 1;
                const label = row.title || t(`cat_${row.category}`);
                return (
                  <li key={row.key} className={cn("import-item", row.selected && "is-selected")}>
                    <Checkbox checked={row.selected} label={t("import_select_named", { name: label })} onChange={(selected) => patch(row.key, { selected })} />
                    <div className="import-when tnum">
                      <strong>
                        {weekdayShort[weekdayOf(first.date) - 1]} {formatDayMonth(first.date)}
                      </strong>
                      <span>{isSeries ? t("import_series_until", { date: formatDayMonth(last.date) }) : (first.time ?? t("all_day"))}</span>
                    </div>
                    <div className="import-what">
                      <span className="truncate" title={label}>
                        {label}
                      </span>
                      <span className="flex flex-wrap items-center gap-1.5">
                        {isSeries ? (
                          <span className="badge">
                            <Repeat size={12} />
                            {t("import_series_count", { n: row.occurrences.length })}
                          </span>
                        ) : null}
                        {row.status === "changed" ? <span className="badge badge-warning">{t("import_status_changed")}</span> : null}
                        {row.status === "skipped" ? <span className="badge badge-outline">{t("import_status_skipped")}</span> : null}
                      </span>
                    </div>
                    {row.status === "changed" ? (
                      <span className="import-fixed field-hint">{t("import_changed_note")}</span>
                    ) : (
                      <>
                        <select
                          className="select"
                          aria-label={t("import_category_of", { name: label })}
                          value={row.category}
                          onChange={(event) => patch(row.key, { category: event.target.value as CalendarCategory })}
                        >
                          {CALENDAR_CATEGORIES.map((category) => (
                            <option key={category} value={category}>
                              {t(`cat_${category}`)}
                            </option>
                          ))}
                        </select>
                        <select
                          className="select"
                          aria-label={t("import_subject_of", { name: label })}
                          value={row.category === "feriado" ? "" : (row.subjectId ?? "")}
                          disabled={row.category === "feriado"}
                          onChange={(event) => patch(row.key, { subjectId: event.target.value || null })}
                        >
                          <option value="">{t("no_subject")}</option>
                          {active.map((subject) => (
                            <option key={subject.id} value={subject.id}>
                              {subject.name}
                            </option>
                          ))}
                        </select>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
            {parsed.truncated ? <p className="field-hint">{t("import_truncated")}</p> : null}
            <p className="field-hint">{t("import_review_note")}</p>
          </>
        )}
      </DialogBody>
      <DialogFooter>
        <span className="spacer" />
        <Button onClick={onDone}>{rows.length === 0 ? t("close") : t("cancel")}</Button>
        <Button variant="primary" disabled={chosenDates === 0} onClick={submit}>
          {chosenDates > 0 ? t("import_n_dates", { n: chosenDates }) : t("import")}
        </Button>
      </DialogFooter>
    </>
  );
}
