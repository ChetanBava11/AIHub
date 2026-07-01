import { api } from "../lib/api";

export type TaskRecord = {
  id: string;
  tenantId: string;
  contactId: string | null;
  description: string;
  dueDate: string;
  completed: boolean;
  createdAt: string;
};

export type TaskListResponse = {
  data: TaskRecord[];
  count: number;
};

export type TaskInput = {
  contactId?: string;
  description: string;
  dueDate: string;
  completed?: boolean;
};

export const taskService = {
  async listTasks(completed?: boolean) {
    const response = await api.get<TaskListResponse>("/tasks", {
      params: completed === undefined ? undefined : { completed }
    });

    return response.data;
  },

  async getTaskById(id: string) {
    const response = await api.get<{ task: TaskRecord }>(`/tasks/${id}`);

    return response.data.task;
  },

  async createTask(payload: TaskInput) {
    const response = await api.post<{ task: TaskRecord }>("/tasks", payload);

    return response.data.task;
  },

  async updateTask(id: string, payload: Partial<TaskInput>) {
    const response = await api.put<{ task: TaskRecord }>(`/tasks/${id}`, payload);

    return response.data.task;
  },

  async deleteTask(id: string) {
    await api.delete(`/tasks/${id}`);
  }
};