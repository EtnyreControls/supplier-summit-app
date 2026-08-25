# Attendee UAT checklist

For testers logging in with a default **attendee** account (badge ID + PIN).
Each row: do the step, check the actual result against expected, mark pass/fail.
Use `test.md` at the repo root to log any failures found (with steps to
reproduce) so they can be tracked and fixed.

Log in at `/login` with your badge ID and PIN before starting.

---

## 1. Login & account

| # | Step | Expected result |
|---|---|---|
| 1.1 | Go to `/login`, enter your badge ID and PIN, submit | Redirected to `/welcome`, logged in |
| 1.2 | Enter a wrong PIN | Error toast, not logged in, stays on `/login` |
| 1.3 | Enter a wrong PIN 5+ times in a row | Account locked message: *"Your account has been locked after too many failed attempts..."* — even the correct PIN should now fail until unlocked by an admin |
| 1.4 | If your account was set up with "must change PIN," log in | Redirected to a PIN-change screen before reaching `/welcome`, can't skip it |
| 1.5 | Log out (if a logout control exists) and log back in | Session ends and restarts cleanly, no leftover state from before |

## 2. Navigation & access boundaries

| # | Step | Expected result |
|---|---|---|
| 2.1 | Check the top nav | Shows: About Us, Agenda & Speakers, Polls & Feedback, My Questions, Growth Machine. **No** Analytics or Speaker Inbox link |
| 2.2 | Try navigating directly to `/analytics` by URL | Blocked — "Analytics access only" screen with a link back home, no data shown |
| 2.3 | Try navigating directly to `/speaker` by URL | Blocked — "Speaker access only" screen with a link back home |
| 2.4 | Try navigating directly to `/admin` by URL | Blocked / redirected, no admin console access |
| 2.5 | Toggle light/dark mode (if a control is visible) | Whole app re-themes correctly, no unreadable text/broken contrast |

## 3. Agenda

| # | Step | Expected result |
|---|---|---|
| 3.1 | Go to `/agenda` | Full day's session list loads with times, titles, and status (e.g. upcoming/completed) |
| 3.2 | Tap into a session that has a speaker assigned | Session detail shows speaker card(s) with name/bio — **check that a session with two co-presenters (e.g. "Welcome, Safety Message & Summit Objectives" or "Global Growth & Strategic Sourcing") shows both people**, not just one |
| 3.3 | Tap into a session with no speaker assigned | Detail still opens without erroring, just no speaker card |
| 3.4 | Check current time vs. the agenda | The session actually happening now is visually marked as current/live (if that feature exists) |

## 4. Submitting a question

| # | Step | Expected result |
|---|---|---|
| 4.1 | Tap the floating "Ask a question" button | A form opens with a text box, a topic dropdown, and an anonymous toggle |
| 4.2 | Open the topic dropdown | Options include: General, Growth Journey, Growth Machine, Procurement, Strategic Sourcing |
| 4.3 | Submit a question with topic "General" | Success — confirmation shown, question appears under "My Questions" |
| 4.4 | Submit a question with topic "Procurement" | Same success behavior as 4.3 |
| 4.5 | Submit a question with topic "Strategic Sourcing" | Same success behavior as 4.3 |
| 4.6 | Submit a question with "Ask anonymously" turned on | Submits successfully; your name should not be shown alongside it wherever staff view it (can't verify directly as an attendee, but submission itself should still succeed and appear under your own "My Questions") |
| 4.7 | Try submitting an empty question | Blocked client-side (submit disabled or an error), no blank question created |
| 4.8 | Go to `/questions` ("My Questions") | Every question you submitted this session shows up, with its topic and status |
| 4.9 | Submit two near-identical questions (e.g. "when does lunch start" and "what time is lunch") | Both show up under My Questions individually — whether they get grouped together is an internal/staff-side thing, not something you should see differently as an attendee |

## 5. Polls & feedback

| # | Step | Expected result |
|---|---|---|
| 5.1 | Go to `/polls` | Shows the current open poll/feedback question(s) |
| 5.2 | Submit a response to a poll question | Success, can't submit the same poll twice (or it clearly shows you already responded) |
| 5.3 | Submit free-text feedback (if that question type is present) | Text submits successfully |
| 5.4 | Refresh the page after submitting | Your submission state persists — doesn't reset and let you resubmit and doesn't lose your response |

## 6. Growth Machine

| # | Step | Expected result |
|---|---|---|
| 6.1 | Go to `/growth-machine` before the session starts | Shows a "hasn't started yet" empty state, not an error or blank page |
| 6.2 | Go to `/growth-machine` once it's live (or ask staff to start it) | Interactive board/workshop loads |
| 6.3 | Interact with the board as intended (add an entry, vote, etc.) | Action succeeds and is reflected for other users in real time (test with two testers on the same table if possible) |
| 6.4 | Have two testers use the board at the same time | No crashes, no lost updates, both see each other's changes |

## 7. Contacts & QR

| # | Step | Expected result |
|---|---|---|
| 7.1 | Go to `/contacts` | Your assigned contacts/table members list loads |
| 7.2 | Go to `/qr` (or tap the QR icon in the nav) | Your personal QR code displays |
| 7.3 | Have another tester scan your QR (if there's a scan flow) | Correctly identifies you / does whatever the scan is supposed to do |

## 8. Cross-cutting checks

| # | Step | Expected result |
|---|---|---|
| 8.1 | Use the app on a phone (not just desktop) | Layout is usable, nothing cut off, bottom nav/FAB reachable |
| 8.2 | Leave the app idle for a while, then come back and take an action | Session is still valid (or gracefully asks you to log back in — not a silent broken state) |
| 8.3 | Submit something with a very long text (question, feedback) | Either accepted cleanly or clearly truncated/limited with a message — not broken/cut off mid-save |
| 8.4 | Try rapid double-submit (tap submit twice fast) on a question or poll response | Only one submission is created, not a duplicate |

---

## Reporting a failure

For anything that doesn't match "Expected result," note:
- Which numbered step
- What actually happened (screenshot if possible)
- Device/browser
- Whether it's reproducible

Add it to `test.md` at the repo root, or report it back directly so it can be
triaged.
