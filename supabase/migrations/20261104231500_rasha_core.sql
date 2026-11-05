-- RASHA local schema migration. Review and apply only to an explicitly approved Supabase project.
-- No product/demo rows are seeded. The only seeded setting is the store WhatsApp number
-- explicitly supplied in the product brief.

create extension if not exists pgcrypto with schema extensions;

create type public.product_type as enum ('original', 'blended');
create type public.order_status as enum (
  'whatsapp_initiated', 'contacted', 'confirmed', 'preparing',
  'out_for_delivery', 'delivered', 'cancelled'
);
create type public.review_status as enum ('pending', 'approved', 'rejected');
create type public.inventory_change_type as enum ('order_confirmed', 'order_cancelled', 'manual_adjustment');

create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete restrict,
  display_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index admin_users_single_active_guard on public.admin_users ((is_active)) where is_active;

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  description text,
  logo_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description text,
  image_url text,
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 180),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description text,
  product_type public.product_type not null,
  brand_id uuid references public.brands(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null,
  scent_family text,
  notes text[] not null default '{}',
  origin_country text,
  is_published boolean not null default false,
  is_featured boolean not null default false,
  is_best_seller boolean not null default false,
  display_order integer not null default 0,
  search_vector tsvector generated always as (
    to_tsvector('simple'::regconfig,
      coalesce(name, '') || ' ' || coalesce(description, '') || ' ' ||
      coalesce(scent_family, '') || ' ' || coalesce(array_to_string(notes, ' '), ''))
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  size_label text not null check (length(trim(size_label)) between 1 and 80),
  price numeric(12,2) not null check (price >= 0),
  compare_at_price numeric(12,2) check (compare_at_price is null or compare_at_price >= price),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  low_stock_threshold integer not null default 5 check (low_stock_threshold >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, size_label)
);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  image_url text not null,
  alt_text text,
  display_order integer not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index product_images_one_primary_per_product
  on public.product_images(product_id) where is_primary;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  status public.order_status not null default 'whatsapp_initiated',
  subtotal numeric(12,2) not null check (subtotal >= 0),
  currency text not null default 'ILS' check (currency = 'ILS'),
  delivery_cost numeric(12,2) check (delivery_cost is null or delivery_cost >= 0),
  customer_name text check (customer_name is null or length(customer_name) <= 120),
  customer_phone text check (customer_phone is null or length(customer_phone) <= 40),
  notes text check (notes is null or length(notes) <= 2000),
  idempotency_key text not null unique check (length(idempotency_key) between 8 and 128),
  request_hash text not null,
  stock_deducted_at timestamptz,
  stock_restored_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  confirmed_at timestamptz
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  product_id uuid references public.products(id) on delete set null,
  variant_id uuid references public.product_variants(id) on delete restrict,
  product_name_snapshot text not null,
  product_type_snapshot public.product_type not null,
  variant_name_snapshot text not null,
  unit_price_snapshot numeric(12,2) not null check (unit_price_snapshot >= 0),
  quantity integer not null check (quantity > 0),
  line_total numeric(14,2) not null check (line_total >= 0),
  created_at timestamptz not null default now()
);

