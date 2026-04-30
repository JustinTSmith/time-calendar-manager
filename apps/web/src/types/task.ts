export interface Task {
  id: string;
  title: string;
  duration_minutes: number;
  scheduled_event_id?: string;
  listId?: string;
  dueDate?: string;
}
