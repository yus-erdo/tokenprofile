import { auth } from "@/auth";
import { adminDb } from "@/lib/firebase/admin";
import { NextResponse } from "next/server";

const VALID_TYPES = ["tokens", "cost"] as const;
const VALID_PERIODS = ["daily", "weekly", "monthly"] as const;

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.firestoreId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const type = body.type as string;
  const period = body.period as string;
  const amount = Number(body.amount);
  const warningPercent = Number(body.warningPercent);

  if (!VALID_TYPES.includes(type as typeof VALID_TYPES[number])) {
    return NextResponse.json({ error: "Invalid type. Must be 'tokens' or 'cost'" }, { status: 400 });
  }

  if (!VALID_PERIODS.includes(period as typeof VALID_PERIODS[number])) {
    return NextResponse.json({ error: "Invalid period. Must be 'daily', 'weekly', or 'monthly'" }, { status: 400 });
  }

  if (!amount || amount <= 0) {
    return NextResponse.json({ error: "Amount must be a positive number" }, { status: 400 });
  }

  if (!warningPercent || warningPercent < 1 || warningPercent > 100) {
    return NextResponse.json({ error: "warningPercent must be between 1 and 100" }, { status: 400 });
  }

  const budget = {
    type,
    period,
    amount,
    warningPercent,
    updatedAt: new Date(),
  };

  await adminDb.collection("users").doc(session.user.firestoreId).update({ budget });

  return NextResponse.json({ budget });
}
