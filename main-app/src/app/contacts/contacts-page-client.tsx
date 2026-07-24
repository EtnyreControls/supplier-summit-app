"use client";
import * as React from "react";
import PeopleAltRoundedIcon from "@mui/icons-material/PeopleAltRounded";
import {
  PageContainer,
  SectionHeader,
  TopNav,
  NavLogo,
  ContactsList,
  EmptyState,
  useToast,
  useProfileModal,
  useBadgeQrModal,
  type SavedContact,
} from "@/components";
import { createClient } from "@/lib/supabase/client";
import { useSignOut } from "@/lib/supabase/use-sign-out";

export function ContactsPageClient({ initialContacts }: { initialContacts: SavedContact[] }) {
  const { toast, showToast } = useToast();
  const handleLogout = useSignOut();
  const { profileModal, openProfile } = useProfileModal();
  const { badgeQrModal, openBadgeQr } = useBadgeQrModal();
  const [contacts, setContacts] = React.useState(initialContacts);

  const handleRemove = async (contactUserId: string) => {
    const removed = contacts.find((c) => c.id === contactUserId);
    setContacts((cs) => cs.filter((c) => c.id !== contactUserId));

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("contacts")
      .delete()
      .eq("owner_id", user.id)
      .eq("contact_user_id", contactUserId);

    if (error) {
      // Revert on failure so the list never lies about what's saved.
      if (removed) setContacts((cs) => [...cs, removed]);
      showToast("Couldn't remove that contact", "error");
    }
  };

  return (
    <div className="min-h-dvh bg-background">
      <TopNav logo={<NavLogo />} initials="SC" onQrClick={openBadgeQr} onProfile={openProfile} onLogout={handleLogout} />
      <PageContainer>
        <SectionHeader eyebrow={`${contacts.length} saved`} title="Saved contacts" />

        {contacts.length === 0 ? (
          <EmptyState
            icon={<PeopleAltRoundedIcon sx={{ fontSize: 32 }} />}
            title="No contacts yet"
            body="Scan another attendee's badge QR to save their contact info here."
          />
        ) : (
          <ContactsList contacts={contacts} onRemove={handleRemove} />
        )}
      </PageContainer>
      {toast}
      {profileModal}
      {badgeQrModal}
    </div>
  );
}
