-- New terminal-per-attempt status for the upcoming analytics override
-- feature: when analytics manually redirects a question, the outgoing
-- attempt is marked 'reassigned' rather than 'declined' so the audit trail
-- stays honest about *why* it moved (staff override vs an actual speaker
-- decline). Added in its own migration since a new enum value can't be
-- referenced in the same transaction it's created in.
alter type public.routing_status add value if not exists 'reassigned';
