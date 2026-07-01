import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "../components/AppShell";
import { PageEmptyState, PageErrorState, PageLoadingState } from "../components/PageState";
import { getApiErrorMessage } from "../lib/api";
import { contactService, type ContactRecord } from "../services/contactService";
import { taskService, type TaskInput, type TaskRecord } from "../services/taskService";

export const Route = createFileRoute("/tasks")({
  head: () => ({ meta: [{ title: "Tasks | AIHub" }] }),
  component: Tasks,
});

type TaskFormState = {
  contactId: string;
  description: string;
  dueDate: string;
  completed: boolean;
};

const emptyForm = (): TaskFormState => ({
  contactId: "",
  description: "",
  dueDate: "",
  completed: false,
});

const toForm = (task: TaskRecord | null): TaskFormState => ({
  contactId: task?.contactId ?? "",
  description: task?.description ?? "",
  dueDate: task?.dueDate ? task.dueDate.slice(0, 10) : "",
  completed: task?.completed ?? false,
});

function Tasks() {
  const [selectedFilter, setSelectedFilter] = useState<"ALL" | "OPEN" | "COMPLETED">("ALL");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskRecord | null>(null);
  const queryClient = useQueryClient();

  const contactsQuery = useQuery({
    queryKey: ["contacts", "task-select"],
    queryFn: () => contactService.listContacts(),
  });

  const completedFilter = selectedFilter === "OPEN" ? false : selectedFilter === "COMPLETED" ? true : undefined;

  const tasksQuery = useQuery({
    queryKey: ["tasks", selectedFilter],
    queryFn: () => taskService.listTasks(completedFilter),
  });

  const createMutation = useMutation({
    mutationFn: (payload: TaskInput) => taskService.createTask(payload),
    onSuccess: async () => {
      toast.success("Task created.");
      setIsCreateOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "We could not create the task.")),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<TaskInput> }) =>
      taskService.updateTask(id, payload),
    onSuccess: async () => {
      toast.success("Task updated.");
      setEditingTask(null);
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "We could not update the task.")),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => taskService.deleteTask(id),
    onSuccess: async () => {
      toast.success("Task deleted.");
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "We could not delete the task.")),
  });

  const tasks = tasksQuery.data?.data ?? [];
  const openCount = useMemo(() => tasks.filter((task) => !task.completed).length, [tasks]);

  useEffect(() => {
    if (editingTask && !tasks.some((task) => task.id === editingTask.id)) {
      setEditingTask(null);
    }
  }, [editingTask, tasks]);

  if (tasksQuery.isLoading || contactsQuery.isLoading) {
    return (
      <AppShell title="Tasks">
        <PageLoadingState title="Loading tasks" description="Fetching your follow-up work from the backend." />
      </AppShell>
    );
  }

  if (tasksQuery.isError || contactsQuery.isError) {
    return (
      <AppShell title="Tasks">
        <PageErrorState
          title="Tasks unavailable"
          description="We could not load your tasks right now."
          actionLabel="Retry"
          onAction={() => {
            void tasksQuery.refetch();
            void contactsQuery.refetch();
          }}
        />
      </AppShell>
    );
  }

  return (
    <AppShell title="Tasks">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span>Filter</span>
          <select
            value={selectedFilter}
            onChange={(event) => setSelectedFilter(event.target.value as "ALL" | "OPEN" | "COMPLETED")}
            className="rounded border border-gray-300 bg-white px-3 py-2 text-sm"
          >
            <option value="ALL">All</option>
            <option value="OPEN">Open</option>
            <option value="COMPLETED">Completed</option>
          </select>
          <span className="text-gray-500">Open: {openCount}</span>
        </div>
        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Add Task
        </button>
      </div>

      {tasks.length === 0 ? (
        <PageEmptyState
          title="No tasks found"
          description="Create a task to track the next follow-up action."
        />
      ) : (
        <div className="rounded border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-4 py-2 font-medium">Description</th>
                <th className="px-4 py-2 font-medium">Due Date</th>
                <th className="px-4 py-2 font-medium">Contact</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id} className="border-t border-gray-100">
                  <td className="px-4 py-2">{task.description}</td>
                  <td className="px-4 py-2 text-gray-600">{new Date(task.dueDate).toLocaleDateString()}</td>
                  <td className="px-4 py-2 text-gray-600">
                    {contactsQuery.data?.find((contact) => contact.id === task.contactId)?.name ?? "-"}
                  </td>
                  <td className="px-4 py-2">{task.completed ? "Completed" : "Open"}</td>
                  <td className="px-4 py-2">
                    <div className="flex gap-2">
                      {!task.completed ? (
                        <button
                          type="button"
                          onClick={() =>
                            void updateMutation.mutateAsync({
                              id: task.id,
                              payload: { completed: true },
                            })
                          }
                          className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50"
                        >
                          Mark Complete
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setEditingTask(task)}
                        className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Delete ${task.description}?`)) {
                            void deleteMutation.mutateAsync(task.id);
                          }
                        }}
                        className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <TaskDialog
        open={isCreateOpen}
        title="Add Task"
        contacts={contactsQuery.data ?? []}
        initialValue={emptyForm()}
        submitting={createMutation.isPending}
        onOpenChange={setIsCreateOpen}
        onSubmit={async (form) => {
          await createMutation.mutateAsync({
            contactId: form.contactId || undefined,
            description: form.description,
            dueDate: form.dueDate,
            completed: form.completed,
          });
        }}
      />

      <TaskDialog
        open={editingTask !== null}
        title="Edit Task"
        contacts={contactsQuery.data ?? []}
        initialValue={toForm(editingTask)}
        submitting={updateMutation.isPending}
        onOpenChange={(open) => {
          if (!open) {
            setEditingTask(null);
          }
        }}
        onSubmit={async (form) => {
          if (!editingTask) {
            return;
          }

          await updateMutation.mutateAsync({
            id: editingTask.id,
            payload: {
              contactId: form.contactId || undefined,
              description: form.description,
              dueDate: form.dueDate,
              completed: form.completed,
            },
          });
        }}
      />
    </AppShell>
  );
}

function TaskDialog({
  open,
  title,
  contacts,
  initialValue,
  submitting,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  title: string;
  contacts: ContactRecord[];
  initialValue: TaskFormState;
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (form: TaskFormState) => Promise<void>;
}) {
  const [form, setForm] = useState(initialValue);

  useEffect(() => {
    if (open) {
      setForm(initialValue);
    }
  }, [initialValue, open]);

  return (
    <div className={open ? "fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" : "hidden"}>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          await onSubmit(form);
        }}
        className="w-full max-w-md rounded border border-gray-200 bg-white p-5"
      >
        <h2 className="mb-3 text-base font-semibold">{title}</h2>
        <div className="space-y-2">
          <div>
            <label className="block text-xs text-gray-600">Contact</label>
            <select
              value={form.contactId}
              onChange={(event) => setForm({ ...form, contactId: event.target.value })}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">No contact</option>
              {contacts.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600">Description</label>
            <textarea
              required
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              rows={4}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600">Due Date</label>
            <input
              required
              type="date"
              value={form.dueDate}
              onChange={(event) => setForm({ ...form, dueDate: event.target.value })}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.completed}
              onChange={(event) => setForm({ ...form, completed: event.target.checked })}
            />
            Completed
          </label>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submitting ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
