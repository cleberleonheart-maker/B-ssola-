-- ============================================================
-- Apagar a minha conta e os dados (ideia #101)
-- ============================================================
-- Nao havia sitio nenhum na app para largar dados. Cada aparelho novo e cada
-- execucao do verificar-crashes.mjs criam uma conta anonima que fica para
-- sempre; a unica forma de a tirar era o Table Editor.
--
-- delete_my_account() apaga as linhas do chamador em todas as tabelas do app
-- e a propria conta em auth.users. A RLS ja protege as linhas com auth.uid(),
-- mas nao chega: apagar o utilizador em auth.users nao e REST, e o Supabase
-- nao deixa o cliente remover-se a si proprio. Entra aqui uma funcao com
-- SECURITY DEFINER -- corre com os poderes de quem a criou (o postgres, via
-- SQL Editor ou Management API), e so confia no que o chamador mandou: o
-- auth.uid() da sessao dele.
--
-- O que impede abusos:
--   * sem sessao (a anon key sozinha) auth.uid() e null -> false, nada corre;
--   * com sessao, o id vem do JWT, e todos os delete sao por esse id: ninguem
--     apaga outro utilizador nem as linhas de outro;
--   * as tabelas de auth (identities, sessions, refresh_tokens) apagam em
--     cascade pela chave do utilizador;
--   * o corpo e uma transacao: se o delete de auth.users falhar, os dados do
--     app em cima tambem voltam para tras.
--
-- Idempotente: create or replace + grant repetido. Corra pelo
-- ./scripts/publicar-sql.sh, que e o que o workflow faz na nuvem.
-- ============================================================

create or replace function public.delete_my_account()
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  meu_id text := nullif(auth.uid()::text, '');
begin
  if meu_id is null then
    return false;
  end if;

  delete from public.virgin_memory where user_id = meu_id;
  delete from public.tracks where user_id = meu_id;
  delete from public.notes where user_id = meu_id;
  delete from public.crashes where user_id = meu_id;
  delete from public.live_points where user_id = meu_id;
  delete from public.live_shares where user_id = meu_id;

  delete from auth.users where id = meu_id::uuid;

  return true;
end;
$$;

-- O app fala com a anon key e uma sessao anonima; precisa de poder chamar.
grant execute on function public.delete_my_account() to anon, authenticated;