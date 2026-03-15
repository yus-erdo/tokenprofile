import { auth } from "@/auth";
import { adminDb } from "@/lib/firebase/admin";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.firestoreId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") || "json";

  if (format !== "json" && format !== "csv") {
    return NextResponse.json({ error: "Invalid format. Use json or csv" }, { status: 400 });
  }

  const userDoc = await adminDb.collection("users").doc(session.user.firestoreId).get();
  if (!userDoc.exists) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const userData = userDoc.data()!;
  const userId = session.user.firestoreId;

  // Stream the response
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      try {
        if (format === "json") {
          controller.enqueue(encoder.encode("{\n"));

          // Profile
          const profile = {
            username: userData.username || "",
            displayName: userData.displayName || "",
            email: userData.email || "",
            bio: userData.bio || "",
            location: userData.location || "",
            website: userData.website || "",
            createdAt: userData.createdAt?.toDate?.()?.toISOString() || null,
            interests: userData.interests || [],
            dataRetention: userData.dataRetention
              ? {
                  period: userData.dataRetention.period,
                  updatedAt: userData.dataRetention.updatedAt?.toDate?.()?.toISOString() || null,
                }
              : null,
          };

          controller.enqueue(encoder.encode(`"profile": ${JSON.stringify(profile, null, 2)},\n`));
          controller.enqueue(encoder.encode(`"events": [\n`));

          // Stream events in batches
          let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;
          let first = true;
          const BATCH_SIZE = 500;

          // eslint-disable-next-line no-constant-condition
          while (true) {
            let query: FirebaseFirestore.Query = adminDb
              .collection("events")
              .where("userId", "==", userId)
              .orderBy("timestamp", "asc")
              .limit(BATCH_SIZE);

            if (lastDoc) {
              query = query.startAfter(lastDoc);
            }

            const snapshot = await query.get();
            if (snapshot.empty) break;

            for (const doc of snapshot.docs) {
              const d = doc.data();
              const event = {
                id: doc.id,
                model: d.model || null,
                provider: d.provider || null,
                inputTokens: d.inputTokens || 0,
                outputTokens: d.outputTokens || 0,
                cacheCreationTokens: d.cacheCreationTokens || 0,
                cacheReadTokens: d.cacheReadTokens || 0,
                totalTokens: d.totalTokens || 0,
                costUsd: d.costUsd || 0,
                project: d.project || null,
                durationSeconds: d.durationSeconds || null,
                numTurns: d.numTurns || null,
                timestamp: d.timestamp?.toDate?.()?.toISOString() || null,
              };

              const prefix = first ? "" : ",\n";
              controller.enqueue(encoder.encode(prefix + JSON.stringify(event)));
              first = false;
            }

            lastDoc = snapshot.docs[snapshot.docs.length - 1];
            if (snapshot.size < BATCH_SIZE) break;
          }

          controller.enqueue(encoder.encode("\n]\n}\n"));
        } else {
          // CSV format
          controller.enqueue(
            encoder.encode("date,model,input_tokens,output_tokens,total_tokens,cost_usd,project\n"),
          );

          let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;
          const BATCH_SIZE = 500;

          // eslint-disable-next-line no-constant-condition
          while (true) {
            let query: FirebaseFirestore.Query = adminDb
              .collection("events")
              .where("userId", "==", userId)
              .orderBy("timestamp", "asc")
              .limit(BATCH_SIZE);

            if (lastDoc) {
              query = query.startAfter(lastDoc);
            }

            const snapshot = await query.get();
            if (snapshot.empty) break;

            for (const doc of snapshot.docs) {
              const d = doc.data();
              const date = d.timestamp?.toDate?.()?.toISOString() || "";
              const model = (d.model || "").replace(/,/g, ";");
              const project = (d.project || "").replace(/,/g, ";");
              const line = `${date},${model},${d.inputTokens || 0},${d.outputTokens || 0},${d.totalTokens || 0},${d.costUsd || 0},${project}\n`;
              controller.enqueue(encoder.encode(line));
            }

            lastDoc = snapshot.docs[snapshot.docs.length - 1];
            if (snapshot.size < BATCH_SIZE) break;
          }
        }
      } catch (err) {
        console.error("Export error:", err);
      } finally {
        controller.close();
      }
    },
  });

  const contentType = format === "csv" ? "text/csv" : "application/json";
  const ext = format === "csv" ? "csv" : "json";

  return new Response(stream, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="toqqen-export-${userId}.${ext}"`,
    },
  });
}
