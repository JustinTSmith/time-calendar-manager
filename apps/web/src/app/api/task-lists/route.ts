import { NextRequest, NextResponse } from "next/server";
import { eq, asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { taskLists } from "@time-calendar-manager/db";

// GET /api/task-lists
export async function GET(request: NextRequest) {
  try {
    // For now, use a mock user ID (in production, this would come from auth)
    const mockUserId = "00000000-0000-0000-0000-000000000001";

    const lists = await db.query.taskLists.findMany({
      where: eq(taskLists.userId, mockUserId),
      orderBy: [asc(taskLists.isInbox), asc(taskLists.name)],
    });

    return NextResponse.json(lists);
  } catch (error) {
    console.error("Error fetching task lists:", error);
    return NextResponse.json(
      { error: "Failed to fetch task lists" },
      { status: 500 }
    );
  }
}

// POST /api/task-lists
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.name || typeof body.name !== "string") {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    // For now, use a mock user ID (in production, this would come from auth)
    const mockUserId = "00000000-0000-0000-0000-000000000001";

    const newList = await db
      .insert(taskLists)
      .values({
        userId: mockUserId,
        name: body.name.trim(),
        color: body.color || null,
        isInbox: false,
      })
      .returning();

    return NextResponse.json(newList[0], { status: 201 });
  } catch (error) {
    console.error("Error creating task list:", error);
    return NextResponse.json(
      { error: "Failed to create task list" },
      { status: 500 }
    );
  }
}