create table public.inventory_logs (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid references public.product_variants(id) on delete set null,
  change_type public.inventory_change_type not null,
  quantity_change integer not null check (quantity_change <> 0),
  previous_quantity integer not null check (previous_quantity >= 0),
  new_quantity integer not null check (new_quantity >= 0),
  reason text not null check (length(trim(reason)) between 1 and 500),
  order_id uuid references public.orders(id) on delete set null,
  created_by uuid references public.admin_users(user_id) on delete set null,
  created_at timestamptz not null default now(),
  check (new_quantity = previous_quantity + quantity_change)
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  customer_name text not null check (length(trim(customer_name)) between 1 and 120),
  rating smallint not null check (rating between 1 and 5),
  comment text check (comment is null or length(comment) <= 2000),
  status public.review_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.banners (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 1 and 180),
  description text,
  image_url text not null,
  link_url text,
  is_active boolean not null default false,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.site_sections (
  id uuid primary key default gen_random_uuid(),
  section_key text not null unique check (section_key ~ '^[a-z0-9_]+$'),
  title text not null check (length(trim(title)) between 1 and 180),
  description text,
  is_active boolean not null default false,
  display_order integer not null default 0,
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.site_section_products (
  section_id uuid not null references public.site_sections(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  display_order integer not null default 0,
  primary key (section_id, product_id),
  unique (section_id, display_order)
);

create table public.site_settings (
  key text primary key check (key ~ '^[a-z0-9_]+$'),
  value jsonb not null default '{}'::jsonb check (jsonb_typeof(value) = 'object'),
  is_public boolean not null default false,
  updated_by uuid references public.admin_users(user_id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.admin_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.admin_users(user_id) on delete set null,
  action text not null check (length(trim(action)) between 1 and 120),
  entity_type text not null check (length(trim(entity_type)) between 1 and 80),
  entity_id uuid,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz not null default now()
);

create table public.api_rate_limits (
  rate_key text primary key,
  window_started_at timestamptz not null,
  request_count integer not null check (request_count >= 0),
  updated_at timestamptz not null default now()
);

create index products_public_order_idx on public.products(is_published, display_order, created_at desc);
create index products_search_vector_idx on public.products using gin(search_vector);
create index products_type_category_idx on public.products(product_type, category_id) where is_published;
create index products_brand_idx on public.products(brand_id) where is_published;
create index variants_product_active_idx on public.product_variants(product_id, is_active, price);
create index variants_low_stock_idx on public.product_variants(stock_quantity, low_stock_threshold) where is_active;
create index product_images_order_idx on public.product_images(product_id, display_order);
create index orders_status_created_idx on public.orders(status, created_at desc);
create index order_items_order_idx on public.order_items(order_id);
create index inventory_logs_variant_created_idx on public.inventory_logs(variant_id, created_at desc);
create index reviews_approved_created_idx on public.reviews(status, created_at desc) where status = 'approved';
create index sections_public_order_idx on public.site_sections(is_active, display_order);
create index admin_logs_created_idx on public.admin_logs(created_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger brands_set_updated_at before update on public.brands for each row execute function public.set_updated_at();
create trigger categories_set_updated_at before update on public.categories for each row execute function public.set_updated_at();
create trigger products_set_updated_at before update on public.products for each row execute function public.set_updated_at();
create trigger variants_set_updated_at before update on public.product_variants for each row execute function public.set_updated_at();
create trigger orders_set_updated_at before update on public.orders for each row execute function public.set_updated_at();
create trigger reviews_set_updated_at before update on public.reviews for each row execute function public.set_updated_at();
create trigger banners_set_updated_at before update on public.banners for each row execute function public.set_updated_at();
create trigger sections_set_updated_at before update on public.site_sections for each row execute function public.set_updated_at();
create trigger settings_set_updated_at before update on public.site_settings for each row execute function public.set_updated_at();

create or replace function public.is_active_admin()
returns boolean
language sql stable security definer
set search_path = public, auth, pg_temp
as $$
  select exists (
    select 1 from public.admin_users u
    where u.user_id = auth.uid() and u.is_active
  );
$$;

-- Public product search returns page IDs and total count, without exposing unpublished records.
create or replace function public.search_storefront_products(
  p_search text default null,
  p_product_type public.product_type default null,
  p_category_slug text default null,
  p_brand_id uuid default null,
  p_scent_family text default null,
  p_sort text default 'newest',
  p_page integer default 1,
  p_page_size integer default 24
)
returns table(product_ids uuid[], total_count bigint)
language plpgsql stable security invoker
set search_path = public, pg_temp
as $$
declare
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_page_size integer := least(greatest(coalesce(p_page_size, 24), 1), 48);
  v_search text := nullif(trim(coalesce(p_search, '')), '');
  v_pattern text;
begin
  if p_sort not in ('newest', 'price_asc', 'price_desc') then
    raise exception 'INVALID_SORT' using errcode = '22023';
  end if;
  if v_search is not null and length(v_search) > 100 then
    raise exception 'SEARCH_TOO_LONG' using errcode = '22023';
  end if;
  v_pattern := '%' || replace(replace(replace(coalesce(v_search, ''), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  return query
  with filtered as (
    select p.id, p.created_at,
      (select min(v.price) from public.product_variants v where v.product_id = p.id and v.is_active) as min_price
    from public.products p
    left join public.brands b on b.id = p.brand_id
    left join public.categories c on c.id = p.category_id
    where p.is_published
      and (p_product_type is null or p.product_type = p_product_type)
      and (p_category_slug is null or c.slug = p_category_slug and c.is_active)
      and (p_brand_id is null or p.brand_id = p_brand_id)
      and (p_scent_family is null or p.scent_family = p_scent_family)
      and exists (select 1 from public.product_variants v where v.product_id = p.id and v.is_active)
      and (v_search is null or p.search_vector @@ plainto_tsquery('simple', v_search)
        or p.name ilike v_pattern escape '\' or coalesce(b.name, '') ilike v_pattern escape '\')
  ), page_rows as (
    select f.id, f.created_at, f.min_price
    from filtered f
    order by
      case when p_sort = 'newest' then f.created_at end desc nulls last,
      case when p_sort = 'price_asc' then f.min_price end asc nulls last,
      case when p_sort = 'price_desc' then f.min_price end desc nulls last,
      f.created_at desc, f.id
    limit v_page_size offset (v_page - 1) * v_page_size
  )
  select coalesce(array_agg(pr.id order by
      case when p_sort = 'newest' then pr.created_at end desc nulls last,
      case when p_sort = 'price_asc' then pr.min_price end asc nulls last,
      case when p_sort = 'price_desc' then pr.min_price end desc nulls last,
      pr.created_at desc, pr.id), '{}'::uuid[]),
    (select count(*) from filtered)
  from page_rows pr;
end;
$$;

create or replace function public.consume_api_rate_limit(
  p_rate_key text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql volatile security invoker
set search_path = public, pg_temp
as $$
declare
  v_started timestamptz;
  v_count integer;
begin
  if length(coalesce(p_rate_key, '')) < 16 or p_limit < 1 or p_window_seconds < 1 then
    raise exception 'INVALID_RATE_LIMIT_ARGUMENTS' using errcode = '22023';
  end if;
  insert into public.api_rate_limits(rate_key, window_started_at, request_count)
    values (p_rate_key, now(), 1)
  on conflict (rate_key) do update set
    window_started_at = case when public.api_rate_limits.window_started_at <= now() - make_interval(secs => p_window_seconds) then now() else public.api_rate_limits.window_started_at end,
    request_count = case when public.api_rate_limits.window_started_at <= now() - make_interval(secs => p_window_seconds) then 1 else public.api_rate_limits.request_count + 1 end,
    updated_at = now()
  returning window_started_at, request_count into v_started, v_count;
  return v_count <= p_limit;
end;
$$;

-- Guest checkout persists server-priced snapshots. Inventory is checked here and again atomically at confirmation.
create or replace function public.create_guest_order(
  p_items jsonb,
  p_idempotency_key text,
  p_customer_name text default null,
  p_customer_phone text default null,
  p_notes text default null
)
returns jsonb
language plpgsql volatile security invoker
set search_path = public, extensions, pg_temp
as $$
declare
  v_request_hash text;
  v_order_id uuid;
  v_order_number text;
  v_existing_hash text;
  v_existing_status public.order_status;
  v_subtotal numeric(12,2);
  v_lines jsonb;
  v_item record;
  v_variant record;
  v_quantity integer;
  v_line_total numeric(14,2);
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 50 then
    raise exception 'INVALID_ITEMS' using errcode = '22023';
  end if;
  if length(trim(coalesce(p_idempotency_key, ''))) < 8 or length(p_idempotency_key) > 128 then
    raise exception 'INVALID_IDEMPOTENCY_KEY' using errcode = '22023';
  end if;
  if p_customer_name is not null and length(p_customer_name) > 120
    or p_customer_phone is not null and length(p_customer_phone) > 40
    or p_notes is not null and length(p_notes) > 2000 then
    raise exception 'FIELD_TOO_LONG' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_items) x
    where jsonb_typeof(x) <> 'object'
      or coalesce(x->>'variantId', '') !~* '^[0-9a-f-]{36}$'
      or coalesce(x->>'quantity', '') !~ '^[1-9][0-9]{0,3}$'
  ) then
    raise exception 'INVALID_ITEMS' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_items) x
    group by x->>'variantId' having count(*) > 1
  ) then
    raise exception 'DUPLICATE_VARIANT' using errcode = '22023';
  end if;
  v_request_hash := encode(extensions.digest(
    jsonb_build_object('items', p_items, 'customerName', p_customer_name, 'customerPhone', p_customer_phone, 'notes', p_notes)::text,
    'sha256'), 'hex');

  -- Serialize same-key retries so only one order is created for an idempotency key.
  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key, 731));
    select o.id, o.order_number, o.request_hash, o.status into v_order_id, v_order_number, v_existing_hash, v_existing_status
      from public.orders o where o.idempotency_key = p_idempotency_key;
    if v_order_id is not null then
      if v_existing_hash <> v_request_hash then
        raise exception 'IDEMPOTENCY_CONFLICT' using errcode = '23505';
      end if;
      if v_existing_status <> 'whatsapp_initiated' then
        raise exception 'ORDER_ALREADY_PROCESSED' using errcode = '23505';
      end if;
      select o.subtotal, coalesce(jsonb_agg(jsonb_build_object(
        'productName', oi.product_name_snapshot,
        'productType', oi.product_type_snapshot,
        'variantName', oi.variant_name_snapshot,
      'quantity', oi.quantity,
      'unitPrice', oi.unit_price_snapshot::text,
      'lineTotal', oi.line_total::text
    ) order by oi.created_at, oi.id), '[]'::jsonb) into v_subtotal, v_lines
    from public.orders o join public.order_items oi on oi.order_id = o.id
    where o.id = v_order_id group by o.subtotal;
    return jsonb_build_object('orderId', v_order_id, 'orderNumber', v_order_number,
      'status', v_existing_status, 'subtotal', to_char(v_subtotal, 'FM9999999990.00'),
      'currency', 'ILS', 'deliveryCost', null, 'items', v_lines);
  end if;

  create temporary table if not exists pg_temp.checkout_lines (
    variant_id uuid primary key, quantity integer not null, product_id uuid not null,
    product_name text not null, product_type public.product_type not null, size_label text not null, unit_price numeric(12,2) not null,
    line_total numeric(14,2) not null
  ) on commit drop;
  truncate pg_temp.checkout_lines;

  for v_item in
    select (x->>'variantId')::uuid as variant_id, (x->>'quantity')::integer as quantity
    from jsonb_array_elements(p_items) x order by (x->>'variantId')::uuid
  loop
    select v.id, v.product_id, v.size_label, v.price, v.stock_quantity,
      p.name as product_name, p.product_type, p.is_published
    into v_variant
    from public.product_variants v join public.products p on p.id = v.product_id
    where v.id = v_item.variant_id and v.is_active
    for share of v, p;
    if not found or not v_variant.is_published then
      raise exception 'PRODUCT_UNAVAILABLE' using errcode = 'P0001';
    end if;
    if v_variant.stock_quantity < v_item.quantity then
      raise exception 'OUT_OF_STOCK' using errcode = 'P0001';
    end if;
    v_line_total := round(v_variant.price * v_item.quantity, 2);
    insert into pg_temp.checkout_lines values (
      v_variant.id, v_item.quantity, v_variant.product_id, v_variant.product_name, v_variant.product_type,
      v_variant.size_label, v_variant.price, v_line_total
    );
  end loop;

  select coalesce(sum(line_total), 0)::numeric(12,2) into v_subtotal from pg_temp.checkout_lines;
  v_order_id := gen_random_uuid();
  v_order_number := 'RSH-' || to_char(now() at time zone 'Asia/Gaza', 'YYYYMMDD') || '-' || upper(substr(replace(v_order_id::text, '-', ''), 1, 8));
  insert into public.orders(id, order_number, status, subtotal, currency, customer_name, customer_phone, notes, idempotency_key, request_hash)
    values (v_order_id, v_order_number, 'whatsapp_initiated', v_subtotal, 'ILS', nullif(trim(p_customer_name), ''), nullif(trim(p_customer_phone), ''), nullif(trim(p_notes), ''), p_idempotency_key, v_request_hash);
  insert into public.order_items(order_id, product_id, variant_id, product_name_snapshot, product_type_snapshot, variant_name_snapshot, unit_price_snapshot, quantity, line_total)
    select v_order_id, product_id, variant_id, product_name, product_type, size_label, unit_price, quantity, line_total
    from pg_temp.checkout_lines order by product_name, size_label;
  select coalesce(jsonb_agg(jsonb_build_object(
    'productName', product_name,
    'productType', product_type,
    'variantName', size_label,
    'quantity', quantity,
    'unitPrice', unit_price::text,
    'lineTotal', line_total::text
  ) order by product_name, size_label), '[]'::jsonb) into v_lines from pg_temp.checkout_lines;
  return jsonb_build_object('orderId', v_order_id, 'orderNumber', v_order_number,
    'status', 'whatsapp_initiated', 'subtotal', to_char(v_subtotal, 'FM9999999990.00'),
    'currency', 'ILS', 'deliveryCost', null, 'items', v_lines);
end;
$$;

create or replace function public.admin_change_order_status(
  p_order_id uuid,
  p_status public.order_status,
  p_actor_id uuid
)
returns public.orders
language plpgsql volatile security invoker
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_item record;
  v_variant public.product_variants%rowtype;
  v_old_status public.order_status;
begin
  if not exists (select 1 from public.admin_users a where a.user_id = p_actor_id and a.is_active) then
    raise exception 'ADMIN_REQUIRED' using errcode = '42501';
  end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND' using errcode = 'P0002'; end if;
  v_old_status := v_order.status;
  if v_old_status = p_status then return v_order; end if;
  if not (
    (v_old_status = 'whatsapp_initiated' and p_status in ('contacted', 'confirmed', 'cancelled')) or
    (v_old_status = 'contacted' and p_status in ('confirmed', 'cancelled')) or
    (v_old_status = 'confirmed' and p_status in ('preparing', 'cancelled')) or
    (v_old_status = 'preparing' and p_status in ('out_for_delivery', 'cancelled')) or
    (v_old_status = 'out_for_delivery' and p_status in ('delivered', 'cancelled'))
  ) then
    raise exception 'INVALID_STATUS_TRANSITION' using errcode = '23514';
  end if;
  if p_status = 'confirmed' and v_order.stock_deducted_at is null then
    -- Lock variants in stable order before reading their quantities to avoid concurrent oversell/deadlocks.
    perform 1 from public.product_variants v join public.order_items oi on oi.variant_id = v.id
      where oi.order_id = p_order_id order by v.id for update of v;
    for v_item in
      select oi.variant_id, oi.quantity, oi.product_name_snapshot, oi.variant_name_snapshot
      from public.order_items oi where oi.order_id = p_order_id and oi.variant_id is not null order by oi.variant_id
    loop
      select * into v_variant from public.product_variants where id = v_item.variant_id for update;
      if not found then raise exception 'VARIANT_UNAVAILABLE' using errcode = 'P0001'; end if;
      if v_variant.stock_quantity < v_item.quantity then
        raise exception 'OUT_OF_STOCK' using errcode = 'P0001';
      end if;
      update public.product_variants set stock_quantity = stock_quantity - v_item.quantity where id = v_variant.id;
      insert into public.inventory_logs(variant_id, change_type, quantity_change, previous_quantity, new_quantity, reason, order_id, created_by)
        values (v_variant.id, 'order_confirmed', -v_item.quantity, v_variant.stock_quantity, v_variant.stock_quantity - v_item.quantity,
          'خصم مخزون لتأكيد الطلب ' || v_order.order_number || ' (' || v_item.variant_name_snapshot || ')', p_order_id, p_actor_id);
    end loop;
    update public.orders set stock_deducted_at = now(), confirmed_at = coalesce(confirmed_at, now()) where id = p_order_id returning * into v_order;
  end if;
  if p_status = 'cancelled' and v_order.stock_deducted_at is not null and v_order.stock_restored_at is null then
    perform 1 from public.product_variants v join public.order_items oi on oi.variant_id = v.id
      where oi.order_id = p_order_id order by v.id for update of v;
    for v_item in
      select oi.variant_id, oi.quantity, oi.variant_name_snapshot
      from public.order_items oi where oi.order_id = p_order_id and oi.variant_id is not null order by oi.variant_id
    loop
      select * into v_variant from public.product_variants where id = v_item.variant_id for update;
      if found then
        update public.product_variants set stock_quantity = stock_quantity + v_item.quantity where id = v_variant.id returning * into v_variant;
        insert into public.inventory_logs(variant_id, change_type, quantity_change, previous_quantity, new_quantity, reason, order_id, created_by)
          values (v_variant.id, 'order_cancelled', v_item.quantity, v_variant.stock_quantity - v_item.quantity, v_variant.stock_quantity,
            'إعادة مخزون لإلغاء الطلب ' || v_order.order_number || ' (' || v_item.variant_name_snapshot || ')', p_order_id, p_actor_id);
      end if;
    end loop;
    update public.orders set stock_restored_at = now() where id = p_order_id;
  end if;
  update public.orders set status = p_status, confirmed_at = case when p_status = 'confirmed' then coalesce(confirmed_at, now()) else confirmed_at end
    where id = p_order_id returning * into v_order;
  insert into public.admin_logs(actor_id, action, entity_type, entity_id, old_values, new_values)
    values (p_actor_id, 'order_status_changed', 'order', p_order_id,
      jsonb_build_object('status', v_old_status), jsonb_build_object('status', p_status));
  return v_order;
end;
$$;

create or replace function public.admin_adjust_inventory(
  p_variant_id uuid,
  p_quantity_change integer,
  p_reason text,
  p_actor_id uuid
)
returns jsonb
language plpgsql volatile security invoker
set search_path = public, pg_temp
as $$
declare
  v_variant public.product_variants%rowtype;
  v_log public.inventory_logs%rowtype;
  v_new_quantity integer;
begin
  if not exists (select 1 from public.admin_users a where a.user_id = p_actor_id and a.is_active) then
    raise exception 'ADMIN_REQUIRED' using errcode = '42501';
  end if;
  if p_quantity_change = 0 or length(trim(coalesce(p_reason, ''))) < 3 or length(p_reason) > 500 then
    raise exception 'INVALID_ADJUSTMENT' using errcode = '22023';
  end if;
  select * into v_variant from public.product_variants where id = p_variant_id for update;
  if not found then raise exception 'VARIANT_NOT_FOUND' using errcode = 'P0002'; end if;
  v_new_quantity := v_variant.stock_quantity + p_quantity_change;
  if v_new_quantity < 0 then raise exception 'OUT_OF_STOCK' using errcode = '23514'; end if;
  update public.product_variants set stock_quantity = v_new_quantity where id = p_variant_id returning * into v_variant;
  insert into public.inventory_logs(variant_id, change_type, quantity_change, previous_quantity, new_quantity, reason, created_by)
    values (p_variant_id, 'manual_adjustment', p_quantity_change, v_new_quantity - p_quantity_change, v_new_quantity, trim(p_reason), p_actor_id)
    returning * into v_log;
  insert into public.admin_logs(actor_id, action, entity_type, entity_id, old_values, new_values)
    values (p_actor_id, 'inventory_adjusted', 'product_variant', p_variant_id,
      jsonb_build_object('stockQuantity', v_new_quantity - p_quantity_change), jsonb_build_object('stockQuantity', v_new_quantity, 'reason', trim(p_reason)));
  return jsonb_build_object('variant', to_jsonb(v_variant), 'log', to_jsonb(v_log));
end;
$$;

-- RLS is enabled on every application table. Public SELECT policies expose only published/approved rows.
alter table public.admin_users enable row level security;
alter table public.brands enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.product_images enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.inventory_logs enable row level security;
alter table public.reviews enable row level security;
alter table public.banners enable row level security;
alter table public.site_sections enable row level security;
alter table public.site_section_products enable row level security;
alter table public.site_settings enable row level security;
alter table public.admin_logs enable row level security;
alter table public.api_rate_limits enable row level security;

create policy admin_users_read_self on public.admin_users for select to authenticated using (user_id = auth.uid());
create policy brands_public_read on public.brands for select to anon, authenticated using (is_active and exists (select 1 from public.products p where p.brand_id = brands.id and p.is_published));
create policy brands_admin_all on public.brands for all to authenticated using (public.is_active_admin()) with check (public.is_active_admin());
create policy categories_public_read on public.categories for select to anon, authenticated using (is_active);
create policy categories_admin_all on public.categories for all to authenticated using (public.is_active_admin()) with check (public.is_active_admin());
create policy products_public_read on public.products for select to anon, authenticated using (is_published);
create policy products_admin_all on public.products for all to authenticated using (public.is_active_admin()) with check (public.is_active_admin());
create policy variants_public_read on public.product_variants for select to anon, authenticated using (is_active and exists (select 1 from public.products p where p.id = product_id and p.is_published));
create policy variants_admin_all on public.product_variants for all to authenticated using (public.is_active_admin()) with check (public.is_active_admin());
create policy product_images_public_read on public.product_images for select to anon, authenticated using (exists (select 1 from public.products p where p.id = product_id and p.is_published));
create policy product_images_admin_all on public.product_images for all to authenticated using (public.is_active_admin()) with check (public.is_active_admin());
create policy orders_admin_all on public.orders for all to authenticated using (public.is_active_admin()) with check (public.is_active_admin());
create policy order_items_admin_all on public.order_items for all to authenticated using (public.is_active_admin()) with check (public.is_active_admin());
create policy inventory_logs_admin_read on public.inventory_logs for select to authenticated using (public.is_active_admin());
create policy reviews_public_approved_read on public.reviews for select to anon, authenticated using (status = 'approved' and exists (select 1 from public.products p where p.id = product_id and p.is_published));
create policy reviews_admin_all on public.reviews for all to authenticated using (public.is_active_admin()) with check (public.is_active_admin());
create policy banners_public_read on public.banners for select to anon, authenticated using (is_active);
create policy banners_admin_all on public.banners for all to authenticated using (public.is_active_admin()) with check (public.is_active_admin());
create policy sections_public_read on public.site_sections for select to anon, authenticated using (is_active);
create policy sections_admin_all on public.site_sections for all to authenticated using (public.is_active_admin()) with check (public.is_active_admin());
create policy section_products_public_read on public.site_section_products for select to anon, authenticated using (
  exists (select 1 from public.site_sections s where s.id = section_id and s.is_active)
  and exists (select 1 from public.products p where p.id = product_id and p.is_published)
);
create policy section_products_admin_all on public.site_section_products for all to authenticated using (public.is_active_admin()) with check (public.is_active_admin());
create policy settings_public_read on public.site_settings for select to anon, authenticated using (is_public);
create policy settings_admin_all on public.site_settings for all to authenticated using (public.is_active_admin()) with check (public.is_active_admin());
create policy admin_logs_admin_read on public.admin_logs for select to authenticated using (public.is_active_admin());

-- No direct writes for anon/authenticated to orders, inventory, or rate limits. Writes use server-only RPCs.
revoke all on public.orders, public.order_items, public.inventory_logs, public.admin_logs, public.api_rate_limits from anon, authenticated;
revoke insert, update, delete on public.products, public.product_variants, public.product_images, public.categories, public.brands, public.reviews, public.banners, public.site_sections, public.site_section_products, public.site_settings from anon;

grant select on public.brands, public.categories, public.products, public.product_variants, public.product_images,
  public.reviews, public.banners, public.site_sections, public.site_section_products, public.site_settings to anon, authenticated;
grant select on public.admin_users to authenticated;
grant select on public.orders, public.order_items, public.inventory_logs, public.admin_logs to authenticated;
grant insert, update, delete on public.brands, public.categories, public.products, public.product_variants, public.product_images,
  public.reviews, public.banners, public.site_sections, public.site_section_products, public.site_settings to authenticated;

revoke all on function public.is_active_admin() from public, anon;
grant execute on function public.is_active_admin() to authenticated, service_role;
revoke all on function public.search_storefront_products(text, public.product_type, text, uuid, text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.search_storefront_products(text, public.product_type, text, uuid, text, text, integer, integer) to service_role;
revoke all on function public.consume_api_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_api_rate_limit(text, integer, integer) to service_role;
revoke all on function public.create_guest_order(jsonb, text, text, text, text) from public, anon, authenticated;
grant execute on function public.create_guest_order(jsonb, text, text, text, text) to service_role;
revoke all on function public.admin_change_order_status(uuid, public.order_status, uuid) from public, anon, authenticated;
grant execute on function public.admin_change_order_status(uuid, public.order_status, uuid) to service_role;
revoke all on function public.admin_adjust_inventory(uuid, integer, text, uuid) from public, anon, authenticated;
grant execute on function public.admin_adjust_inventory(uuid, integer, text, uuid) to service_role;

insert into public.site_settings(key, value, is_public)
values ('store_whatsapp_number', '{"number":"972598264288"}'::jsonb, true)
on conflict (key) do nothing;


-- Facets intentionally ignore the currently selected brand/scent filters so alternatives remain visible.
create or replace function public.storefront_product_facets(
  p_search text default null,
  p_product_type public.product_type default null,
  p_category_slug text default null
)
returns jsonb
language sql stable security invoker
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'brands', coalesce((
      select jsonb_agg(jsonb_build_object('id', b.id, 'name', b.name, 'description', b.description, 'logoUrl', b.logo_url) order by b.name)
      from (
        select distinct br.id, br.name, br.description, br.logo_url
        from public.products p
        join public.brands br on br.id = p.brand_id
        left join public.categories c on c.id = p.category_id
        where p.is_published and br.is_active
          and (p_product_type is null or p.product_type = p_product_type)
          and (p_category_slug is null or c.slug = p_category_slug and c.is_active)
          and exists (select 1 from public.product_variants v where v.product_id = p.id and v.is_active)
          and (nullif(trim(coalesce(p_search, '')), '') is null or p.search_vector @@ plainto_tsquery('simple', trim(p_search))
            or p.name ilike '%' || trim(p_search) || '%' or coalesce(br.name, '') ilike '%' || trim(p_search) || '%')
      ) b
    ), '[]'::jsonb),
    'scentFamilies', coalesce((
      select jsonb_agg(sf.name order by sf.name)
      from (
        select distinct nullif(trim(p.scent_family), '') as name
        from public.products p
        left join public.categories c on c.id = p.category_id
        where p.is_published and nullif(trim(p.scent_family), '') is not null
          and (p_product_type is null or p.product_type = p_product_type)
          and (p_category_slug is null or c.slug = p_category_slug and c.is_active)
          and exists (select 1 from public.product_variants v where v.product_id = p.id and v.is_active)
          and (nullif(trim(coalesce(p_search, '')), '') is null or p.search_vector @@ plainto_tsquery('simple', trim(p_search))
            or p.name ilike '%' || trim(p_search) || '%')
      ) sf
    ), '[]'::jsonb)
  );
$$;
revoke all on function public.storefront_product_facets(text, public.product_type, text) from public, anon, authenticated;
grant execute on function public.storefront_product_facets(text, public.product_type, text) to service_role;


create or replace function public.admin_upsert_product(p_payload jsonb, p_actor_id uuid)
returns uuid
language plpgsql volatile security invoker
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_type public.product_type;
  v_brand_id uuid;
  v_category_id uuid;
  v_variant jsonb;
  v_image jsonb;
  v_variant_id uuid;
  v_variant_ids uuid[] := '{}'::uuid[];
  v_old public.product_variants%rowtype;
  v_new_stock integer;
  v_action text;
  v_old_product public.products%rowtype;
  v_new_product public.products%rowtype;
  v_old_variants jsonb := '[]'::jsonb;
  v_new_variants jsonb := '[]'::jsonb;
  v_old_images jsonb := '[]'::jsonb;
  v_new_images jsonb := '[]'::jsonb;
begin
  if not exists (select 1 from public.admin_users a where a.user_id = p_actor_id and a.is_active) then
    raise exception 'ADMIN_REQUIRED' using errcode = '42501';
  end if;
  if jsonb_typeof(p_payload) <> 'object'
    or length(trim(coalesce(p_payload->>'name',''))) not between 1 and 180
    or length(trim(coalesce(p_payload->>'slug',''))) not between 1 and 180
    or coalesce(p_payload->>'slug','') !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    or p_payload->>'productType' not in ('original','blended')
    or jsonb_typeof(coalesce(p_payload->'variants','null'::jsonb)) <> 'array'
    or jsonb_typeof(coalesce(p_payload->'images','null'::jsonb)) <> 'array'
    or jsonb_array_length(p_payload->'variants') < 1
    or jsonb_array_length(p_payload->'variants') > 100
    or jsonb_array_length(p_payload->'images') > 20 then
    raise exception 'INVALID_PRODUCT' using errcode = '22023';
  end if;
  v_type := (p_payload->>'productType')::public.product_type;
  v_brand_id := nullif(p_payload->>'brandId','')::uuid;
  v_category_id := nullif(p_payload->>'categoryId','')::uuid;
  if v_brand_id is not null and not exists (select 1 from public.brands where id = v_brand_id) then raise exception 'INVALID_BRAND' using errcode = '23503'; end if;
  if v_category_id is not null and not exists (select 1 from public.categories where id = v_category_id) then raise exception 'INVALID_CATEGORY' using errcode = '23503'; end if;

  if nullif(p_payload->>'id','') is not null then
    v_id := (p_payload->>'id')::uuid;
    select * into v_old_product from public.products where id = v_id for update;
    if not found then raise exception 'PRODUCT_NOT_FOUND' using errcode = 'P0002'; end if;
    perform 1 from public.product_variants where product_id=v_id order by id for update;
    select coalesce(jsonb_agg(jsonb_build_object('id',id,'sizeLabel',size_label,'price',price,'compareAtPrice',compare_at_price,'stockQuantity',stock_quantity,'lowStockThreshold',low_stock_threshold,'isActive',is_active) order by id),'[]'::jsonb)
      into v_old_variants from public.product_variants where product_id=v_id;
    select coalesce(jsonb_agg(jsonb_build_object('id',id,'imageUrl',image_url,'altText',alt_text,'displayOrder',display_order,'isPrimary',is_primary) order by display_order,id),'[]'::jsonb)
      into v_old_images from public.product_images where product_id=v_id;
    v_action := 'product_updated';
    update public.products set
      name = trim(p_payload->>'name'), slug = trim(p_payload->>'slug'),
      description = nullif(trim(p_payload->>'description'),''), product_type = v_type,
      brand_id = v_brand_id, category_id = v_category_id,
      scent_family = nullif(trim(p_payload->>'scentFamily'),''),
      notes = coalesce(array(select jsonb_array_elements_text(coalesce(p_payload->'notes','[]'::jsonb))), '{}'),
      origin_country = nullif(trim(p_payload->>'originCountry'),''),
      is_published = coalesce((p_payload->>'isPublished')::boolean,false),
      is_featured = coalesce((p_payload->>'isFeatured')::boolean,false),
      is_best_seller = coalesce((p_payload->>'isBestSeller')::boolean,false),
      display_order = coalesce((p_payload->>'displayOrder')::integer,0)
      where id = v_id;
  else
    v_id := gen_random_uuid();
    v_action := 'product_created';
    insert into public.products(id,name,slug,description,product_type,brand_id,category_id,scent_family,notes,origin_country,is_published,is_featured,is_best_seller,display_order)
    values (v_id,trim(p_payload->>'name'),trim(p_payload->>'slug'),nullif(trim(p_payload->>'description'),''),v_type,v_brand_id,v_category_id,
      nullif(trim(p_payload->>'scentFamily'),''),coalesce(array(select jsonb_array_elements_text(coalesce(p_payload->'notes','[]'::jsonb))), '{}'),
      nullif(trim(p_payload->>'originCountry'),''),coalesce((p_payload->>'isPublished')::boolean,false),coalesce((p_payload->>'isFeatured')::boolean,false),
      coalesce((p_payload->>'isBestSeller')::boolean,false),coalesce((p_payload->>'displayOrder')::integer,0));
  end if;

  for v_variant in select value from jsonb_array_elements(p_payload->'variants') loop
    if length(trim(coalesce(v_variant->>'sizeLabel',''))) not between 1 and 80
      or coalesce(v_variant->>'price','') !~ '^\d+(\.\d{1,2})?$'
      or coalesce(v_variant->>'stockQuantity','') !~ '^\d{1,9}$'
      or coalesce(v_variant->>'lowStockThreshold','0') !~ '^\d{1,9}$' then
      raise exception 'INVALID_VARIANT' using errcode = '22023';
    end if;
    v_new_stock := (v_variant->>'stockQuantity')::integer;
    if nullif(v_variant->>'id','') is not null then
      v_variant_id := (v_variant->>'id')::uuid;
      select * into v_old from public.product_variants where id = v_variant_id and product_id = v_id for update;
      if not found then raise exception 'VARIANT_NOT_FOUND' using errcode = 'P0002'; end if;
      update public.product_variants set size_label=trim(v_variant->>'sizeLabel'),price=(v_variant->>'price')::numeric,
        compare_at_price=nullif(v_variant->>'compareAtPrice','')::numeric,stock_quantity=v_new_stock,
        low_stock_threshold=coalesce((v_variant->>'lowStockThreshold')::integer,5),is_active=coalesce((v_variant->>'isActive')::boolean,true)
        where id=v_variant_id;
      v_variant_ids := array_append(v_variant_ids, v_variant_id);
      if v_old.stock_quantity <> v_new_stock then
        insert into public.inventory_logs(variant_id,change_type,quantity_change,previous_quantity,new_quantity,reason,created_by)
          values (v_variant_id,'manual_adjustment',v_new_stock-v_old.stock_quantity,v_old.stock_quantity,v_new_stock,
            'تعديل مخزون من نموذج المنتج',p_actor_id);
      end if;
    else
      insert into public.product_variants(product_id,size_label,price,compare_at_price,stock_quantity,low_stock_threshold,is_active)
        values (v_id,trim(v_variant->>'sizeLabel'),(v_variant->>'price')::numeric,nullif(v_variant->>'compareAtPrice','')::numeric,v_new_stock,
          coalesce((v_variant->>'lowStockThreshold')::integer,5),coalesce((v_variant->>'isActive')::boolean,true)) returning id into v_variant_id;
      v_variant_ids := array_append(v_variant_ids, v_variant_id);
      if v_new_stock > 0 then
        insert into public.inventory_logs(variant_id,change_type,quantity_change,previous_quantity,new_quantity,reason,created_by)
          values (v_variant_id,'manual_adjustment',v_new_stock,0,v_new_stock,'رصيد افتتاحي للمتغير',p_actor_id);
      end if;
    end if;
  end loop;
  update public.product_variants set is_active=false where product_id=v_id and not (id = any(v_variant_ids));

  delete from public.product_images where product_id=v_id;
  for v_image in select value from jsonb_array_elements(p_payload->'images') loop
    if length(trim(coalesce(v_image->>'imageUrl',''))) < 8 or length(v_image->>'imageUrl') > 2048 then
      raise exception 'INVALID_IMAGE_URL' using errcode = '22023';
    end if;
    insert into public.product_images(product_id,image_url,alt_text,display_order,is_primary)
      values (v_id,trim(v_image->>'imageUrl'),nullif(trim(v_image->>'altText'),''),coalesce((v_image->>'displayOrder')::integer,0),coalesce((v_image->>'isPrimary')::boolean,false));
  end loop;
  select * into v_new_product from public.products where id=v_id;
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'sizeLabel',size_label,'price',price,'compareAtPrice',compare_at_price,'stockQuantity',stock_quantity,'lowStockThreshold',low_stock_threshold,'isActive',is_active) order by id),'[]'::jsonb)
    into v_new_variants from public.product_variants where product_id=v_id;
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'imageUrl',image_url,'altText',alt_text,'displayOrder',display_order,'isPrimary',is_primary) order by display_order,id),'[]'::jsonb)
    into v_new_images from public.product_images where product_id=v_id;
  insert into public.admin_logs(actor_id,action,entity_type,entity_id,old_values,new_values)
    values (p_actor_id,v_action,'product',v_id,
      case when v_action='product_created' then null else jsonb_build_object('name',v_old_product.name,'slug',v_old_product.slug,'description',v_old_product.description,'productType',v_old_product.product_type,'brandId',v_old_product.brand_id,'categoryId',v_old_product.category_id,'scentFamily',v_old_product.scent_family,'notes',v_old_product.notes,'originCountry',v_old_product.origin_country,'isPublished',v_old_product.is_published,'isFeatured',v_old_product.is_featured,'isBestSeller',v_old_product.is_best_seller,'variants',v_old_variants,'images',v_old_images) end,
      jsonb_build_object('name',v_new_product.name,'slug',v_new_product.slug,'description',v_new_product.description,'productType',v_new_product.product_type,'brandId',v_new_product.brand_id,'categoryId',v_new_product.category_id,'scentFamily',v_new_product.scent_family,'notes',v_new_product.notes,'originCountry',v_new_product.origin_country,'isPublished',v_new_product.is_published,'isFeatured',v_new_product.is_featured,'isBestSeller',v_new_product.is_best_seller,'variants',v_new_variants,'images',v_new_images));
  return v_id;
