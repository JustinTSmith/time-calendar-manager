export type TaskStatus = "inbox" | "todo" | "in_progress" | "done" | "archived";
export type TaskPriority = 1 | 2 | 3 | 4;

export interface Task {
  id: string;
  userId: string;
  listId: string | null;
  source: string;
  title: string;
  notes: string | null;
  dueDate: string | null;
  durationMinutes: number;
  priority: TaskPriority;
  status: TaskStatus;
  tags: string[];
  scheduledEventId: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskList {
  id: string;
  userId: string;
  name: string;
  color: string | null;
  sortOrder: number;
  isInbox: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskInput {
  title: string;
  notes?: string;
  dueDate?: string | null;
  durationMinutes?: number;
  priority?: TaskPriority;
  listId?: string | null;
  tags?: string[];
}

export interface UpdateTaskInput {
  title?: string;
  notes?: string | null;
  dueDate?: string | null;
  durationMinutes?: number;
  priority?: TaskPriority;
  status?: TaskStatus;
  listId?: string | null;
  tags?: string[];
}

export interface TaskFilters {
  status?: TaskStatus | "open" | "all";
  listId?: string | null;
  sortBy?: "dueDate" | "priority" | "createdAt";
  sortOrder?: "asc" | "desc";
}
