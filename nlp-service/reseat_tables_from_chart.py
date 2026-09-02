"""Full reseat of the 12 Growth Machine tables (also used as the "Welcome -
Find Your Table" seating chart, see main-app/src/app/welcome/page.tsx) to
match the authoritative seating chart image (2026-09-01).

Clears all existing event_table_members rows for the GM event first (they
were random auto-assign-trigger seeding, not this chart) and rebuilds from
scratch: only people whose `company` matches one of a table's listed
companies, plus that table's named Etnyre host, get seated. Everyone else
(unmatched Etnyre staff, no-company rows, test rows) ends up with no table
row at all -- intentional, per "if someone has no table, skip mentioning
it" -- /welcome already falls back gracefully once that page stops
rendering "TBD" for a missing membership (separate app-code fix).

is_builder is left false for everyone here -- this script is about seating
assignment, not who builds the GM board; that's assigned separately.
"""

from __future__ import annotations

import os

from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_KEY"]
sb = create_client(SUPABASE_URL, SUPABASE_KEY)

GM_EVENT_ID = "6cbf1179-d7b3-4157-a16a-71945768de09"

TABLE_IDS = {
    "1": "b19afda9-c40e-418b-a39b-bd9821b4682c",
    "2": "37003ac1-12ab-4fcd-99b8-974256946e78",
    "3": "c8b40e58-dcc2-46a1-8d71-1841aef7bb99",
    "4": "a31d168f-8db9-409f-9f53-ee9a4a53e1d6",
    "5": "1c35093e-92a9-4819-ad1b-819421f165aa",
    "6": "ce47ed5b-998e-49d7-b1d1-dd2e628bd81f",
    "7": "f8cc4b55-2522-4ed1-82a5-eb600fcf6615",
    "8": "550f2d89-f7bb-4934-8158-5f2ef04cbe7c",
    "9": "99c35b7d-dabb-460b-8b4e-12eacf5b5ff6",
    "10": "fb9d4fda-ce64-4afe-b885-904eafa3b2d2",
    "11": "5c26970c-786a-4d50-9ac3-1d583b118a77",
    "12": "125f9908-77a1-4d63-acbf-a7588a3fa6ad",
}

# table_name -> (companies as they appear in user.company, host "First Last")
CHART = {
    "1": (
        ["Evolution Motion Solutions", "O'Brien Steel", "Truck-Lite", "Heale Manufacturing Co., LLC"],
        "Michael Carlson",
    ),
    "2": (
        ["SunSource", "McNeilus Steel, Inc.", "R.W. Beckett Corp and Wayne Combustion Systems"],
        "Shane Theiss",
    ),
    "3": (
        ["Bridgestone Hosepower", "Fastenal", "Kessler Inc.", "Chicago Tube & Iron"],
        "Karina Phomsopha",
    ),
    "4": (
        ["CK Power", "Liebovich Steel & Aluminum", "Connector Concepts Inc.", "MFC"],
        "Du Hua",
    ),
    "5": (
        ["PSP Seals", "Ken Mac", "FPE Automation", "Trombetta"],
        "Michael Hutchinson",
    ),
    "6": (
        ["Muncie Power Products", "Bellini's Custom Welding & Auto Repair", "ifm efector", "Meridian"],
        None,  # "Dean Fox" -- no matching user account, left host-less
    ),
    "7": (
        ["Trinity Products", "Weimer Bearing & Transmission, Inc.", "Pomps Tire Service"],
        "Michael Massey",
    ),
    "8": (
        ["Esmark Steel Group", "Burns Industrial Supply", "C.H Robinson"],
        "Cody Montgomery",
    ),
    "9": (
        ["O'Neal Steel", "W.L. Deckert Co., Inc.", "Cummins Sales and Service"],
        "Shannon Mulcahy",
    ),
    "10": (
        ["Chatham Steel", "Berendsen", "Welders Supply Company"],
        "Divrina Gupta",
    ),
    "11": (
        ["Barsteel Corp", "Wesco", "Hendrickson"],
        "Charlie Payne",
    ),
    "12": (
        ["Lincoln Electric", "Worldwide Sourcing & Solutions", "Value Added Distributors",
         "Agility Engineering & Manufacturing Solutions"],
        "Alyssa Vinke",
    ),
}


def main() -> None:
    users = sb.table("user").select("user_id, first_name, last_name, company").execute().data
    by_company: dict[str, list[str]] = {}
    by_name: dict[str, str] = {}
    for u in users:
        company = (u.get("company") or "").strip()
        if company:
            by_company.setdefault(company, []).append(u["user_id"])
        name = f"{(u.get('first_name') or '').strip()} {(u.get('last_name') or '').strip()}".strip()
        if name:
            by_name[name] = u["user_id"]

    # Clear the slate: every existing membership for this event's tables.
    gm_table_ids = list(TABLE_IDS.values())
    sb.table("event_table_members").delete().in_("table_id", gm_table_ids).execute()
    print(f"  cleared all existing memberships across {len(gm_table_ids)} tables")

    unmatched: list[str] = []
    for table_name, (companies, host) in CHART.items():
        table_id = TABLE_IDS[table_name]
        seat_user_ids: set[str] = set()

        for company in companies:
            matches = by_company.get(company)
            if not matches:
                unmatched.append(f"table {table_name}: no users found for company '{company}'")
                continue
            seat_user_ids.update(matches)

        if host:
            host_id = by_name.get(host)
            if not host_id:
                unmatched.append(f"table {table_name}: host '{host}' not found")
            else:
                seat_user_ids.add(host_id)

        rows = [{"table_id": table_id, "user_id": uid, "is_builder": False} for uid in seat_user_ids]
        if rows:
            sb.table("event_table_members").insert(rows).execute()
        print(f"  table {table_name}: seated {len(rows)} people (host: {host or 'none'})")

    if unmatched:
        print("\n  Unmatched:")
        for line in unmatched:
            print("   -", line)


if __name__ == "__main__":
    main()
