
alter table public.scores
  add constraint scores_user_id_profiles_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;
