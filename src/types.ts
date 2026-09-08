export type TaskStatus = 'todo' | 'doing' | 'done';

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Decision {
  id: string;
  title: string;
  reason?: string;
  createdAt: string;
}

export interface Handoff {
  id: string;
  agent: string;
  summary: string;
  next?: string;
  blockers: string[];
  files: string[];
  createdAt: string;
}

export interface ProjectState {
  version: 1;
  project: string;
  objective?: string;
  tasks: Task[];
  decisions: Decision[];
  handoffs: Handoff[];
  updatedAt: string;
}
