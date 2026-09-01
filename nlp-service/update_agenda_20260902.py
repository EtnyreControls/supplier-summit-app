"""One-off update: apply the revised Supplier Summit Agenda (8:15 AM start,
3:00 PM projected finish) to the existing 13 event rows in place, and
re-point the 4 named-speaker links (Justin Nelson, Zoey Henchliffe, Pranav
Amin x2) at the sessions they now actually lead.

Matches existing rows by event_id (captured from the live DB on 2026-09-01)
rather than by topic/start_time, since the live schema has diverged from
seed_agenda.py's original model (event_name now holds the display title,
not topic; status/status_override columns were added by the admin panel).

Safe to re-run: every write is an idempotent update by primary key.
"""

from __future__ import annotations

import os

from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_KEY"]
sb = create_client(SUPABASE_URL, SUPABASE_KEY)

DATE = "2026-09-02"  # unchanged from live data; only times/content move


def t(hhmm: str) -> str:
    return f"{DATE}T{hhmm}:00Z"


# (event_id, event_name, description, duration, start, end)
EVENTS = [
    (
        "54ec1738-2b29-4d1b-b555-8348c3e2c4ff",
        "Registration, Breakfast, Networking",
        "Registration, breakfast, and networking to open the summit, led by the Procurement Team (Karina and Alyssa).",
        "45 min", "08:15", "09:00",
    ),
    (
        "155624cf-df64-47f3-acb8-4341d9705f46",
        "Welcome, Safety Message",
        "Welcome remarks and a safety message to open the summit.",
        "10 min", "09:00", "09:10",
    ),
    (
        "f4d4c383-7e4e-4d0e-a8b6-8fee7450d440",
        "Ice Breaker",
        "A networking icebreaker activity.",
        "30 min", "09:10", "09:40",
    ),
    (
        "d14e0216-4a24-486b-8603-3ce5d286f6c6",
        "Summit Objectives and Introduction to Strategic Sourcing and Procurement",
        "An overview of the summit's objectives and an introduction to strategic sourcing and procurement.",
        "25 min", "09:40", "10:05",
    ),
    (
        "9a08bbcf-2446-4b01-85db-18ef798e457f",
        "Break",
        "",
        "15 min", "10:05", "10:20",
    ),
    (
        "1ecf01ef-b001-4a4e-bca9-f8ace46917a5",
        "Business Unit Gallery Walk (15 mins each) + Breakout Session",
        "A gallery walk across Etnyre's business units followed by a breakout session, hosted by business unit leaders and buyers.",
        "80 min", "10:20", "11:40",
    ),
    (
        "fdb2185f-eb77-4848-9a76-0b4c63a9eacc",
        "Global Growth & Strategic Sourcing",
        "A session on global growth and strategic sourcing.",
        "20 min", "11:40", "12:00",
    ),
    (
        "ddff2bea-7a1a-417a-b7fc-3b5902e7bf5a",
        "Lunch & Networking",
        "Lunch and networking.",
        "45 min", "12:00", "12:45",
    ),
    (
        "6cbf1179-d7b3-4157-a16a-71945768de09",
        "Growth Machine - Interactive Workshop",
        "An interactive Growth Machine workshop led by Procurement Leadership - Strategic Sourcing.",
        "50 min", "12:45", "13:35",
    ),
    (
        "8ad0a503-9f67-4489-93b5-f5c8361b3c9a",
        "Team Presentations and Feedback (3 mins each)",
        "Team presentations and feedback from the day's workshops.",
        "30 min", "13:35", "14:05",
    ),
    (
        "650efd2e-bb5f-4e7f-98e7-9c6112ce52a9",
        "Break",
        "",
        "15 min", "14:05", "14:20",
    ),
    (
        "295b52d6-0047-46c2-b05e-1e73f0817ccb",
        "Voice of Supplier: Partnership Priorities & Live Dialogue",
        "A live dialogue on supplier partnership priorities.",
        "30 min", "14:20", "14:50",
    ),
    (
        "5121a5b6-90bc-4233-b6c9-f36bd98a27d5",
        "Closing Remarks, Partnership Commitments & Next Steps",
        "Closing remarks, partnership commitments, and next steps.",
        "10 min", "14:50", "15:00",
    ),
]

