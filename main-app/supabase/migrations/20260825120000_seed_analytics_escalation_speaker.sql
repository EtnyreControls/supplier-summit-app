-- nlp-service's route_question() (app.py, ANALYTICS_SPEAKER_ID) has always
-- assumed a fixed speakers row with this id exists as the universal
-- escalation target every tag's routing chain falls back to. Its own
-- comment attributes that seed to "analytics_logistics_speaker.sql", but no
-- such migration was ever actually committed — confirmed missing while
-- testing routing (every route that reached the Analytics step failed with
-- a question_routing_speaker_id_fkey violation, since 00000000-0000-0000-
-- 0000-00000000a17c didn't exist in speakers). user_id/event_id are null:
-- this isn't a real person, just a stable FK target.
insert into public.speakers (speaker_id, user_id, event_id, bio)
values (
  '00000000-0000-0000-0000-00000000a17c',
  null,
  null,
  'Analytics team — universal escalation target for question routing (not a real person; see nlp-service/app.py ANALYTICS_SPEAKER_ID).'
)
on conflict (speaker_id) do nothing;
