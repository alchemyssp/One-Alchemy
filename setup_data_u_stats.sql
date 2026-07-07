-- Run this in Supabase SQL Editor
-- Creates a server-side function to count unique outlets from ALL rows

CREATE OR REPLACE FUNCTION data_u_stats()
RETURNS json LANGUAGE sql SECURITY DEFINER AS $$
  SELECT json_build_object(
    'total',   COUNT(DISTINCT "Outlet Name"),
    'new',     COUNT(DISTINCT CASE WHEN UPPER(TRIM("New Or Current")) = 'NEW'     THEN "Outlet Name" END),
    'current', COUNT(DISTINCT CASE WHEN UPPER(TRIM("New Or Current")) = 'CURRENT' THEN "Outlet Name" END)
  )
  FROM "Data U"
  WHERE "Outlet Name" IS NOT NULL AND "Outlet Name" <> '';
$$;
