"use client";

import { useState } from "react";
import { DndContext, type DragEndEvent } from "@dnd-kit/core";
import { ListFilter, Calendar, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TaskRow } from "./task-row";
import { TaskCreateSheet } from "./task-create-sheet";
import {
  useTasks,
  useTaskLists,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
} from "@/hooks/use-tasks";
import {
  type Task,
  type TaskFilters,
  type CreateTaskInput,
  type TaskStatus,
} from "@/types/task";

type StatusFilter = "open" | "all";
type SortBy = "dueDate" | "priority" | "createdAt";

export function TaskPanel() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("open");
  const [sortBy, setSortBy] = useState<SortBy>("dueDate");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [selectedListId, setSelectedListId] = useState<string | null>(null);

  const filters: TaskFilters = {
    status: statusFilter,
    listId: selectedListId,
    sortBy,
    sortOrder,
  };

  const { data: tasks, isLoading } = useTasks(filters);
  const { data: taskLists } = useTaskLists();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  const handleCreateTask = (input: CreateTaskInput) => {
    createTask.mutate(input);
  };

  const handleUpdateTask = (id: string, data: Partial<Task>) => {
    updateTask.mutate({ id, input: data });
  };

  const handleDeleteTask = (id: string) => {
    deleteTask.mutate(id);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) return;

    // Handle drag to calendar for time blocking
    const activeData = active.data.current;
    if (activeData?.type === "task" && over.id === "calendar") {
      // This will be handled by the calendar component
      console.log("Task dragged to calendar:", activeData.taskId);
    }
  };

  const getTaskCount = () => {
    if (!tasks) return 0;
    return tasks.length;
  };

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="w-96 border-l bg-background flex flex-col h-full">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Tasks</h2>
            <p className="text-sm text-muted-foreground">
              {getTaskCount()} {statusFilter === "open" ? "open" : ""} tasks
            </p>
          </div>
          <TaskCreateSheet onCreate={handleCreateTask} />
        </div>

        {/* Filter Bar */}
        <div className="p-3 border-b space-y-3">
          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <ListFilter className="h-4 w-4 text-muted-foreground" />
            <div className="flex gap-1">
              <Button
                variant={statusFilter === "open" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setStatusFilter("open")}
                className="h-7 text-xs"
              >
                Open
              </Button>
              <Button
                variant={statusFilter === "all" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setStatusFilter("all")}
                className="h-7 text-xs"
              >
                All
              </Button>
            </div>
          </div>

          {/* Sort & List Selectors */}
          <div className="flex gap-2">
            <Select
              value={sortBy}
              onValueChange={(value) => setSortBy(value as SortBy)}
            >
              <SelectTrigger className="h-8 text-xs flex-1">
                <ArrowUpDown className="h-3 w-3 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dueDate">Due Date</SelectItem>
                <SelectItem value="priority">Priority</SelectItem>
                <SelectItem value="createdAt">Created</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={selectedListId || "all-lists"}
              onValueChange={(value) =>
                setSelectedListId(value === "all-lists" ? null : value)
              }
            >
              <SelectTrigger className="h-8 text-xs flex-1">
                <Calendar className="h-3 w-3 mr-1" />
                <SelectValue placeholder="All Lists" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all-lists">All Lists</SelectItem>
                {taskLists?.map((list: { id: string; name: string }) => (
                  <SelectItem key={list.id} value={list.id}>
                    {list.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Task List */}
        <div className="flex-1 overflow-y-auto p-3">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : tasks?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">No tasks found</p>
              <p className="text-xs mt-1">
                {statusFilter === "open"
                  ? "All tasks are complete!"
                  : "Create a new task to get started"}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {tasks?.map((task: Task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onUpdate={handleUpdateTask}
                  onDelete={handleDeleteTask}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer Stats */}
        <div className="p-3 border-t bg-muted/50">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Drag tasks to calendar to schedule</span>
            {tasks && tasks.length > 0 && (
              <Badge variant="outline" className="text-xs">
                {Math.round(
                  (tasks.filter((t: Task) => t.status === "done").length /
                    tasks.length) *
                    100
                )}
                % complete
              </Badge>
            )}
          </div>
        </div>
      </div>
    </DndContext>
  );
}
