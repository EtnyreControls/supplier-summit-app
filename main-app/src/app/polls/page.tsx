import { PollsPageClient } from "./polls-page-client";

/**
 * Route: /polls ("Polls & feedback" in TopNav)
 * The page's poll/feedback data is handled client-side for now (see
 * polls-page-client.tsx). "My questions" moved to its own route (/questions).
 */

export default function PollsPage() {
  return <PollsPageClient />;
}