# (speaker_id, new event_id) -- re-point existing speaker links rather than
# creating new ones; user_id/bio stay as already set in the speakers table.
SPEAKER_MOVES = [
    # Justin Nelson (VP Supply Chain): Welcome -> Summit Objectives
    ("afbb0199-785f-4dde-8d6d-efcae02feb85", "d14e0216-4a24-486b-8603-3ce5d286f6c6"),
    # Zoey Henchliffe (Supplier Development Manager): Welcome -> Ice Breaker
    ("5cbd2d97-6678-46a3-b95f-c6e70126b098", "f4d4c383-7e4e-4d0e-a8b6-8fee7450d440"),
    # Zoey Henchliffe: Gallery Walk -> Global Growth & Strategic Sourcing
    ("188962ef-b51f-46f4-b655-a81cd5761182", "fdb2185f-eb77-4848-9a76-0b4c63a9eacc"),
    # Pranav Amin (Director of Strategic Sourcing): Gallery Walk -> Global Growth & Strategic Sourcing
    ("91535e38-46a4-4359-8109-53f59eee78d8", "fdb2185f-eb77-4848-9a76-0b4c63a9eacc"),
    # Pranav Amin's Welcome link (b3672f78) already sits on the Welcome event - no move needed.
]

CHARLIE_BIO = (
    "Charlie Payne is the Director of Operations at Hendrick Screen, bringing more than 30 "
    "years of progressive manufacturing experience across a variety of industries, "
    "including leadership roles with companies such as HNI, Doncasters and UniFirst. "
    "Throughout his career, Charlie has held positions spanning quality, safety, IT, "
    "operations, and continuous improvement. His passion, however, is the factory floor, "
    "where he believes the best solutions are found by engaging directly with the people "
    "and processes that drive the business. He is often found “gone to gemba,” working "
    "alongside team members to identify opportunities, solve problems, and improve "
    "performance.\n"
    "Charlie holds a B.S. in Applied Mathematics and Computer Studies from Brescia "
    "University and a Lean Six Sigma Black Belt from Villanova University."
)

BLAKE_BIO = (
    "With 23 years of progressive experience, Blake Overocker is a Senior Manufacturing "
    "Engineer recognized for his operational depth and engineering leadership. He began "
    "his career in 2003 in the blast department and developed expertise across machining, "
    "welding, shipping, blasting, plasma, and laser operations. Blake’s strong performance "
    "and technical aptitude led him into a supervisor role overseeing the oil pan weld shop "
    "and CNC machining department, where he spent five years driving team performance and "
    "production quality. He later transitioned into engineering, programming welding robots "
    "and supporting automated welding systems before moving into a Manufacturing Engineer "
    "role focused on new product quoting, process development, and production support. "
    "Blake’s contributions, leadership, and cross‑departmental experience culminated in "
    "his advancement to Senior Manufacturing Engineer, where he continues to influence "
    "manufacturing strategy, process optimization, and production readiness."
)

# (user_id, event_id, bio) -- new speaker links to create for the Gallery Walk.
# Todd Cremer already has a speakers row/bio (see the existing "Meet Todd
# Cremer" card), so he's excluded here; Charlie and Blake don't have
# speakers-table rows yet. Their user accounts currently have
# role="attendee"; left as-is since presenting at the gallery walk doesn't
# require a "speaker"-role login.
NEW_SPEAKERS = [
    ("51833423-cd11-4643-b77c-5cf4175f977e", "1ecf01ef-b001-4a4e-bca9-f8ace46917a5", CHARLIE_BIO),
    ("d7126558-a6be-4079-b1f4-00e727faa73f", "1ecf01ef-b001-4a4e-bca9-f8ace46917a5", BLAKE_BIO),
]

