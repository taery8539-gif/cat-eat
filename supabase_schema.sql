-- 밥먹었냥 (Cat Care App) Supabase Database Schema
-- Supabase 대시보드의 'SQL Editor'에 붙여넣고 [Run]을 누르면 테이블이 자동 생성됩니다.

-- 1. records 테이블 생성
create table if not exists public.records (
  id text primary key,
  type text not null check (type in ('feeding', 'sighting')),
  author text not null,
  time timestamptz not null default now(),
  food_type text,
  cat_seen boolean default true,
  sighting_status text,
  memo text,
  photo text,
  created_at timestamptz not null default now()
);

-- 2. RLS (Row Level Security) 설정 (누구나 읽기/쓰기 가능하도록 허용)
alter table public.records enable row level security;

create policy "Allow all read" on public.records for select using (true);
create policy "Allow all insert" on public.records for insert with check (true);
create policy "Allow all update" on public.records for update using (true);
create policy "Allow all delete" on public.records for delete using (true);

-- 3. 실시간 변경사항(Realtime) 구독 활성화
alter publication supabase_realtime add table public.records;
