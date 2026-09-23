-- ============================================================
-- Realtime — applied 2026-09-23
-- Broadcast changes so open pages refresh automatically:
--   Data Universe   → Outlet Master page + Data Universe page
--   Contract Master → Outlet Master page (Contract column) + Contracts page
-- RLS still applies: only signed-in users receive events.
-- Pages wait 2.5 s after the last change, then reload once (js/config.js liveReload).
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public."Data Universe";
ALTER PUBLICATION supabase_realtime ADD TABLE public."Contract Master";