JUSTIN_BIO = (
    "Justin Nelson is the Executive Vice President of Supply Chain, Information Technology "
    "& Strategy at Etnyre International, a 128-year-old, fourth-generation family-owned "
    "manufacturer serving the roadbuilding, transportation infrastructure, heavy "
    "fabrication and perforated metal markets. In this role, he leads the company’s "
    "enterprise supply chain and information technology functions while helping shape its "
    "long-term business strategy.\n"
    "Since joining Etnyre in 2020, Justin has helped lead several of the company’s most "
    "significant enterprise transformations. His work has included modernizing core "
    "business systems, strengthening cybersecurity and technology infrastructure, "
    "advancing the company’s digital and data capabilities, and developing a more "
    "coordinated approach to strategic sourcing, procurement and supplier management. He "
    "is focused on building scalable enterprise capabilities that support profitable "
    "growth, operational resilience and stronger decision-making across Etnyre’s "
    "businesses.\n"
    "Prior to joining Etnyre International, Justin held progressive leadership positions "
    "at Caterpillar Inc. and Kemper Valve & Fittings Corp. His career has spanned supply "
    "chain, information technology, business transformation and enterprise strategy, with "
    "experience in strategic sourcing, supplier management, enterprise resource planning, "
    "application development, cybersecurity, mergers and acquisitions, infrastructure and "
    "service delivery. He is passionate about building strong teams and using technology, "
    "data and disciplined management systems to help complex organizations perform "
    "better.\n"
    "Beyond his work at Etnyre, Justin has served as a guest speaker, panelist and "
    "contributing writer on topics spanning digital transformation, purposeful leadership "
    "and data literacy.\n"
    "Justin earned a B.S. in Operations and Information Management and an M.S. in "
    "Management Information Systems from Northern Illinois University. He is currently "
    "pursuing a Master of Supply Chain Management through the Smeal College of Business "
    "at The Pennsylvania State University."
)

PRANAV_BIO = (
    "Pranav Amin is Director of Strategic Sourcing & Category Management at "
    "Etnyre International, where he leads enterprise category strategies, global "
    "sourcing initiatives, supplier portfolio management, and commercial sourcing "
    "capabilities in support of supply resiliency, cost competitiveness, and "
    "long-term growth. With more than 25 years of experience across "
    "engineering, product strategy, new product introduction, operations, and "
    "global manufacturing environments, Pranav has built a career connecting "
    "technical, operational, and commercial excellence. Prior to joining Etnyre, he "
    "led product and technology strategy initiatives for multiple Caterpillar product "
    "lines, managing global teams, supplier engagement, cost optimization "
    "programs, and major product introductions. Since joining Etnyre, he has "
    "played a key role in advancing global sourcing and localization efforts in "
    "India and driving operational improvement initiatives. Pranav holds an MBA "
    "from Northern Illinois University and is a Six Sigma Black Belt."
)

GANESH_BIO = (
    "Ganesh Iyer is the President and CEO of Etnyre International, a 127-yr old, 4th "
    "generation family-owned company that manufactures a wide range of equipment for the "
    "asphalt road building and transportation industry. More recently, the company has "
    "entered into the business of heavy metal fabrications for large OEMs. Under his "
    "leadership, the company has grown profitably by more than 50% in the past 4 years. "
    "He has enabled the growth of this company by laying the path for significant "
    "cultural and business transformations. He is a champion of “Doing Well by Doing "
    "Good” and is pursuing a life-long passion of making a difference in the lives of "
    "people.\n"
    "Prior to joining Etnyre International in May 2018, Ganesh had a very successful "
    "career at Caterpillar Inc. He worked for about 20 years in progressive roles at "
    "Caterpillar, developing and growing profitable businesses across global and emerging "
    "markets. His career has spanned every business function including executive and "
    "general management, manufacturing operations, supply chain, distribution, "
    "engineering, 6 Sigma and Mergers and Acquisitions. Before leaving Caterpillar, he was "
    "Director and Global Head for the company’s ~$1B Power Generation business.\n"
    "Over the years, Ganesh has served on Caterpillar corporate boards, including Asia "
    "Power Systems in China and Caterpillar India Private Limited in India. Ganesh also "
    "served as a trustee on the Rockford University Board from 2019-2023. Currently, "
    "Ganesh serves as a director on the Boards of Etnyre International and Neuco, Inc. He "
    "is a member of the People & Compensation Committee and Investment Committee on The "
    "Etnyre International board and the Chair of the People & Compensation Committee on "
    "Neuco, Inc. Board.\n"
    "Ganesh completed his Ph.D. in Mechanical Engineering at The Pennsylvania State "
    "University and his M.E. in Engineering Management from the University of Wisconsin. "
    "Earlier degrees include an M.E. in Aerospace Engineering and M.S. in Mechanical "
    "Engineering from The Pennsylvania State University, and a B.E. in Mechanical "
    "Engineering from Gujarat University in India."
)

