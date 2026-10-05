import type { Database } from "./database.types";

type Tables = Database["public"]["Tables"];
export type TableName = keyof Tables;
export type Row<T extends TableName> = Tables[T]["Row"];
export type Insert<T extends TableName> = Tables[T]["Insert"];
export type Update<T extends TableName> = Tables[T]["Update"];

export type ProfileRow = Row<"profiles">;
export type SubjectRow = Row<"subjects">;
export type SubjectDocumentRow = Row<"subject_documents">;
export type TaskRow = Row<"tasks">;
export type SubtaskRow = Row<"subtasks">;
export type CalendarEventRow = Row<"calendar_events">;
export type CalendarFeedRow = Row<"calendar_feeds">;
export type ScheduleBlockRow = Row<"schedule_blocks">;
export type ScheduleEventRow = Row<"schedule_events">;
export type ScheduleExceptionRow = Row<"schedule_exceptions">;
export type StudySessionRow = Row<"study_sessions">;
export type StudySessionTaskRow = Row<"study_session_tasks">;