end;
$$;

create or replace function public.admin_set_review_status(p_review_id uuid, p_status public.review_status, p_actor_id uuid)
returns public.reviews
language plpgsql volatile security invoker
set search_path = public, pg_temp
as $$
declare v_review public.reviews%rowtype; v_old_status public.review_status;
begin
  if not exists (select 1 from public.admin_users a where a.user_id=p_actor_id and a.is_active) then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  if p_status not in ('approved','rejected') then raise exception 'INVALID_REVIEW_STATUS' using errcode='22023'; end if;
  select * into v_review from public.reviews where id=p_review_id for update;
  if not found then raise exception 'REVIEW_NOT_FOUND' using errcode='P0002'; end if;
  v_old_status := v_review.status;
  update public.reviews set status=p_status where id=p_review_id returning * into v_review;
  insert into public.admin_logs(actor_id,action,entity_type,entity_id,old_values,new_values)
    values (p_actor_id,case when p_status='approved' then 'review_approved' else 'review_rejected' end,'review',p_review_id,
      jsonb_build_object('status',v_old_status),jsonb_build_object('status',p_status));
  return v_review;
end;
$$;

create or replace function public.admin_update_content(p_payload jsonb, p_actor_id uuid)
returns void
language plpgsql volatile security invoker
set search_path = public, pg_temp
as $$
declare
  v_row jsonb;
  v_section_id uuid;
  v_banner_id uuid;
  v_product_id uuid;
  v_position integer;
