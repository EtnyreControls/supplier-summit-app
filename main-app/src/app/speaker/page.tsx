import Link from "next/link";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components";
import { SpeakerPageClient, type RoutedQuestion } from "./speaker-page-client";

/**
 * Route: /speaker ("Speaker Inbox" in TopNav — only shown there for
 * role="speaker" users, see top-nav.tsx). Server Component: same real-role
 * access-control pattern as /analytics (app/analytics/page.tsx) — hiding the
 * nav link doesn't stop someone hitting the URL directly.
 */

type RoutingRow = {
  routing_id: string;
  question_id: string;
  question_text: string | null;
  similarity_score: number | null;
  created_at: string;
};

export default async function SpeakerPage() {
  const supabase = await createClient();

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  const { data: profile } = authUser
    ? await supabase.from("user").select("role").eq("user_id", authUser.id).single()
    : { data: null };

  if (profile?.role !== "speaker") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-5 text-center">
        <EmptyState
          icon={<LockRoundedIcon sx={{ fontSize: 32 }} />}
          title="Speaker access only"
          body="This area is restricted to speaker accounts."
          action={
            <Link href="/" className="text-sm font-semibold text-ink underline underline-offset-2">
              Back home
            </Link>
          }
        />
      </div>
    );
  }

  // A user can speak at more than one session (speakers.unique is
  // (user_id, event_id), not user_id alone), so this pulls every speaker_id
  // tied to the signed-in account rather than assuming exactly one.
  const { data: speakerRows } = await supabase.from("speakers").select("speaker_id").eq("user_id", authUser!.id);
  const speakerIds = (speakerRows ?? []).map((s) => s.speaker_id);

  const { data: routingRows } =
    speakerIds.length > 0
      ? await supabase
          .from("question_routing")
          .select("routing_id, question_id, question_text, similarity_score, created_at")
          .in("speaker_id", speakerIds)
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .returns<RoutingRow[]>()
      : { data: null };

  const initialRouting: RoutedQuestion[] = (routingRows ?? []).map((row) => ({
    routingId: row.routing_id,
    questionId: row.question_id,
    questionText: row.question_text ?? "(no question text)",
    similarityScore: row.similarity_score,
    createdAt: row.created_at,
  }));

  return <SpeakerPageClient initialRouting={initialRouting} />;
}
