import { NextRequest, NextResponse } from "next/server";
import { eq, and, isNull, desc, asc, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { tasks } from "@time-calendar-manager/db";

// Local type definition since it's not exported from db package
type TaskStatus = "inbox" | "todo" | "in_progress" | "done" | "archived";

// GET /api/tasks?status=open&sortBy=dueDate&sortOrder=asc
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get("status") as
      | TaskStatus
      | "open"
      | "all"
      | null;
    const listId = searchParams.get("listId");
    const sortBy = searchParams.get("sortBy") || "dueDate";
    const sortOrder = searchParams.get("sortOrder") || "asc";

    // Build where conditions
    const conditions = [isNull(tasks.deletedAt)];

    // Filter by status
    if (statusFilter === "open") {
      conditions.push(
        sql`${tasks.status} IN ('inbox', 'todo', 'in_progress')`
      );
    } else if (statusFilter && statusFilter !== "all") {
      conditions.push(eq(tasks.status, statusFilter));
    }

    // Filter by list
    if (listId) {
      conditions.push(eq(tasks.listId, listId));
    }

    // Build order by
    let orderBy;
    const orderFn = sortOrder === "desc" ? desc : asc;

    switch (sortBy) {
      case "dueDate":
        orderBy = [orderFn(tasks.dueDate), asc(tasks.priority)];
        break;
      case "priority":
        orderBy = [orderFn(tasks.priority), asc(tasks.dueDate)];
        break;
      case "createdAt":
        orderBy = [orderFn(tasks.createdAt)];
        break;
      default:
        orderBy = [orderFn(tasks.dueDate)];
    }

    // Fetch tasks
    const result = await db.query.tasks.findMany({
      where: and(...conditions),
      orderBy,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching tasks:", error);
    return NextResponse.json(
      { error: "Failed to fetch tasks" },
      { status: 500 }
    );
  }
}

// POST /api/tasks
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.title || typeof body.title !== "string") {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }

    // For now, use a mock user ID (in production, this would come from auth)
    const mockUserId = "00000000-0000-0000-0000-000000000001";

    const newTask = await db
      .insert(tasks)
      .values({
        userId: mockUserId,
        title: body.title.trim(),
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        durationMinutes: body.durationMinutes || 30,
        priority: body.priority || 3,
        status: "todo",
        listId: body.listId || null,
        tags: body.tags || [],
      })
      .returning();

    return NextResponse.json(newTask[0], { status: 201 });
  } catch (error) {
    console.error("Error creating task:", error);
    return NextResponse.json(
      { error: "Failed to create task" },
      { status: 500 }
    );
  }
}
