export type Section = {
  id: string;
  name: string;
  major: string;
  description: string | null;
  created_at: string;
};

export type SectionWithTaskCount = Section & {
  task_count: number;
};

export type Task = {
  id: string;
  title: string;
  description: string | null;
  major: string | null;
  status: string | null;
  created_by: string | null;
  assignment_type: string | null;
  assigned_user_id: string | null;
  submission_type: string | null;
  section_id: string | null;
  order_index: number | null;
  cohort_id: string | null;
};

export type Cohort = {
  id: string;
  name: string;
  major: string;
  start_date: string | null;
  end_date: string | null;
  status: "active" | "archived";
  created_at: string;
};
