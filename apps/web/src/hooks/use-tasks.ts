"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";
import {
  type Task,
  type TaskFilters,
  type CreateTaskInput,
  type UpdateTaskInput,
} from "@/types/task";

const API_BASE = "/api";

async function fetchTasks(filters: TaskFilters = {}): Promise<Task[]> {
  const params = new URLSearchParams();
  if (filters.status && filters.status !== "all") {
    params.set("status", filters.status);
  }
  if (filters.listId) {
    params.set("listId", filters.listId);
  }
  if (filters.sortBy) {
    params.set("sortBy", filters.sortBy);
    params.set("sortOrder", filters.sortOrder || "asc");
  }

  const response = await fetch(`${API_BASE}/tasks?${params}`);
  if (!response.ok) {
    throw new Error("Failed to fetch tasks");
  }
  return response.json();
}

async function fetchTaskLists() {
  const response = await fetch(`${API_BASE}/task-lists`);
  if (!response.ok) {
    throw new Error("Failed to fetch task lists");
  }
  return response.json();
}

async function createTask(input: CreateTaskInput): Promise<Task> {
  const response = await fetch(`${API_BASE}/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error("Failed to create task");
  }
  return response.json();
}

async function updateTask({
  id,
  input,
}: {
  id: string;
  input: UpdateTaskInput;
}): Promise<Task> {
  const response = await fetch(`${API_BASE}/tasks/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error("Failed to update task");
  }
  return response.json();
}

async function deleteTask(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/tasks/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error("Failed to delete task");
  }
}

// Query keys
export const taskKeys = {
  all: ["tasks"] as const,
  lists: () => [...taskKeys.all, "list"] as const,
  list: (filters: TaskFilters) => [...taskKeys.lists(), filters] as const,
  details: () => [...taskKeys.all, "detail"] as const,
  detail: (id: string) => [...taskKeys.details(), id] as const,
};

export const taskListKeys = {
  all: ["task-lists"] as const,
};

// Hooks
export function useTasks(
  filters: TaskFilters = {},
  options?: Omit<UseQueryOptions<Task[], Error>, "queryKey" | "queryFn">
) {
  return useQuery({
    queryKey: taskKeys.list(filters),
    queryFn: () => fetchTasks(filters),
    ...options,
  });
}

export function useTaskLists() {
  return useQuery({
    queryKey: taskListKeys.all,
    queryFn: fetchTaskLists,
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateTask,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
      queryClient.invalidateQueries({ queryKey: taskKeys.detail(data.id) });
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
    },
  });
}
