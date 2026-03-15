import { auth } from "@/auth";
import { adminDb } from "@/lib/firebase/admin";
import { notify } from "@/lib/notifications";
import { NextResponse } from "next/server";

interface DayEntry {
  tokens: number;
  completions: number;
  cost: number;
}

interface ModelBreakdown {
  completions: number;
  tokens: number;
  cost: number;
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.firestoreId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.firestoreId;
  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month");

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json(
      { error: "Invalid month format. Use YYYY-MM" },
      { status: 400 }
    );
  }

  const [yearStr, monthStr] = month.split("-");
  const year = parseInt(yearStr);
  const monthNum = parseInt(monthStr);

  // Get days in the target month
  const daysInMonth = new Date(year, monthNum, 0).getDate();
  const startDate = new Date(`${month}-01T00:00:00Z`);
  const endDate = new Date(year, monthNum - 1, daysInMonth, 23, 59, 59);

  // Fetch events for this month
  let eventsSnapshot;
  try {
    eventsSnapshot = await adminDb
      .collection("events")
      .where("userId", "==", userId)
      .where("timestamp", ">=", startDate)
      .where("timestamp", "<=", endDate)
      .orderBy("timestamp", "asc")
      .get();
  } catch {
    eventsSnapshot = { docs: [] };
  }

  // Compute stats
  let totalTokens = 0;
  let totalCost = 0;
  let completionCount = 0;
  const dailyActivity: Record<string, DayEntry> = {};
  const modelBreakdown: Record<string, ModelBreakdown> = {};
  const activeDaysSet = new Set<string>();

  for (const doc of eventsSnapshot.docs) {
    const event = doc.data();
    const date = event.timestamp?.toDate?.().toISOString().split("T")[0] || "";
    const tokens = event.totalTokens || 0;
    const cost = Number(event.costUsd || 0);
    const model = event.model || "unknown";

    totalTokens += tokens;
    totalCost += cost;
    completionCount += 1;
    activeDaysSet.add(date);

    // Daily activity
    if (!dailyActivity[date]) {
      dailyActivity[date] = { tokens: 0, completions: 0, cost: 0 };
    }
    dailyActivity[date].tokens += tokens;
    dailyActivity[date].completions += 1;
    dailyActivity[date].cost += cost;

    // Model breakdown
    if (!modelBreakdown[model]) {
      modelBreakdown[model] = { completions: 0, tokens: 0, cost: 0 };
    }
    modelBreakdown[model].completions += 1;
    modelBreakdown[model].tokens += tokens;
    modelBreakdown[model].cost += cost;
  }

  const activeDays = activeDaysSet.size;

  // Find peak day
  let peakDay = "";
  let peakDayTokens = 0;
  for (const [date, entry] of Object.entries(dailyActivity)) {
    if (entry.tokens > peakDayTokens) {
      peakDay = date;
      peakDayTokens = entry.tokens;
    }
  }

  // Find top model
  const topModel =
    Object.entries(modelBreakdown).sort(
      (a, b) => b[1].completions - a[1].completions
    )[0]?.[0] || "none";

  // Compute previous month stats for comparison
  const prevMonthDate = new Date(year, monthNum - 2, 1);
  const prevYear = prevMonthDate.getFullYear();
  const prevMonth = prevMonthDate.getMonth() + 1;
  const prevDaysInMonth = new Date(prevYear, prevMonth, 0).getDate();
  const prevStartDate = new Date(
    `${prevYear}-${String(prevMonth).padStart(2, "0")}-01T00:00:00Z`
  );
  const prevEndDate = new Date(
    prevYear,
    prevMonth - 1,
    prevDaysInMonth,
    23,
    59,
    59
  );

  let prevEventsSnapshot;
  try {
    prevEventsSnapshot = await adminDb
      .collection("events")
      .where("userId", "==", userId)
      .where("timestamp", ">=", prevStartDate)
      .where("timestamp", "<=", prevEndDate)
      .get();
  } catch {
    prevEventsSnapshot = { docs: [] };
  }

  let prevTotalTokens = 0;
  let prevTotalCost = 0;
  let prevCompletionCount = 0;
  const prevActiveDaysSet = new Set<string>();

  for (const doc of prevEventsSnapshot.docs) {
    const event = doc.data();
    const date = event.timestamp?.toDate?.().toISOString().split("T")[0] || "";
    prevTotalTokens += event.totalTokens || 0;
    prevTotalCost += Number(event.costUsd || 0);
    prevCompletionCount += 1;
    prevActiveDaysSet.add(date);
  }

  function pctChange(current: number, previous: number): number | null {
    if (previous === 0) return current > 0 ? 100 : null;
    return Math.round(((current - previous) / previous) * 100);
  }

  const comparison = {
    tokens: pctChange(totalTokens, prevTotalTokens),
    cost: pctChange(totalCost, prevTotalCost),
    completions: pctChange(completionCount, prevCompletionCount),
    activeDays: pctChange(activeDays, prevActiveDaysSet.size),
  };

  const monthNames = [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
  ];

  const reportData = {
    totalTokens,
    totalCost,
    completionCount,
    activeDays,
    topModel,
    peakDay,
    peakDayTokens,
    modelBreakdown,
    dailyActivity,
    comparison,
    monthName: monthNames[monthNum - 1],
    year,
  };

  // Store report
  const reportId = `${userId}_${month}`;
  await adminDb
    .collection("reports")
    .doc(reportId)
    .set({
      userId,
      period: month,
      type: "monthly",
      data: reportData,
      generatedAt: new Date(),
    });

  // Send notification
  await notify(userId, {
    type: "report",
    title: "monthly report ready",
    message: `your ${monthNames[monthNum - 1]} ${year} report has been generated`,
    link: `/reports/${month}`,
  });

  return NextResponse.json({ reportId, ...reportData });
}
