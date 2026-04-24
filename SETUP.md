# Compass — Setup Guide

---

## PART 1 — Supabase

### 1. Create a Supabase project
Go to supabase.com → New project → name it `compass` → any region → Create.

### 2. Run this SQL in the SQL Editor
Go to your project → SQL Editor → New query → paste ALL of this → Run:

```sql
-- Profiles table (links email to user ID for trip sharing)
create table profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text unique not null
);
alter table profiles enable row level security;
create policy "Profiles viewable by authenticated users" on profiles
  for select using (auth.role() = 'authenticated');
create policy "Users can insert own profile" on profiles
  for insert with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Boards table (shared board data)
create table boards (
  id text primary key,
  data jsonb not null,
  updated_at timestamp with time zone default now()
);
alter table boards enable row level security;
create policy "Allow all authenticated" on boards
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Trips table
create table trips (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  data jsonb not null,
  created_at timestamp with time zone default now()
);
alter table trips enable row level security;
create policy "Owners can manage trips" on trips
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Members can view shared trips" on trips
  for select using (
    exists (select 1 from trip_members where trip_id = trips.id and user_id = auth.uid())
  );
create policy "Members can update shared trips" on trips
  for update using (
    exists (select 1 from trip_members where trip_id = trips.id and user_id = auth.uid())
  );

-- Trip members (sharing)
create table trip_members (
  id uuid default gen_random_uuid() primary key,
  trip_id text references trips(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade,
  invited_email text not null,
  created_at timestamp with time zone default now(),
  unique(trip_id, invited_email)
);
alter table trip_members enable row level security;
create policy "Trip owners can manage members" on trip_members
  for all using (exists (select 1 from trips where id = trip_id and user_id = auth.uid()));
create policy "Members can view own memberships" on trip_members
  for select using (
    user_id = auth.uid() or
    invited_email = (select email from profiles where id = auth.uid())
  );

-- Auto-link invites when new user signs up
create or replace function public.link_pending_invites()
returns trigger as $$
begin
  update trip_members set user_id = new.id
  where invited_email = new.email and user_id is null;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_profile_created
  after insert on public.profiles
  for each row execute procedure public.link_pending_invites();
```

### 3. Enable Email Auth
- Go to **Authentication** → **Providers**
- Make sure **Email** is enabled
- Optional: go to **Authentication** → **Email Templates** and disable email confirmation for easier testing

### 4. Get your API keys
- Go to **Settings** → **API**
- Copy your **Project URL** and **anon public** key — you'll need these in Step 7

---

## PART 2 — Your Computer

### 5. Download and unzip
Download the `compass.zip` file and unzip it onto your Desktop.

### 6. Open Terminal and install
```bash
cd desktop/compass
npm install
```

### 7. Add your Supabase keys
Open `src/supabase.js` in VS Code and paste your keys:
```js
const SUPABASE_URL  = 'https://YOUR_PROJECT.supabase.co'
const SUPABASE_ANON = 'eyJ...'
```

### 8. Test the build
```bash
npm run build
```
Should say "built in X.Xs" with no errors.

---

## PART 3 — GitHub

### 9. Create a new repo
- Go to github.com → + → New repository
- Name it exactly: `compass`
- Set to **Public**
- Leave empty → Create repository

### 10. Add GitHub Secrets
Go to your new repo → **Settings** → **Secrets and variables** → **Actions** → add:
- Name: `VITE_SUPABASE_URL` · Value: your Supabase project URL
- Name: `VITE_SUPABASE_ANON` · Value: your anon public key

### 11. Push to GitHub
In terminal (still in the compass folder):
```bash
git init
git add .
git commit -m "first commit"
git remote add origin https://github.com/jpgraziani/compass.git
git branch -M main
git push -u origin main
```
Use your GitHub username and token as password (token needs **repo** + **workflow** checked).

### 12. Enable GitHub Pages
- Go to repo → **Settings** → **Pages**
- Source: **GitHub Actions** → Save

### 13. Wait for deploy
- Click the **Actions** tab
- Wait ~1 minute for the green checkmark

### 14. Your app is live!
```
https://jpgraziani.github.io/compass/
```

---

## Add to iPhone home screen
1. Open the URL in **Safari**
2. Tap the **Share** button (box with arrow)
3. Tap **Add to Home Screen**
4. Done — it looks and feels like a real app!

---

## Sharing with your wife

**You:**
1. Sign up at the app URL with your email
2. Create a trip → open it → tap **👥 Share** → enter your wife's email

**Your wife:**
1. She signs up at the same URL with her email
2. The shared trip automatically appears in her Trips tab
3. Both of you can edit everything — flights, lodging, itinerary, packing, budget, notes

**The board is fully shared** — any changes either of you make to lists and cards are visible to both of you instantly.

---

## Troubleshooting

**Blank page after deploy** → Check that `vite.config.js` has `base: '/compass/'`

**Data not saving** → Check your Supabase URL and anon key are correct in `src/supabase.js`

**Can't push to GitHub** → Make sure your token has both **repo** and **workflow** scopes checked
