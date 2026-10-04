-- Fresh Sites audience verified 2026-10-04: revision 5, owner + two viewers.
-- IDs are site-scoped verified members, not a grant to every kitchen profile.
ALTER TABLE kitchen_team ADD COLUMN access_enabled INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE kitchen_team ADD COLUMN last_sign_in_at TEXT;
--> statement-breakpoint
CREATE TABLE access_write_guards(id TEXT PRIMARY KEY NOT NULL,user_id TEXT NOT NULL,scope TEXT NOT NULL);
--> statement-breakpoint
CREATE TRIGGER access_write_authorization BEFORE INSERT ON access_write_guards
WHEN NOT EXISTS(
 SELECT 1 FROM kitchen_team t WHERE t.user_id=NEW.user_id AND t.access_enabled=1 AND
 (NEW.scope='operations' AND t.active=1 AND (t.access_role IN ('legacy','cook','manager') OR EXISTS(SELECT 1 FROM kitchen_owner o WHERE o.user_id=t.user_id)) OR
  NEW.scope='workspace' AND (EXISTS(SELECT 1 FROM kitchen_owner o WHERE o.user_id=t.user_id) OR t.access_role='legacy' OR t.access_role='manager' AND t.active=1) OR
  NEW.scope='management' AND (EXISTS(SELECT 1 FROM kitchen_owner o WHERE o.user_id=t.user_id) OR t.access_role='manager' AND t.active=1)))
BEGIN SELECT RAISE(ABORT,'access_revoked'); END;
--> statement-breakpoint
CREATE TABLE team_access_state(id TEXT PRIMARY KEY NOT NULL,initialized_at TEXT NOT NULL,policy_revision INTEGER NOT NULL,policy_hash TEXT NOT NULL);
--> statement-breakpoint
UPDATE kitchen_team SET access_enabled=1 WHERE user_id IN (
 'ud3zlj7nBRLSVeN1NVpw2jXNHKUhpGkQRDiPizNHPszxWqvooNYuQs',
 'GxZpz8wA1nh4cytpjKi6KuXnPTWYGhnQgnSYnNYZsXRJmDRJHm04su',
 'CF4a1rq3nerHGLLbBUqbvBPXI5svcts9XTYIajqcpkGlcNdZyfDTO0');
--> statement-breakpoint
INSERT INTO team_access_state VALUES('kitchen',strftime('%Y-%m-%dT%H:%M:%fZ','now'),5,'60353aa01a3b2bfead78ad0b3e9146749b1d6240a7143ee5372d54ecb1ebaf5a');
