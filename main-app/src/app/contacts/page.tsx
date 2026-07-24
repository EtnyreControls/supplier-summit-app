import { createClient } from "@/lib/supabase/server";
import { ContactsPageClient } from "./contacts-page-client";
import type { SavedContact } from "@/components";

/**
 * Route: /contacts ("Saved contacts", linked from the profile menu)
 * Server Component: reads the signed-in user's own contacts row-set
 * directly (RLS's "view own contacts" policy scopes this to owner_id =
 * auth.uid(), same as every other own-data fetch in this app).
 */

type ContactRow = {
  contact_user_id: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
};

export default async function ContactsPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("contacts")
    .select("contact_user_id, first_name, last_name, company, email, phone")
    .order("saved_at", { ascending: false })
    .returns<ContactRow[]>();

  const contacts: SavedContact[] = (data ?? []).map((row) => ({
    id: row.contact_user_id,
    name: [row.first_name, row.last_name].filter(Boolean).join(" ") || "Attendee",
    company: row.company,
    email: row.email,
    phone: row.phone,
  }));

  return <ContactsPageClient initialContacts={contacts} />;
}
