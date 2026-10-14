-- Synthetic loopback-only identity used by build/sites-vite-plugin.ts.
-- Execute only through scripts/setup-local-db.mjs with Wrangler --local.
INSERT INTO kitchen_team
  (id, user_id, email, name, access_role, active, access_enabled, revision, created_at)
VALUES
  ('local-owner', 'local_seedy', 'seedy@sites.test', 'Seedy', 'legacy', 1, 1, 0, 'synthetic')
ON CONFLICT DO NOTHING;

INSERT INTO kitchen_owner (id, user_id)
VALUES ('owner', 'local_seedy')
ON CONFLICT DO NOTHING;