begin
  if not exists (select 1 from public.admin_users a where a.user_id=p_actor_id and a.is_active) then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  if jsonb_typeof(p_payload)<>'object' then raise exception 'INVALID_CONTENT' using errcode='22023'; end if;
  if p_payload ? 'hero' then
    if p_payload->'hero' is null or p_payload->'hero'='null'::jsonb then
      delete from public.site_settings where key='home_hero';
    else
      insert into public.site_settings(key,value,is_public,updated_by) values ('home_hero',p_payload->'hero',true,p_actor_id)
      on conflict (key) do update set value=excluded.value,is_public=true,updated_by=excluded.updated_by;
    end if;
  end if;
  if p_payload ? 'promoBar' then
    if p_payload->'promoBar' is null or p_payload->'promoBar'='null'::jsonb then
      delete from public.site_settings where key='promo_bar';
    else
      insert into public.site_settings(key,value,is_public,updated_by)
        values ('promo_bar',p_payload->'promoBar',coalesce((p_payload->'promoBar'->>'isActive')::boolean,true),p_actor_id)
      on conflict (key) do update set value=excluded.value,is_public=excluded.is_public,updated_by=excluded.updated_by;
    end if;
  end if;
  if jsonb_typeof(p_payload->'banners')='array' then
    update public.banners set is_active=false;
    for v_row in select value from jsonb_array_elements(p_payload->'banners') loop
      if nullif(v_row->>'id','') is null then v_banner_id:=gen_random_uuid(); else v_banner_id:=(v_row->>'id')::uuid; end if;
      insert into public.banners(id,title,description,image_url,link_url,is_active,display_order)
      values (v_banner_id,trim(v_row->>'title'),nullif(trim(v_row->>'description'),''),trim(v_row->>'imageUrl'),nullif(trim(v_row->>'linkUrl'),''),coalesce((v_row->>'isActive')::boolean,false),coalesce((v_row->>'displayOrder')::integer,0))
      on conflict(id) do update set title=excluded.title,description=excluded.description,image_url=excluded.image_url,link_url=excluded.link_url,is_active=excluded.is_active,display_order=excluded.display_order;
    end loop;
  end if;
  if jsonb_typeof(p_payload->'sections')='array' then
    update public.site_sections set is_active=false;
    for v_row in select value from jsonb_array_elements(p_payload->'sections') loop
      if nullif(v_row->>'id','') is null then v_section_id:=gen_random_uuid(); else v_section_id:=(v_row->>'id')::uuid; end if;
      insert into public.site_sections(id,section_key,title,description,is_active,display_order,settings)
      values (v_section_id,trim(v_row->>'sectionKey'),trim(v_row->>'title'),nullif(trim(v_row->>'description'),''),coalesce((v_row->>'isActive')::boolean,false),coalesce((v_row->>'displayOrder')::integer,0),coalesce(v_row->'settings','{}'::jsonb))
      on conflict(id) do update set section_key=excluded.section_key,title=excluded.title,description=excluded.description,is_active=excluded.is_active,display_order=excluded.display_order,settings=excluded.settings;
      delete from public.site_section_products where section_id=v_section_id;
      v_position:=0;
      for v_product_id in select value::text::uuid from jsonb_array_elements_text(coalesce(v_row->'productIds','[]'::jsonb)) loop
        insert into public.site_section_products(section_id,product_id,display_order) values (v_section_id,v_product_id,v_position);
        v_position:=v_position+1;
      end loop;
    end loop;
  end if;
  insert into public.admin_logs(actor_id,action,entity_type,new_values) values (p_actor_id,'site_content_updated','site_content',p_payload);
