// ─── Roles ────────────────────────────────────────────────────────────────────
export const APP_ROLES = ["student", "manager", "admin", "company"] as const;
export type AppRole = (typeof APP_ROLES)[number];

// ─── Task statuses ─────────────────────────────────────────────────────────────
export const TASK_STATUSES = ["open", "draft", "closed"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_CLASSES: Record<string, string> = {
  open: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  draft: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  closed: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
};

// ─── Submission types ──────────────────────────────────────────────────────────
export const SUBMISSION_TYPES = ["any", "text", "link", "file", "image"] as const;
export type SubmissionType = (typeof SUBMISSION_TYPES)[number];

export const SUBMISSION_TYPE_LABELS: Record<string, string> = {
  any: "Any type",
  text: "Text only",
  link: "Link only",
  file: "File only",
  image: "Image only",
};

// ─── Submission review statuses ────────────────────────────────────────────────
// NOTE: requires DB migration before use:
//   ALTER TABLE submissions
//     ADD COLUMN IF NOT EXISTS review_status text DEFAULT 'pending'
//       CHECK (review_status IN ('pending','approved','needs_revision','rejected')),
//     ADD COLUMN IF NOT EXISTS score integer CHECK (score BETWEEN 1 AND 5);
//
//   ALTER TABLE profiles
//     ADD COLUMN IF NOT EXISTS assigned_major text;
export const REVIEW_STATUSES = ["pending", "approved", "needs_revision", "rejected"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  pending: "Pending Review",
  approved: "Approved",
  needs_revision: "Needs Revision",
  rejected: "Rejected",
};

export const REVIEW_STATUS_CLASSES: Record<ReviewStatus, string> = {
  pending: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  approved: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  needs_revision: "bg-sky-50 text-sky-700 ring-1 ring-sky-200",
  rejected: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
};

export const REVIEW_STATUS_BORDER: Record<ReviewStatus, string> = {
  pending: "border-amber-100 bg-amber-50/30",
  approved: "border-emerald-100 bg-emerald-50/20",
  needs_revision: "border-sky-100 bg-sky-50/20",
  rejected: "border-rose-100 bg-rose-50/20",
};

// ─── Job posts (Phase 6) ──────────────────────────────────────────────────────
export const EMPLOYMENT_TYPES = ["internship", "full_time", "part_time", "contract"] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  internship: "Internship",
  full_time: "Full-time",
  part_time: "Part-time",
  contract: "Contract",
};

export const JOB_POST_STATUSES = ["open", "closed", "archived"] as const;
export type JobPostStatus = (typeof JOB_POST_STATUSES)[number];

export const JOB_POST_STATUS_CLASSES: Record<JobPostStatus, string> = {
  open: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  closed: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
  archived: "bg-slate-50 text-slate-400 ring-1 ring-slate-200",
};

// ─── Job applications (Phase 6) ───────────────────────────────────────────────
export const JOB_APP_STATUSES = [
  "submitted",
  "viewed",
  "shortlisted",
  "rejected",
  "hired",
  "withdrawn",
] as const;
export type JobAppStatus = (typeof JOB_APP_STATUSES)[number];

export const JOB_APP_STATUS_LABELS: Record<JobAppStatus, string> = {
  submitted: "Submitted",
  viewed: "Viewed",
  shortlisted: "Shortlisted",
  rejected: "Not moving forward",
  hired: "Hired",
  withdrawn: "Withdrawn",
};

export const JOB_APP_STATUS_CLASSES: Record<JobAppStatus, string> = {
  submitted: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
  viewed: "bg-sky-50 text-sky-700 ring-1 ring-sky-200",
  shortlisted: "bg-violet-50 text-violet-700 ring-1 ring-violet-200",
  rejected: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
  hired: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  withdrawn: "bg-slate-50 text-slate-500 ring-1 ring-slate-200",
};
