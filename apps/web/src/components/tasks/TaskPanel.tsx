'use client';

import { Task } from '@/types/task';
import { TaskRow } from './TaskRow';

interface TaskPanelProps {
  tasks: Task[];
  title?: string;
}

export function TaskPanel({ tasks, title = 'Tasks' }: TaskPanelProps) {
  return (
    <div className="flex h-full w-72 flex-col border-r border-slate-200 bg-slate-50/50">
      {/* Header */}
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
        <p className="text-xs text-slate-500">
          {tasks.length} task{tasks.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="flex flex-col gap-2">
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
        </div>
      </div>

      {/* Instructions */}
      <div className="border-t border-slate-200 px-4 py-3">
        <p className="text-xs text-slate-500">
          Drag tasks to the calendar to schedule them
        </p>
      </div>
    </div>
  );
}
