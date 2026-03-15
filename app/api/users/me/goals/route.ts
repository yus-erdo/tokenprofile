import { auth } from "@/auth";
import { adminDb } from "@/lib/firebase/admin";
import { NextResponse } from "next/server";

export interface Goal {
  type: "daily_tokens" | "daily_completions";
  target: number;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.firestoreId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userDoc = await adminDb.collection("users").doc(session.user.firestoreId).get();
  if (!userDoc.exists) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const goals: Goal[] = userDoc.data()!.goals || [];
  return NextResponse.json({ goals });
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.firestoreId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { goals: Goal[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!Array.isArray(body.goals)) {
    return NextResponse.json({ error: "goals must be an array" }, { status: 400 });
  }

  const validTypes = ["daily_tokens", "daily_completions"];
  const goals: Goal[] = body.goals
    .filter(
      (g: Goal) =>
        validTypes.includes(g.type) && typeof g.target === "number" && g.target > 0
    )
    .slice(0, 5); // max 5 goals

  await adminDb.collection("users").doc(session.user.firestoreId).update({ goals });

  return NextResponse.json({ goals });
}