end;
$$;

create or replace function public.admin_update_store_settings(p_payload jsonb, p_actor_id uuid)
returns void
language plpgsql volatile security invoker
set search_path = public, pg_temp
as $$
declare v_contact jsonb;
begin
  if not exists (select 1 from public.admin_users a where a.user_id=p_actor_id and a.is_active) then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  if jsonb_typeof(p_payload)<>'object' then raise exception 'INVALID_SETTINGS' using errcode='22023'; end if;
  v_contact := p_payload->'contactInfo';
  if length(trim(coalesce(p_payload->>'storeName',''))) not between 1 and 180 then raise exception 'INVALID_STORE_NAME' using errcode='22023'; end if;
  if p_payload ? 'whatsappNumber' and coalesce(p_payload->>'whatsappNumber','') !~ '^\d{8,15}$' then raise exception 'INVALID_WHATSAPP_NUMBER' using errcode='22023'; end if;
  if p_payload ? 'lowStockThreshold' and coalesce(p_payload->>'lowStockThreshold','') !~ '^\d{1,6}$' then raise exception 'INVALID_LOW_STOCK_THRESHOLD' using errcode='22023'; end if;
  if length(coalesce(p_payload->>'orderMessageTemplate',''))>5000
    or position('{storeName}' in coalesce(p_payload->>'orderMessageTemplate',''))=0
    or position('{orderNumber}' in coalesce(p_payload->>'orderMessageTemplate',''))=0
    or position('{items}' in coalesce(p_payload->>'orderMessageTemplate',''))=0
    or position('{subtotal}' in coalesce(p_payload->>'orderMessageTemplate',''))=0
    or position('{deliveryNote}' in coalesce(p_payload->>'orderMessageTemplate',''))=0 then raise exception 'INVALID_ORDER_MESSAGE_TEMPLATE' using errcode='22023'; end if;
  if jsonb_typeof(v_contact)<>'object'
    or jsonb_typeof(coalesce(v_contact->'phone','null'::jsonb)) not in ('string','null')
    or jsonb_typeof(coalesce(v_contact->'email','null'::jsonb)) not in ('string','null')
    or jsonb_typeof(coalesce(v_contact->'address','null'::jsonb)) not in ('string','null')
    or length(coalesce(v_contact->>'phone',''))>40 or length(coalesce(v_contact->>'email',''))>254
    or length(coalesce(v_contact->>'address',''))>500 then raise exception 'INVALID_CONTACT_INFO' using errcode='22023'; end if;
  insert into public.site_settings(key,value,is_public,updated_by)
    values ('store_config',p_payload,false,p_actor_id)
    on conflict (key) do update set value=excluded.value,is_public=false,updated_by=excluded.updated_by;
  insert into public.site_settings(key,value,is_public,updated_by)
    values ('store_public_config',jsonb_build_object('storeName',p_payload->>'storeName','policies',coalesce(p_payload->'policies','{}'::jsonb),'contactInfo',coalesce(p_payload->'contactInfo','{}'::jsonb)),true,p_actor_id)
    on conflict (key) do update set value=excluded.value,is_public=true,updated_by=excluded.updated_by;
  if p_payload ? 'whatsappNumber' then
    insert into public.site_settings(key,value,is_public,updated_by)
      values ('store_whatsapp_number',jsonb_build_object('number',p_payload->>'whatsappNumber'),true,p_actor_id)
      on conflict (key) do update set value=excluded.value,is_public=true,updated_by=excluded.updated_by;
  end if;
  insert into public.admin_logs(actor_id,action,entity_type,new_values) values (p_actor_id,'store_settings_updated','site_settings',p_payload);
