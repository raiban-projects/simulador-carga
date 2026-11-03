-- Tabela pequena para a tarefa "Manter banco ligado" (.github/workflows/manter-banco-ligado.yml).
-- Só ler as tabelas não bastou: o Supabase pausou mesmo assim (31/10/2026). Agora a tarefa também GRAVA
-- todo dia a data/hora numa linha só desta tabela (sempre a mesma linha, não acumula nada).
-- Rodar UMA vez no painel do Supabase: SQL Editor → New query → colar tudo → Run.
create table if not exists public.manter_ligado (
  id int primary key,
  em timestamptz not null default now()
);
alter table public.manter_ligado enable row level security;
drop policy if exists "manter ligado" on public.manter_ligado;
create policy "manter ligado" on public.manter_ligado for all to anon using (true) with check (true);
grant select, insert, update on public.manter_ligado to anon;
