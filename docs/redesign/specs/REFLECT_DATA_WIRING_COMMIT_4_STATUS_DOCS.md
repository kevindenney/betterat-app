# Reflect Data Wiring Commit 4 Spec: Status Docs

## Files

Change:

- `docs/redesign/IOS_MIGRATION_PLAN.md`
- `docs/redesign/DATA_LAYER_DEPENDENCIES.md`
- `docs/redesign/IOS_SURFACE_INVENTORY.json`

## Required Updates

In `IOS_MIGRATION_PLAN.md`:

- Change Reflect Race Log/Profile from `shipped-with-known-limitation` to `shipped`.
- Replace the known-limitation paragraph with a shipped note referencing the adapter commits.
- Keep follow-ups: season picker interactivity, filter persistence, Profile preference writeback, billing source, and non-sailing profile stat labels.

In `DATA_LAYER_DEPENDENCIES.md`:

- Change Race Log/Profile verdict from `blocked-on-real-data-wiring` to `ready`.
- Keep follow-ups as follow-ups, not blockers.

In `IOS_SURFACE_INVENTORY.json`:

- Set `race-log-ios.canonical_status` to `shipped`.
- Set `profile-ios.canonical_status` to `shipped`.
- Update `wire_up` from `placeholder` to `real-data`.
- Add notes that preview routes remain fixture-backed but production Reflect uses adapters.

## Verification

Run:

```sh
python -m json.tool docs/redesign/IOS_SURFACE_INVENTORY.json >/tmp/ios_surface_inventory.json
rg -n "sample-data|fixture-backed|known limitation|blocked-on-real-data-wiring" docs/redesign/IOS_MIGRATION_PLAN.md docs/redesign/DATA_LAYER_DEPENDENCIES.md docs/redesign/IOS_SURFACE_INVENTORY.json
```

The `rg` command may still find historical notes if intentionally preserved, but current readiness rows must not say Race Log/Profile are blocked after Commit 3 lands.

## Commit Message

```text
docs(redesign): mark Reflect data wiring complete

Update iOS-register migration docs after replacing the Reflect preview
fixtures with real-data adapters.

- Race Log / Shift Log now consume useReflectLog in production
- Profile now consumes real profile/account data in production
- preview routes remain fixture-backed for design review only
- follow-ups stay scoped to filters, preferences, billing, and richer stats
```

