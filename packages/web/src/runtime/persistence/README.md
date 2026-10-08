# Persisted State

`persisted(target, schema, initial, platformOverride?)` creates a Solid store whose
type comes from an Effect Schema codec. The required `initial` value supplies
store defaults and is checked against that type. The function returns the store, setter, storage
initialization result, and readiness accessor. Persisted state goes through this
boundary, including cross-window updates.

```ts
const Preferences = Persistence.struct({
  visible: Schema.Boolean,
  mode: Schema.Literals(["normal", "shell"]),
  directory: Persistence.optional(Schema.String),
  recent: Persistence.array(Schema.String),
})

type Preferences = typeof Preferences.Type

const [preferences, setPreferences, , ready] = persisted(Persist.global("preferences"), Preferences, {
  visible: true,
  mode: "normal",
  recent: [],
})
```

Keep initialization defaults in `initial`, not repeated across schema fields.
Plain struct fields recover independently from the corresponding initial value;
the resulting state is validated before entering the store. Arrays replace rather
than index-merge, explicit `null` is retained when allowed, and missing optional
values can inherit dynamic initial defaults.

Field codecs decode atomically, so the persistence layer does not attempt to
interpret arbitrary transformations. Collection-entry recovery and genuine
migration rules remain explicit in their schemas.

- `Persistence.fallback(schema, factory)` deliberately recovers invalid values as
  well as missing or undefined input. Use it for domain-specific recovery, such as
  defaults inside collection entries, not ordinary store initialization.
- `Persistence.optional(schema)` omits invalid fields as well as accepting missing
  or undefined input. Use ordinary `Schema.optional` when no codec-local recovery
  is needed; the initialized store boundary still recovers fields from `initial`.
- `Persistence.struct(fields)` makes fields mutable for Solid stores while preserving
  each field's optionality and codec. It does not add defaults or error recovery.
- `Persistence.record(valueSchema)` creates a mutable string-keyed record, defaulting
  missing or invalid records to a fresh `{}`. Its value schema determines entry
  recovery: pass `Persistence.optional(valueSchema)` to discard only invalid entries,
  or `Persistence.fallback(valueSchema, factory)` to replace those entries.
- `Persistence.array(schema)` defaults to an empty mutable array and discards
  invalid entries individually. Valid entries still pass through their codecs.
- Recovery is not a substitute for an explicit historical shape transformation.

## Writes

The setter returned by `persisted()` only marks the store dirty (`persist.ts`). The store is
serialized once per save window (`persistSaveDelay`), on owner cleanup, and when the page
hides, and the write is skipped when the serialized form did not change. Reactive observers
therefore see every mutation immediately and a burst of setter calls costs one encode. Call
`flushPersisted()` when a test or a shutdown path needs the write to have happened. A real unsaved local
change wins over a value arriving from another window, and over a stored value that finishes
loading after the user already edited. A remote value that arrives while the store is dirty
is held until the save runs; if the local setter calls turned out not to change the
serialized form, the remote value is adopted instead of being lost.

## Migrations

Describe shipped representations with schemas and transform their typed values
using `Schema.decode` or `Schema.decodeTo` and `SchemaGetter`. For whole-object
migrations, pass `Persistence.migrate(currentSchema, storedCodec)` instead of the
plain schema. The stored codec runs before defaults are applied, preserving
distinctions such as an absent current field identifying an older format. It
returns a candidate in the current encoded shape; the current schema then owns
recovery and validation.

The migration reader preserves excess properties so a migration can describe
only the fields it observes without dropping unrelated saved preferences. The
current schema strips fields outside its contract. Writes use only the current
schema's encoder, never the legacy reader's encoder.

`Persistence.withInitial(schemaOrMigration, initial)` exposes the same initialized
codec for focused tests. Test canonical encoding and decode/encode/decode stability
as well as historical fixtures.

Reads normalize stored JSON through decoding and encoding, writing back the
canonical representation when it changed. Invalid documents fall back to initial
state; malformed individual values can instead be recovered by their schemas.
Cross-window values are decoded before entering the store. Writes use the same
codec's encoder.

All iKanban V2 state lives under `ikanban.v2.*`, including the browser draft
database and cross-window channels. Bare targets and `previousKey` relocation use
`ikanban.v2.direct.dat`; they never read or remove the former frontend's bare keys
or `opencode.*` state. Quota eviction is limited to the same iKanban V2 namespace.

Storage-key relocation (`previousKey`, workspace aliases, draft storage moves)
remains separate from schema migration. Draft blob externalization and hydration
also remain in the storage adapter: composer codecs receive hydrated references,
not raw ID-only blob documents.

## Large draft content

Draft documents never carry large text inline. Any string of `draftTextThreshold`
characters or more is split into `draftTextChunk`-sized content-addressed blobs and
stored as `{ blob: { kind: "text", ids: [...] } }`; reads join the chunks again. A
content-keyed cache means unchanged chunks are not hashed or sent on later saves, so
typing after a large paste uploads one chunk per save rather than the paste. Chunk
boundaries never split a surrogate pair, and a failed upload is evicted so the next save
retries it.

Blob collection is made safe by validation on write, not by timing. A strict document write
is refused while it references blob ids the store does not hold, so the previous document
stays visible; the renderer uploads the missing bytes again from the chunk text or the image
`Blob` it still holds, renames the references to the ids the uploads returned (content hashes
normally, fresh ids on a store without WebCrypto), and publishes. This covers a chunk another
tab collected, and an image the composer kept in its history long after its blob was
collected. `persisted()` hands the draft store the encoded document (`setDocument`) rather than
a serialized string, so the store does not re-parse the full document to externalize
it. The browser IndexedDB blob collector keeps chunk ids alive. This
follows VS Code's rule that editor content lives in per-resource backups, not in the
state database.
