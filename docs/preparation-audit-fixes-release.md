# Preparation audit fixes — 13 September 2026

Fixes all seven findings from the home/preparation audit. No database migration, profile version change, audience change, or production answer edits are required.

## Draft coordination and recovery

The outer preparation dialog obtains an exclusive browser Web Lock keyed by account before reading drafts or mounting the editor. A waiting tab never writes. On acquisition it loads fresh shared answers; normal close releases the lock and a later opening rereads disk. The local draft/export format remains v1.

A failed disk write retains the latest draft in an account-scoped memory store and retains the lock across dialog closes. The root page offers recovery/download and warns before leaving while any account has a volatile draft. The editor offers retry, download, close while keeping memory, or confirmed discard of unbacked-up changes when no request is pending. Memory cannot survive destruction of the tab: the warning and download are essential. Without Web Locks the browser can export but cannot edit uncoordinated drafts.

Abort handling is synchronous and attachment ownership is token checked, including Strict Mode reattachment of volatile drafts. Asynchronous editor replies are fenced after unmount. Importing a notebook stages the preparation draft per account; it does not write outside the lease. Replacement is explicit inside the editor. Pending receipts retain their original identity and content.

All tabs used for preparation editing should load this release. A pre-release tab does not implement the new coordination protocol; do not roll back to the old editor while this release is in use.

## Field and layout fixes

Changing the basis of an effort estimate clears that answer. Demonstrably mismatched non-null bases in old editable drafts are reopened, while confirmed bases and pending receipts are retained. Existing confirmed profiles are never guessed or rewritten.

Profile cleaning first checks the editable structure, clears inapplicable numeric values, then applies full numeric validation. Server input validation remains strict. Errors identify the field and storage setup. Undo tracks removed setups independently and enforces the 12-setup limit without replacing another setup.

Orphan drafts show a summary, download and targeted confirmed discard; no fake Save action. There is no reliable successor-ID mapping in the client notebook, so the UI directs the user to the current catalog entry without guessing a target or copying answers automatically.

Low displays and expanded dish lists scroll the complete dialog. Step buttons wrap using their content width. No reduced font or touch target is used to fit the form.

## Validation and rollback

Regression suite includes original checks plus actual field-handler and lease coordination tests: handoff, stale deletion, volatile retention, aborted waiting, Strict Mode ownership, pending identity and account isolation. Browser testing uses separate localhost data, including two live tabs editing different and identical items, fresh shared data after handoff, ten dish uses, low landscape display, portrait and enlarged text. No real chef answers are used as test inputs.

Before release, the production notebook is backed up outside the checkout in `../nasazeni-opravy-formulare-2026-09-13/`. Compare fresh post-release data and access with the baseline. Do not restore that backup over later chef edits. For rollback, retain the lease, draft compatibility, profile normalizer and receipt support; build a compatibility release reverting only the faulty behavior. An unconditional redeploy of the pre-fix editor would reintroduce draft loss between tabs.