ZOEY_BIO = (
    "Zoey Henchliffe is the Supplier Development Manager at Etnyre International, with "
    "more than 15 years of experience in procurement, strategic sourcing and supply chain "
    "management across the UK and United States.\n"
    "Her career has included leadership roles in procurement and supply chain, providing "
    "her with extensive experience across manufacturing and public-sector environments.\n"
    "Zoey holds professional qualifications in Procurement and Supply through the "
    "Chartered Institute of Procurement & Supply (CIPS). At Etnyre, she focuses on "
    "developing strategic supplier partnerships, improving performance, mitigating supply "
    "chain risk and identifying opportunities for sustainable cost optimization and "
    "mutual growth."
)

# (speaker_id, bio) -- overwrite the short role-label bios on existing
# speaker rows with the full bios above. Each person has 2 rows (one per
# session they speak at); both get the same full bio.
BIO_UPDATES = [
    ("afbb0199-785f-4dde-8d6d-efcae02feb85", JUSTIN_BIO),   # Justin - Summit Objectives
    ("56745d09-db3f-4539-b296-a17a510fe339", JUSTIN_BIO),   # Justin - Closing Remarks
    ("5cbd2d97-6678-46a3-b95f-c6e70126b098", ZOEY_BIO),      # Zoey - Ice Breaker
    ("188962ef-b51f-46f4-b655-a81cd5761182", ZOEY_BIO),      # Zoey - Global Growth
    ("b3672f78-1e35-4cc3-b7d7-38454530ef40", PRANAV_BIO),    # Pranav - Welcome
    ("91535e38-46a4-4359-8109-53f59eee78d8", PRANAV_BIO),    # Pranav - Global Growth
    ("c9bcc878-8c96-4b8f-8482-ed1d905be8c7", GANESH_BIO),    # Ganesh - Voice of Supplier
]


def main() -> None:
    for event_id, event_name, description, duration, start, end in EVENTS:
        sb.table("event").update(
            {
                "event_name": event_name,
                "description": description,
                "duration": duration,
                "start_time": t(start),
                "end_time": t(end),
            }
        ).eq("event_id", event_id).execute()
        print(f"  updated: {start}-{end} {event_name}")

    for speaker_id, new_event_id in SPEAKER_MOVES:
        sb.table("speakers").update({"event_id": new_event_id}).eq("speaker_id", speaker_id).execute()
        print(f"  speaker {speaker_id} -> event {new_event_id}")

    for user_id, event_id, bio in NEW_SPEAKERS:
        existing = (
            sb.table("speakers").select("speaker_id").eq("user_id", user_id).eq("event_id", event_id).execute()
        )
        if existing.data:
            print(f"    speaker link exists: {bio} -> {event_id}")
            continue
        sb.table("speakers").insert({"user_id": user_id, "event_id": event_id, "bio": bio}).execute()
        print(f"    speaker linked -> event {event_id}")

    for speaker_id, bio in BIO_UPDATES:
        sb.table("speakers").update({"bio": bio}).eq("speaker_id", speaker_id).execute()
        print(f"  bio updated: {speaker_id}")


if __name__ == "__main__":
    main()
