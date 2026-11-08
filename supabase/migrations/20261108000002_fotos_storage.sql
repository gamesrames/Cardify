-- Bucket privado das fotos das cartas. A Edge Function grava com a chave de
-- serviço (ignora RLS); o dono lê a própria pasta. Quando o adversário precisar
-- ver as fotos (fase 4), acrescente uma policy nova aqui.
insert into storage.buckets (id, name, public) values ('card-photos', 'card-photos', false)
on conflict (id) do nothing;

create policy "dono lê as próprias fotos" on storage.objects
  for select to authenticated
  using (bucket_id = 'card-photos' and (storage.foldername(name))[1] = auth.uid()::text);