end;
$$;

create or replace function public.admin_delete_product(p_product_id uuid, p_actor_id uuid)
returns public.products
language plpgsql volatile security invoker
set search_path = public, pg_temp
as $$
declare v_product public.products%rowtype;
begin
  if not exists (select 1 from public.admin_users a where a.user_id=p_actor_id and a.is_active) then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  update public.products set is_published=false where id=p_product_id returning * into v_product;
  if not found then raise exception 'PRODUCT_NOT_FOUND' using errcode='P0002'; end if;
  insert into public.admin_logs(actor_id,action,entity_type,entity_id,old_values,new_values)
    values (p_actor_id,'product_unpublished','product',p_product_id,jsonb_build_object('isPublished',true),jsonb_build_object('isPublished',false));
  return v_product;
end;
$$;

revoke all on function public.admin_upsert_product(jsonb,uuid) from public,anon,authenticated;
grant execute on function public.admin_upsert_product(jsonb,uuid) to service_role;
revoke all on function public.admin_set_review_status(uuid,public.review_status,uuid) from public,anon,authenticated;
grant execute on function public.admin_set_review_status(uuid,public.review_status,uuid) to service_role;
revoke all on function public.admin_update_content(jsonb,uuid) from public,anon,authenticated;
grant execute on function public.admin_update_content(jsonb,uuid) to service_role;
revoke all on function public.admin_update_store_settings(jsonb,uuid) from public,anon,authenticated;
grant execute on function public.admin_update_store_settings(jsonb,uuid) to service_role;
revoke all on function public.admin_delete_product(uuid,uuid) from public,anon,authenticated;
grant execute on function public.admin_delete_product(uuid,uuid) to service_role;


