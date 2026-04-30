import { NextRequest, NextResponse } from "next/server";
import { eq, and, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { tasks } from "@time-calendar-manager/db";

// PATCH /api/tasks/:id
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {};

    if (body.title !== undefined) {
      updateData.title = body.title.trim();
    }
    if (body.dueDate !== undefined) {
      updateData.dueDate = body.dueDate ? new Date(body.dueDate) : null;
    }
    if (body.durationMinutes !== undefined) {
      updateData.durationMinutes = body.durationMinutes;
    }
    if (body.priority !== undefined) {
      updateData.priority = body.priority;
    }
    if (body.status !== undefined) {
      updateData.status = body.status;
    }
    if (body.listId !== undefined) {
      updateData.listId = body.listId;
    }
    if (body.tags !== undefined) {
      updateData.tags = body.tags;
    }

    const updatedTask = await db
      .update(tasks)
      .set(updateData)
      .where(and(eq(tasks.id, id), isNull(tasks.deletedAt)))
      .returning();

    if (updatedTask.length === 0) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json(updatedTask[0]);
  } catch (error) {
    console.error("Error updating task:", error);
    return NextResponse.json(
      { error: "Failed to update task" },
      { status: 500 }
    );
  }
}

// DELETE /api/tasks/:id (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const deletedTask = await db
      .update(tasks)
      .set({ deletedAt: new Date() })
      .where(and(eq(tasks.id, id), isNull(tasks.deletedAt)))
      .returning();

    if (deletedTask.length === 0) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting task:", error);
    return NextResponse.json(
      { error: "Failed to delete task" },
      { status: 500 }
    );
  }
}
