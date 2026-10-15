-- Published plans in Workspace 2.0 keep their confirmed roster. Existing
-- publications retain policy 1 until an explicit, reviewed correction.
ALTER TABLE evening_checks ADD COLUMN plan_policy_version integer NOT NULL DEFAULT 1;
