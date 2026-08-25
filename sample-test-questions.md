# Sample questions for UAT testing

For testers exercising section 4 ("Submitting a question") of the UAT
checklist. Grouped by topic tag so each one actually makes sense for where
it'll route — pick straight from here rather than making something up, so
the "does this land with the right person" check is meaningful.

Reminder of where each tag routes (see `nlp-service/app.py`,
`TAG_SPEAKER_IDS`):
- **General** → Analytics
- **Growth Journey** → Analytics (not currently in the tag map, falls through)
- **Growth Machine** → Analytics
- **Procurement** → Shannon Mulcahy
- **Strategic Sourcing** → Pranav Amin, falls back to Zoey Henchliffe if declined

---

## General

1. What time does the summit wrap up today?
2. Is there Wi-Fi available, and what's the password?
3. Where are the restrooms located on this floor?
4. Will slides from today's sessions be shared afterward?
5. Is there a parking validation available for the venue?
6. Who do I talk to if I need to leave early?
7. Is lunch included, and are there vegetarian options?
8. Will there be a recording of today's sessions?

## Growth Journey

1. How does Etnyre define what "growth" means for supplier partners specifically?
2. What does the next 12 months look like for supplier collaboration on new product development?
3. How will suppliers be kept updated on Etnyre's growth milestones after today?
4. What's the long-term vision behind the 7-year growth strategy mentioned this morning?
5. How does today's summit tie into Etnyre's broader growth roadmap?
6. Are there plans for a follow-up event later in the year to check in on progress?
7. How will Etnyre measure whether this summit actually improved supplier partnerships?

## Growth Machine

1. How are teams being formed for the Growth Machine workshop?
2. What happens to the ideas submitted during the workshop after today?
3. Is there a prize or recognition for the winning team?
4. Can our team revise our submission after we've entered it?
5. How is the winner of the Growth Machine challenge selected?
6. Can someone walk through how the voting works on the board?
7. Is there a time limit for each team's presentation?

## Procurement

*(Ties to Procurement Operations — POs, expediting, delivery issues, lead
times, shortages, buying cadence, inventory execution — Shannon's area)*

1. Why was our last purchase order delayed past the confirmed ship date?
2. Who do we contact to expedite an order that's now at risk of a line-down?
3. Can we get more visibility into current lead times for fasteners and raw steel?
4. What's the process for reporting a shortage before it becomes a production issue?
5. How often does Etnyre's buying cadence get reviewed with suppliers?
6. Is there a standard way to flag a delivery issue outside business hours?
7. Can our team get better forecasting so we can plan our own production around Etnyre's order timing?
8. What's the best way to resolve a recurring MOQ mismatch on smaller orders?

## Strategic Sourcing

*(Ties to Strategic Sourcing & Category Management — category strategy,
negotiations, supplier segmentation, contracts, supplier development —
Pranav/Zoey's area)*

1. Can we revisit the pricing terms in our current supply agreement given recent material cost changes?
2. What's Etnyre's criteria for moving a supplier from "tactical" to "preferred" status?
3. Is there an opportunity to consolidate multiple smaller contracts we hold with Etnyre into one master agreement?
4. How does Etnyre evaluate suppliers for new category opportunities, like the India sourcing initiative mentioned today?
5. What would it take for us to be considered for a multi-year sourcing commitment instead of renewing annually?
6. Is there a formal supplier business review process we should be participating in?
7. How does Etnyre think about dual-sourcing risk for critical components we supply?
8. What's the timeline for the next round of should-cost model discussions?

---

## A few extra prompts for edge-case checklist steps

Use these for the specific edge cases in the UAT checklist rather than the
topic list above:

- **Step 4.6 (anonymous)**: "Is there tension between the procurement and
  strategic sourcing teams that affects how fast our issues get resolved?"
  — a question someone might genuinely want to ask anonymously.
- **Step 4.7 (empty submission)**: leave the text box blank, don't type
  anything.
- **Step 4.9 (near-duplicate grouping)**: submit both — "When does lunch
  start?" and "What time is lunch today?" — same intent, different wording.
- **Step 8.3 (very long text)**: paste a few paragraphs of lorem ipsum or
  copy one of the questions above repeated 15-20 times into a single
  submission.
