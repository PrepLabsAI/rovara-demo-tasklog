export interface Task {
  id: number;
  title: string;
  project: string;
  minutes: number;
  createdAt: string;
  completedAt: string | null;
}
export interface State {
  version: 1;
  nextId: number;
  tasks: Task[];
}
export interface AddInput {
  title: string;
  project?: string;
  minutes?: number;
}
export interface ListOptions {
  status?: "all" | "open" | "done";
  project?: string;
  limit?: number;
}
export interface ProjectSummary {
  project: string;
  tasks: number;
  minutes: number;
}