create or replace function public.admin_search_products(p_search text, p_page integer, p_page_size integer, p_actor_id uuid)
returns table(product_ids uuid[], total_count bigint)
language plpgsql stable security invoker
set search_path = public, pg_temp
as $$
declare v_page integer:=greatest(coalesce(p_page,1),1); v_page_size integer:=least(greatest(coalesce(p_page_size,24),1),100); v_pattern text;
begin
  if not exists(select 1 from public.admin_users a where a.user_id=p_actor_id and a.is_active) then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  if length(coalesce(p_search,''))>100 then raise exception 'SEARCH_TOO_LONG' using errcode='22023'; end if;
  v_pattern := '%' || replace(replace(replace(trim(coalesce(p_search,'')),'!','!!'),'%','!%'),'_','!_') || '%';
  return query
  with filtered as (
    select p.id,p.created_at,p.display_order,p.is_published
    from public.products p left join public.brands b on b.id=p.brand_id
    where nullif(trim(coalesce(p_search,'')),'') is null or p.name ilike v_pattern escape '!' or coalesce(b.name,'') ilike v_pattern escape '!'
  ), page_rows as (
    select f.id,f.created_at,f.display_order,f.is_published from filtered f
    order by f.is_published desc,f.display_order,f.created_at desc,f.id
    limit v_page_size offset (v_page-1)*v_page_size
  )
  select coalesce(array_agg(pr.id order by pr.is_published desc,pr.display_order,pr.created_at desc,pr.id),'{}'::uuid[]),
    (select count(*) from filtered) from page_rows pr;
end;
$$;

