create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  role text not null default 'traveler' check (role in ('traveler', 'admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.destinations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  region text not null default '',
  note text not null default '',
  theme text not null default 'coast',
  featured boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.hotels (
  id uuid primary key default gen_random_uuid(),
  destination_id uuid not null references public.destinations (id) on delete restrict,
  name text not null,
  area text not null default '',
  description text not null default '',
  price_per_night integer not null check (price_per_night > 0),
  rating numeric(2, 1) not null default 4.8 check (rating >= 0 and rating <= 5),
  category text not null default 'Hotel',
  accent text not null default 'sand',
  is_available boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  hotel_id uuid not null references public.hotels (id) on delete restrict,
  check_in date not null,
  check_out date not null,
  guest_count integer not null check (guest_count between 1 and 12),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled')),
  created_at timestamptz not null default now(),
  constraint reservation_dates_ordered check (check_out > check_in)
);

create index if not exists hotels_destination_id_idx on public.hotels (destination_id);
create index if not exists reservations_user_id_created_at_idx on public.reservations (user_id, created_at desc);
create index if not exists reservations_hotel_id_idx on public.reservations (hotel_id);

create or replace function public.is_brisa_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  );
$$;

revoke all on function public.is_brisa_admin() from public;
grant execute on function public.is_brisa_admin() to authenticated;

create or replace function public.create_brisa_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists create_brisa_profile_after_signup on auth.users;
create trigger create_brisa_profile_after_signup
  after insert on auth.users
  for each row execute procedure public.create_brisa_profile();

alter table public.profiles enable row level security;
alter table public.destinations enable row level security;
alter table public.hotels enable row level security;
alter table public.reservations enable row level security;

drop policy if exists "Profiles visible to owner and admins" on public.profiles;
create policy "Profiles visible to owner and admins"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_brisa_admin()));

drop policy if exists "Destinations readable by everyone" on public.destinations;
create policy "Destinations readable by everyone"
  on public.destinations for select to anon, authenticated
  using (true);

drop policy if exists "Admins manage destinations" on public.destinations;
create policy "Admins manage destinations"
  on public.destinations for all to authenticated
  using ((select public.is_brisa_admin()))
  with check ((select public.is_brisa_admin()));

drop policy if exists "Available hotels are public" on public.hotels;
create policy "Available hotels are public"
  on public.hotels for select to anon, authenticated
  using (is_available or (select public.is_brisa_admin()));

drop policy if exists "Admins manage hotels" on public.hotels;
create policy "Admins manage hotels"
  on public.hotels for all to authenticated
  using ((select public.is_brisa_admin()))
  with check ((select public.is_brisa_admin()));

drop policy if exists "Travelers read their reservations" on public.reservations;
create policy "Travelers read their reservations"
  on public.reservations for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_brisa_admin()));

drop policy if exists "Travelers create their own requests" on public.reservations;
create policy "Travelers create their own requests"
  on public.reservations for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'pending'
  );

drop policy if exists "Admins update reservations" on public.reservations;
create policy "Admins update reservations"
  on public.reservations for update to authenticated
  using ((select public.is_brisa_admin()))
  with check ((select public.is_brisa_admin()));

grant select on public.destinations to anon, authenticated;
grant select on public.hotels to anon, authenticated;
grant select on public.profiles to authenticated;
grant select, insert on public.reservations to authenticated;
grant update on public.reservations to authenticated;
grant insert, update, delete on public.destinations, public.hotels to authenticated;

insert into public.destinations (id, name, region, note, theme, featured)
values
  ('11111111-1111-4111-8111-111111111111', 'Cartagena', 'Bolívar · Caribe', 'Calles para perderse y tardes que terminan frente al mar.', 'cartagena', true),
  ('22222222-2222-4222-8222-222222222222', 'Santa Marta', 'Magdalena · Caribe', 'La montaña se encuentra con un mar de muchos azules.', 'santamarta', true),
  ('33333333-3333-4333-8333-333333333333', 'Salento', 'Quindío · Eje Cafetero', 'Café recién hecho, neblina suave y palmas gigantes.', 'salento', true),
  ('44444444-4444-4444-8444-444444444444', 'Guatapé', 'Antioquia · Andes', 'Un pueblo de color y agua quieta para ir sin afán.', 'guatape', true)
on conflict (id) do nothing;

insert into public.hotels (id, destination_id, name, area, description, price_per_night, rating, category, accent, is_available)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '11111111-1111-4111-8111-111111111111', 'Casa Mar y Patio', 'Getsemaní', 'Un patio fresco a pasos de la ciudad amurallada.', 285000, 4.9, 'Casa boutique', 'coral', true),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', '11111111-1111-4111-8111-111111111111', 'Hotel Luna Clara', 'Centro histórico', 'Balcones antiguos, desayuno local y piscina pequeña.', 360000, 4.8, 'Hotel', 'sand', true),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', '22222222-2222-4222-8222-222222222222', 'Brisa del Tayrona', 'Bello Horizonte', 'Despertar entre palmas y caminar hasta la playa.', 245000, 4.7, 'Eco lodge', 'palm', true),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', '22222222-2222-4222-8222-222222222222', 'Casa Nativa', 'Centro', 'Una casa tranquila para volver después de explorar.', 190000, 4.6, 'Casa de huéspedes', 'blue', true),
  ('cccccccc-cccc-4ccc-8ccc-ccccccccccc1', '33333333-3333-4333-8333-333333333333', 'Finca El Recuerdo', 'Vereda Boquía', 'Café de origen y senderos entre guaduales.', 210000, 4.9, 'Finca cafetera', 'green', true),
  ('cccccccc-cccc-4ccc-8ccc-ccccccccccc2', '33333333-3333-4333-8333-333333333333', 'Posada Cocora', 'Salento', 'Una ventana a las montañas y un desayuno de finca.', 175000, 4.7, 'Posada', 'sage', true),
  ('dddddddd-dddd-4ddd-8ddd-ddddddddddd1', '44444444-4444-4444-8444-444444444444', 'Lago Sereno', 'El Peñol', 'Terraza privada con vista abierta al embalse.', 320000, 4.8, 'Cabaña', 'lake', true)
on conflict (id) do nothing;
