-- Apply before deploying the frontend that calls complete_inventory_audit.
-- Atomic, retry-safe stocktake; rejects quantities changed since counting.
alter table public.inventory_audits add column if not exists client_request_id uuid;
alter table public.inventory_audits add column if not exists request_payload jsonb;
create unique index if not exists inventory_audits_client_request_id_key
  on public.inventory_audits(client_request_id) where client_request_id is not null;

create or replace function public.complete_inventory_audit(p_rows jsonb, p_note text, p_client_request_id uuid)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  audit_id bigint;
  payload jsonb := jsonb_build_object('rows', p_rows, 'note', p_note);
  previous_payload jsonb;
  row_data record;
  item public.inventory_items%rowtype;
begin
  if p_client_request_id is null or jsonb_typeof(p_rows) is distinct from 'array' then
    raise exception 'invalid_audit';
  end if;
  if jsonb_array_length(p_rows) = 0 or jsonb_array_length(p_rows) > 10000 or length(coalesce(p_note,'')) > 4000 then
    raise exception 'invalid_audit';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_client_request_id::text, 0));
  select a.id, a.request_payload into audit_id, previous_payload from public.inventory_audits a where a.client_request_id = p_client_request_id;
  if found then
    if previous_payload is distinct from payload then raise exception 'request_id_conflict'; end if;
    return audit_id;
  end if;
  if exists (select 1 from jsonb_array_elements(p_rows) r where jsonb_typeof(r) <> 'object'
    or jsonb_typeof(r->'qty_before') is distinct from 'number' or jsonb_typeof(r->'qty_actual') is distinct from 'number') then
    raise exception 'invalid_audit_quantity';
  end if;
  if (select count(distinct r.item_id) from jsonb_to_recordset(p_rows) as r(item_id bigint)) <> jsonb_array_length(p_rows) then
    raise exception 'invalid_audit_items';
  end if;
  -- Deterministic row locks also serialize against issue/receive RPCs.
  for row_data in select * from jsonb_to_recordset(p_rows) as r(item_id bigint, qty_before numeric, qty_actual numeric) order by item_id loop
    if row_data.qty_actual < 0 or row_data.qty_actual > 1000000000 or row_data.qty_before < 0 or row_data.qty_before > 1000000000 then
      raise exception 'invalid_audit_quantity';
    end if;
    select * into item from public.inventory_items where id = row_data.item_id for update;
    if not found or item.quantity is distinct from row_data.qty_before then raise exception 'inventory_changed'; end if;
  end loop;
  insert into public.inventory_audits(note,total_items,items_with_diff,client_request_id,request_payload)
  select p_note,jsonb_array_length(p_rows),count(*) filter(where r.qty_actual <> r.qty_before),p_client_request_id,payload
    from jsonb_to_recordset(p_rows) as r(qty_before numeric,qty_actual numeric)
  returning id into audit_id;
  insert into public.inventory_audit_items(audit_id,item_id,item_name,category,unit,qty_before,qty_actual)
  select audit_id,i.id,i.name,i.category,i.unit,r.qty_before,r.qty_actual
  from jsonb_to_recordset(p_rows) as r(item_id bigint,qty_before numeric,qty_actual numeric)
  join public.inventory_items i on i.id=r.item_id;
  update public.inventory_items i set quantity=r.qty_actual
  from jsonb_to_recordset(p_rows) as r(item_id bigint,qty_actual numeric) where i.id=r.item_id;
  return audit_id;
end;
$$;
revoke all on function public.complete_inventory_audit(jsonb,text,uuid) from public;
grant execute on function public.complete_inventory_audit(jsonb,text,uuid) to anon,authenticated,service_role;
notify pgrst, 'reload schema';