create or replace function public.admin_dashboard_summary(p_actor_id uuid)
returns jsonb
language plpgsql stable security invoker
set search_path = public, pg_temp
as $$
declare v_result jsonb;
begin
  if not exists(select 1 from public.admin_users a where a.user_id=p_actor_id and a.is_active) then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  select jsonb_build_object(
    'stats',jsonb_build_object(
      'totalProducts',(select count(*) from public.products),
      'publishedProducts',(select count(*) from public.products where is_published),
      'availableProducts',(select count(distinct p.id) from public.products p join public.product_variants v on v.product_id=p.id where p.is_published and v.is_active and v.stock_quantity>0),
      'lowStockVariants',(select count(*) from public.product_variants v join public.products p on p.id=v.product_id where p.is_published and v.is_active and v.stock_quantity<=v.low_stock_threshold),
      'ordersByStatus',jsonb_build_object(
        'whatsapp_initiated',(select count(*) from public.orders where status='whatsapp_initiated'),
        'contacted',(select count(*) from public.orders where status='contacted'),
        'confirmed',(select count(*) from public.orders where status='confirmed'),
        'preparing',(select count(*) from public.orders where status='preparing'),
        'out_for_delivery',(select count(*) from public.orders where status='out_for_delivery'),
        'delivered',(select count(*) from public.orders where status='delivered'),
        'cancelled',(select count(*) from public.orders where status='cancelled')
      ),
      'confirmedSubtotal',to_char(coalesce((select sum(subtotal) from public.orders where stock_deducted_at is not null and status<>'cancelled'),0),'FM9999999990.00'),
      'deliveredSubtotal',to_char(coalesce((select sum(subtotal) from public.orders where status='delivered'),0),'FM9999999990.00')
    ),
    'topProducts',coalesce((
      select jsonb_agg(jsonb_build_object('productId',x.product_id,'productName',x.product_name_snapshot,'confirmedQuantity',x.quantity) order by x.quantity desc,x.product_name_snapshot)
      from (
        select oi.product_id,oi.product_name_snapshot,sum(oi.quantity)::integer as quantity
        from public.order_items oi join public.orders o on o.id=oi.order_id
        where o.stock_deducted_at is not null and o.status<>'cancelled' and oi.product_id is not null
        group by oi.product_id,oi.product_name_snapshot order by sum(oi.quantity) desc limit 10
      ) x
    ),'[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;
revoke all on function public.admin_search_products(text,integer,integer,uuid) from public,anon,authenticated;
grant execute on function public.admin_search_products(text,integer,integer,uuid) to service_role;
revoke all on function public.admin_dashboard_summary(uuid) from public,anon,authenticated;
grant execute on function public.admin_dashboard_summary(uuid) to service_role;


create or replace function public.admin_upsert_brand(p_payload jsonb, p_actor_id uuid)
returns uuid
language plpgsql volatile security invoker
set search_path = public, pg_temp
as $$
declare v_id uuid;
begin
  if not exists(select 1 from public.admin_users a where a.user_id=p_actor_id and a.is_active) then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  if jsonb_typeof(p_payload)<>'object' or length(trim(coalesce(p_payload->>'name',''))) not between 1 and 120 then raise exception 'INVALID_BRAND' using errcode='22023'; end if;
  if nullif(p_payload->>'id','') is null then
    insert into public.brands(name,description,logo_url,is_active)
    values(trim(p_payload->>'name'),nullif(trim(p_payload->>'description'),''),nullif(trim(p_payload->>'logoUrl'),''),coalesce((p_payload->>'isActive')::boolean,true)) returning id into v_id;
  else
    v_id:=(p_payload->>'id')::uuid;
    update public.brands set name=trim(p_payload->>'name'),description=nullif(trim(p_payload->>'description'),''),logo_url=nullif(trim(p_payload->>'logoUrl'),''),is_active=coalesce((p_payload->>'isActive')::boolean,true) where id=v_id;
    if not found then raise exception 'BRAND_NOT_FOUND' using errcode='P0002'; end if;
  end if;
  insert into public.admin_logs(actor_id,action,entity_type,entity_id,new_values)
    values(p_actor_id,'brand_saved','brand',v_id,jsonb_build_object('name',trim(p_payload->>'name'),'isActive',coalesce((p_payload->>'isActive')::boolean,true)));
  return v_id;
end;
$$;

create or replace function public.admin_set_brand_active(p_brand_id uuid,p_is_active boolean,p_actor_id uuid)
returns public.brands
language plpgsql volatile security invoker
set search_path = public, pg_temp
as $$
declare v_brand public.brands%rowtype;
begin
  if not exists(select 1 from public.admin_users a where a.user_id=p_actor_id and a.is_active) then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  update public.brands set is_active=p_is_active where id=p_brand_id returning * into v_brand;
  if not found then raise exception 'BRAND_NOT_FOUND' using errcode='P0002'; end if;
  insert into public.admin_logs(actor_id,action,entity_type,entity_id,new_values) values(p_actor_id,'brand_visibility_changed','brand',p_brand_id,jsonb_build_object('isActive',p_is_active));
  return v_brand;
end;
$$;

create or replace function public.admin_upsert_category(p_payload jsonb,p_actor_id uuid)
returns uuid
language plpgsql volatile security invoker
set search_path = public, pg_temp
as $$
declare v_id uuid;
begin
  if not exists(select 1 from public.admin_users a where a.user_id=p_actor_id and a.is_active) then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  if jsonb_typeof(p_payload)<>'object' or length(trim(coalesce(p_payload->>'name',''))) not between 1 and 120
    or coalesce(p_payload->>'slug','') !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    or coalesce(p_payload->>'displayOrder','0') !~ '^\d{1,9}$' then raise exception 'INVALID_CATEGORY' using errcode='22023'; end if;
  if nullif(p_payload->>'id','') is null then
    insert into public.categories(name,slug,description,image_url,is_active,display_order)
    values(trim(p_payload->>'name'),trim(p_payload->>'slug'),nullif(trim(p_payload->>'description'),''),nullif(trim(p_payload->>'imageUrl'),''),coalesce((p_payload->>'isActive')::boolean,true),coalesce((p_payload->>'displayOrder')::integer,0)) returning id into v_id;
  else
    v_id:=(p_payload->>'id')::uuid;
    update public.categories set name=trim(p_payload->>'name'),slug=trim(p_payload->>'slug'),description=nullif(trim(p_payload->>'description'),''),
      image_url=nullif(trim(p_payload->>'imageUrl'),''),is_active=coalesce((p_payload->>'isActive')::boolean,true),display_order=coalesce((p_payload->>'displayOrder')::integer,0) where id=v_id;
    if not found then raise exception 'CATEGORY_NOT_FOUND' using errcode='P0002'; end if;
  end if;
  insert into public.admin_logs(actor_id,action,entity_type,entity_id,new_values)
    values(p_actor_id,'category_saved','category',v_id,jsonb_build_object('name',trim(p_payload->>'name'),'slug',trim(p_payload->>'slug'),'isActive',coalesce((p_payload->>'isActive')::boolean,true)));
  return v_id;
end;
$$;

create or replace function public.admin_set_category_active(p_category_id uuid,p_is_active boolean,p_actor_id uuid)
returns public.categories
language plpgsql volatile security invoker
set search_path = public, pg_temp
as $$
declare v_category public.categories%rowtype;
begin
  if not exists(select 1 from public.admin_users a where a.user_id=p_actor_id and a.is_active) then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  update public.categories set is_active=p_is_active where id=p_category_id returning * into v_category;
  if not found then raise exception 'CATEGORY_NOT_FOUND' using errcode='P0002'; end if;
  insert into public.admin_logs(actor_id,action,entity_type,entity_id,new_values) values(p_actor_id,'category_visibility_changed','category',p_category_id,jsonb_build_object('isActive',p_is_active));
  return v_category;
end;
$$;

revoke all on function public.admin_upsert_brand(jsonb,uuid) from public,anon,authenticated;
grant execute on function public.admin_upsert_brand(jsonb,uuid) to service_role;
revoke all on function public.admin_set_brand_active(uuid,boolean,uuid) from public,anon,authenticated;
grant execute on function public.admin_set_brand_active(uuid,boolean,uuid) to service_role;
revoke all on function public.admin_upsert_category(jsonb,uuid) from public,anon,authenticated;
grant execute on function public.admin_upsert_category(jsonb,uuid) to service_role;
revoke all on function public.admin_set_category_active(uuid,boolean,uuid) from public,anon,authenticated;
grant execute on function public.admin_set_category_active(uuid,boolean,uuid) to service_role;
grant all on public.admin_users,public.brands,public.categories,public.products,public.product_variants,public.product_images,
  public.orders,public.order_items,public.inventory_logs,public.reviews,public.banners,public.site_sections,public.site_section_products,
  public.site_settings,public.admin_logs,public.api_rate_limits to service_role;


create or replace function public.admin_list_inventory(p_actor_id uuid,p_low_stock boolean,p_page integer,p_page_size integer)
returns table(variant_id uuid,product_id uuid,product_name text,product_type public.product_type,size_label text,price numeric,stock_quantity integer,low_stock_threshold integer,is_active boolean,updated_at timestamptz,total_count bigint)
language plpgsql stable security invoker
set search_path = public, pg_temp
as $$
declare v_page integer:=greatest(coalesce(p_page,1),1); v_page_size integer:=least(greatest(coalesce(p_page_size,25),1),100);
begin
  if not exists(select 1 from public.admin_users a where a.user_id=p_actor_id and a.is_active) then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  return query
  select v.id,v.product_id,p.name,p.product_type,v.size_label,v.price,v.stock_quantity,v.low_stock_threshold,v.is_active,v.updated_at,count(*) over()
  from public.product_variants v join public.products p on p.id=v.product_id
  where not coalesce(p_low_stock,false) or (v.is_active and v.stock_quantity<=v.low_stock_threshold)
  order by v.stock_quantity asc,p.name asc,v.size_label asc
  limit v_page_size offset (v_page-1)*v_page_size;
end;
$$;
revoke all on function public.admin_list_inventory(uuid,boolean,integer,integer) from public,anon,authenticated;
grant execute on function public.admin_list_inventory(uuid,boolean,integer,integer) to service_role;


create or replace function public.create_guest_review(p_product_id uuid,p_customer_name text,p_rating integer,p_comment text default null)
returns jsonb
language plpgsql volatile security invoker
set search_path = public, pg_temp
as $$
declare v_review public.reviews%rowtype;
begin
  if length(trim(coalesce(p_customer_name,''))) not between 1 and 120 or p_rating not between 1 and 5 or (p_comment is not null and length(p_comment)>2000) then
    raise exception 'INVALID_REVIEW' using errcode='22023';
  end if;
  if not exists(select 1 from public.products where id=p_product_id and is_published) then
    raise exception 'PRODUCT_UNAVAILABLE' using errcode='P0001';
  end if;
  insert into public.reviews(product_id,customer_name,rating,comment,status)
    values(p_product_id,trim(p_customer_name),p_rating,nullif(trim(p_comment),''),'pending') returning * into v_review;
  return jsonb_build_object('id',v_review.id,'status',v_review.status,'createdAt',v_review.created_at);
end;
$$;
revoke all on function public.create_guest_review(uuid,text,integer,text) from public,anon,authenticated;
grant execute on function public.create_guest_review(uuid,text,integer,text) to service_role;


create or replace function public.admin_delete_review(p_review_id uuid,p_actor_id uuid)
returns boolean
language plpgsql volatile security invoker
set search_path = public, pg_temp
as $$
declare v_review public.reviews%rowtype;
begin
  if not exists(select 1 from public.admin_users a where a.user_id=p_actor_id and a.is_active) then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  select * into v_review from public.reviews where id=p_review_id for update;
  if not found then raise exception 'REVIEW_NOT_FOUND' using errcode='P0002'; end if;
  delete from public.reviews where id=p_review_id;
  insert into public.admin_logs(actor_id,action,entity_type,entity_id,old_values)
    values(p_actor_id,'review_deleted','review',p_review_id,jsonb_build_object('productId',v_review.product_id,'rating',v_review.rating,'status',v_review.status));
  return true;
end;
$$;
revoke all on function public.admin_delete_review(uuid,uuid) from public,anon,authenticated;
grant execute on function public.admin_delete_review(uuid,uuid) to service_role;


create or replace function public.admin_search_orders(p_search text,p_status public.order_status,p_from timestamptz,p_to timestamptz,p_page integer,p_page_size integer,p_actor_id uuid)
returns table(order_ids uuid[],total_count bigint)
language plpgsql stable security invoker
set search_path = public, pg_temp
as $$
declare v_page integer:=greatest(coalesce(p_page,1),1); v_page_size integer:=least(greatest(coalesce(p_page_size,25),1),100); v_pattern text;
begin
  if not exists(select 1 from public.admin_users a where a.user_id=p_actor_id and a.is_active) then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  if length(coalesce(p_search,''))>100 then raise exception 'SEARCH_TOO_LONG' using errcode='22023'; end if;
  v_pattern := '%' || replace(replace(replace(trim(coalesce(p_search,'')),'!','!!'),'%','!%'),'_','!_') || '%';
  return query
  with filtered as (
    select o.id,o.created_at from public.orders o
    where (p_status is null or o.status=p_status)
      and (p_from is null or o.created_at>=p_from)
      and (p_to is null or o.created_at<=p_to)
      and (nullif(trim(coalesce(p_search,'')),'') is null or o.order_number ilike v_pattern escape '!'
        or coalesce(o.customer_name,'') ilike v_pattern escape '!'
        or coalesce(o.customer_phone,'') ilike v_pattern escape '!')
  ), page_rows as (
    select f.id,f.created_at from filtered f order by f.created_at desc,f.id limit v_page_size offset (v_page-1)*v_page_size
  )
  select coalesce(array_agg(pr.id order by pr.created_at desc,pr.id),'{}'::uuid[]),(select count(*) from filtered) from page_rows pr;
end;
$$;
revoke all on function public.admin_search_orders(text,public.order_status,timestamptz,timestamptz,integer,integer,uuid) from public,anon,authenticated;
grant execute on function public.admin_search_orders(text,public.order_status,timestamptz,timestamptz,integer,integer,uuid) to service_role;
