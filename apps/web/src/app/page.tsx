import { TaskPanel } from "@/components/task-panel";

export default function Home() {
  return (
    <main className="flex h-screen">
      <div className="flex-1 p-8">
        <h1 className="text-2xl font-bold mb-4">Calendar</h1>
        <p className="text-muted-foreground">
          Calendar view will be implemented here.
        </p>
      </div>
      <TaskPanel />
    </main>
  );
}
