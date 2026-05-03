'use client';

import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Task } from '@/types/task';
import { clsx } from 'clsx';

interface TaskRowProps {
  task: Task;
}

export function TaskRow({ task }: TaskRowProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `task-${task.id}`,
    data: {
      type: 'task',
      taskId: task.id,
      durationMinutes: task.duration_minutes,
      title: task.title,
      scheduled_event_id: task.scheduled_event_id,
    },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  const isScheduled = !!task.scheduled_event_id;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={clsx(
        'group flex items-center gap-3 rounded-lg border p-3 transition-all hover:shadow-md cursor-grab active:cursor-grabbing',
        isScheduled
          ? 'border-green-200 bg-green-50/50 hover:bg-green-50'
          : 'border-slate-200 bg-white hover:border-slate-300'
      )}
    >
      {/* Drag handle icon */}
      <div className="flex flex-col gap-1 text-slate-300 group-hover:text-slate-400">
        <div className="h-0.5 w-3 rounded-full bg-current" />
        <div className="h-0.5 w-3 rounded-full bg-current" />
        <div className="h-0.5 w-3 rounded-full bg-current" />
      </div>

      {/* Task content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={clsx(
            'truncate text-sm font-medium',
            isScheduled ? 'text-green-800' : 'text-slate-700'
          )}>
            {task.title}
          </p>
          {isScheduled && (
            <span className="flex-shrink-0 text-green-500" title="Scheduled">
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500">
          {task.duration_minutes} min
        </p>
      </div>
    </div>
  );
}
