"use client";

import { useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { GripVertical, Calendar, Clock } from "lucide-react";
import { format, isPast, isToday, isTomorrow } from "date-fns";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type Task, type TaskPriority, type TaskStatus } from "@/types/task";

interface TaskRowProps {
  task: Task;
  onUpdate: (id: string, data: Partial<Task>) => void;
  onDelete: (id: string) => void;
}

const priorityColors: Record<TaskPriority, string> = {
  1: "bg-red-500",
  2: "bg-orange-500",
  3: "bg-blue-500",
  4: "bg-gray-400",
};

const priorityLabels: Record<TaskPriority, string> = {
  1: "P1",
  2: "P2",
  3: "P3",
  4: "P4",
};

function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${mins}m`;
}

function formatDueDate(dateString: string | null): {
  text: string;
  isOverdue: boolean;
} {
  if (!dateString) {
    return { text: "No date", isOverdue: false };
  }

  const date = new Date(dateString);

  if (isToday(date)) {
    return { text: "Today", isOverdue: false };
  }
  if (isTomorrow(date)) {
    return { text: "Tomorrow", isOverdue: false };
  }

  const isOverdue = isPast(date) && !isToday(date);
  return {
    text: format(date, "MMM d"),
    isOverdue,
  };
}

export function TaskRow({ task, onUpdate, onDelete }: TaskRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [editedTask, setEditedTask] = useState(task);

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
    data: {
      type: "task",
      taskId: task.id,
      duration: task.durationMinutes,
      task,
    },
  });

  const dueDateInfo = formatDueDate(task.dueDate);

  const handleSave = () => {
    onUpdate(task.id, editedTask);
    setIsExpanded(false);
  };

  const handleCancel = () => {
    setEditedTask(task);
    setIsExpanded(false);
  };

  const handleToggleComplete = () => {
    const newStatus: TaskStatus = task.status === "done" ? "todo" : "done";
    onUpdate(task.id, { status: newStatus });
  };

  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        className="opacity-50 bg-muted border-2 border-dashed border-primary rounded-lg p-3"
        style={{ height: "60px" }}
      />
    );
  }

  return (
    <div
      className={cn(
        "group relative bg-card border rounded-lg transition-all",
        isExpanded ? "p-4 shadow-md" : "p-3 hover:bg-accent/50",
        task.status === "done" && "opacity-60"
      )}
    >
      {/* Drag Handle */}
      <div
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        className="absolute left-1 top-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-accent rounded"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>

      <div className={cn("flex items-center gap-3", !isExpanded && "ml-6")}>
        {!isExpanded && (
          <>
            <Checkbox
              checked={task.status === "done"}
              onCheckedChange={handleToggleComplete}
              className="shrink-0"
            />

            {/* Priority Indicator */}
            <div
              className={cn(
                "w-2 h-2 rounded-full shrink-0",
                priorityColors[task.priority]
              )}
              title={priorityLabels[task.priority]}
            />

            {/* Task Title */}
            <button
              onClick={() => setIsExpanded(true)}
              className={cn(
                "flex-1 text-left font-medium truncate hover:text-primary transition-colors",
                task.status === "done" && "line-through text-muted-foreground"
              )}
            >
              {task.title}
            </button>

            {/* Due Date */}
            {task.dueDate && (
              <Badge
                variant="outline"
                className={cn(
                  "shrink-0 text-xs",
                  dueDateInfo.isOverdue &&
                    "border-red-500 text-red-500 bg-red-50"
                )}
              >
                <Calendar className="h-3 w-3 mr-1" />
                {dueDateInfo.text}
              </Badge>
            )}

            {/* Duration */}
            <Badge variant="secondary" className="shrink-0 text-xs">
              <Clock className="h-3 w-3 mr-1" />
              {formatDuration(task.durationMinutes)}
            </Badge>
          </>
        )}
      </div>

      {/* Expanded Edit Mode */}
      {isExpanded && (
        <div className="mt-4 space-y-4 ml-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Title</label>
            <Input
              value={editedTask.title}
              onChange={(e) =>
                setEditedTask({ ...editedTask, title: e.target.value })
              }
              placeholder="Task title"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Notes</label>
            <Textarea
              value={editedTask.notes || ""}
              onChange={(e) =>
                setEditedTask({ ...editedTask, notes: e.target.value })
              }
              placeholder="Add notes..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Due Date</label>
              <Input
                type="datetime-local"
                value={
                  editedTask.dueDate
                    ? format(new Date(editedTask.dueDate), "yyyy-MM-dd'T'HH:mm")
                    : ""
                }
                onChange={(e) =>
                  setEditedTask({
                    ...editedTask,
                    dueDate: e.target.value || null,
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Duration (minutes)</label>
              <Input
                type="number"
                min={5}
                step={5}
                value={editedTask.durationMinutes}
                onChange={(e) =>
                  setEditedTask({
                    ...editedTask,
                    durationMinutes: parseInt(e.target.value) || 30,
                  })
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Priority</label>
            <Select
              value={String(editedTask.priority)}
              onValueChange={(value) =>
                setEditedTask({
                  ...editedTask,
                  priority: parseInt(value) as TaskPriority,
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                    P1 - Urgent
                  </div>
                </SelectItem>
                <SelectItem value="2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-orange-500" />
                    P2 - High
                  </div>
                </SelectItem>
                <SelectItem value="3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    P3 - Normal
                  </div>
                </SelectItem>
                <SelectItem value="4">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-gray-400" />
                    P4 - Low
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => onDelete(task.id)}>
              Delete
            </Button>
            <Button onClick={handleSave}>Save</Button>
          </div>
        </div>
      )}
    </div>
  );
}
