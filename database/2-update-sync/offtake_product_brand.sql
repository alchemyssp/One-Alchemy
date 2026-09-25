-- Off-take dashboard (applied 2026-09-25): adds 'by_product_brand' to offtake_dashboard()
--   = every product of the selected period with its brand + same period last year,
--   so the "By Product" table on offtake.html can be filtered by brand (top 20 of that brand).
-- Patches the live function in place; safe to run again (does nothing if already added).
do $$
declare d text;
begin
  select pg_get_functiondef(p.oid) into d from pg_proc p where proname = 'offtake_dashboard' and pronamespace = 'public'::regnamespace;
  if position('by_product_brand' in d) > 0 then return; end if;
  d := replace(d, 'FROM cur c GROUP BY c.product ORDER BY 2 DESC LIMIT 20) x)',
    'FROM cur c GROUP BY c.product ORDER BY 2 DESC LIMIT 20) x),
    -- every product of the period with its brand (the page filters the product table by brand)
    ''by_product_brand'', (SELECT json_agg(x ORDER BY vol DESC) FROM (
        SELECT coalesce(a.brand, ''(blank)'') brand, coalesce(a.product, ''(blank)'') name, a.vol, a.val, b.vol vol_py, b.val val_py
        FROM (SELECT brand, product, sum(vol) vol, round(sum(val_inc)) val FROM cur GROUP BY brand, product) a
        LEFT JOIN (SELECT product, sum(vol) vol, round(sum(val_inc)) val FROM prv GROUP BY product) b
          ON coalesce(b.product, '''') = coalesce(a.product, '''')) x)');
  execute d;
end $$;
