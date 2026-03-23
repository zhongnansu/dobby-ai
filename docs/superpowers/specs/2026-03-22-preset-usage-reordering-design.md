# Preset Usage-Based Reordering

**Date:** 2026-03-22
**Status:** Approved

## Goal

Reorder preset suggestions based on what the user actually clicks. After 5+ clicks on a preset for a given content type, sort suggested presets by frequency so the user's most-used action appears first in the toolbar and bubble.

## How It Works

1. Every preset click increments a counter in `chrome.storage.local`, keyed by content type + label
2. On extension load, the usage data is read from storage and cached in a module-level variable for instant sync access
3. `getSuggestedPresetsForType()` checks the cache — if any preset for that type has 5+ clicks, sort by count descending
4. Both the toolbar and bubble benefit automatically since they share the same function

## Storage Shape

```json
{
  "presetUsage": {
    "code:javascript": { "Debug this": 12, "Explain this JavaScript": 3 },
    "default": { "Summarize": 8, "Explain simply": 2 }
  }
}
```

Key format: `{contentType}:{subType}` if subType exists, otherwise just `{contentType}`. Constructed by helper `buildTypeKey(type, subType)`.

## Files to Change

| File | Changes |
|------|---------|
| `src/content/shared/preset-usage.js` | **New file.** Exports: `loadUsageData()`, `recordPresetUsage(typeKey, label)`, `getReorderedPresets(presets, typeKey)`, `buildTypeKey(type, subType)`. Caches data in module-level variable. |
| `src/content/presets.js` | Update `getSuggestedPresetsForType()` to call `getReorderedPresets()` before returning. Must return a shallow copy (`[...presets]`), never mutate the original static arrays. |
| `src/content/trigger/button.js` | In `expandToolbar()`, the preset click handler calls `recordPresetUsage(buildTypeKey(detected.type, detected.subType), preset.label)` before calling `morphIntoBubble()`. The `detected` variable is already in local scope (line 169). |
| `src/content/bubble/core.js` | In `showBubbleWithPresets()`, the preset chip `mousedown` handler (lines 307-311) calls `recordPresetUsage(buildTypeKey(detected.type, detected.subType), preset.label)`. The `detected` variable is already in scope from line 281-286. Do NOT modify `launchFromPreset` signature. |
| `src/content/index.js` | Call `loadUsageData()` at startup alongside existing `chrome.storage.local.get`. |

## Reordering Logic

```javascript
export function buildTypeKey(type, subType) {
  return subType ? `${type}:${subType}` : type;
}

export function getReorderedPresets(presets, typeKey) {
  const usage = usageCache[typeKey];
  if (!usage) return presets;

  // Only reorder if at least one preset has 5+ clicks
  const hasEnoughData = presets.some(p => (usage[p.label] || 0) >= 5);
  if (!hasEnoughData) return presets;

  // IMPORTANT: [...presets] creates a shallow copy — never mutate the
  // original static arrays in PRESETS/CODE_SUBTYPE_PRESETS
  return [...presets].sort((a, b) => (usage[b.label] || 0) - (usage[a.label] || 0));
}
```

## Edge Cases

- **New installs:** No usage data → presets stay in hardcoded order
- **Below threshold:** Less than 5 clicks on any preset → no reordering
- **Tie:** Same click count → maintain original order (JS stable sort since ES2019)
- **Storage unavailable:** Graceful fallback to hardcoded order (chrome.storage.local fails silently in some contexts)
- **Startup race:** If user triggers a preset before `loadUsageData` callback completes, presets appear in default order. Self-correcting once load finishes.
- **No write debouncing:** `chrome.storage.local.set` is fast and handles concurrent calls internally. No batching needed for v1.
- **Storage growth:** Bounded by the finite set of content type keys (~20 possible values). No eviction or TTL needed.
- **Popover presets:** `getAllPresetsForType()` is NOT reordered — only `getSuggestedPresetsForType()` is affected. The popover order stays fixed.

## Testing

- `tests/preset-usage.test.js` — new:
  - `buildTypeKey` returns correct keys (with/without subType, null, undefined, empty string)
  - `loadUsageData` populates cache from chrome.storage
  - `recordPresetUsage` increments count and persists to chrome.storage
  - `getReorderedPresets` returns original order below threshold
  - `getReorderedPresets` reorders by frequency at/above threshold
  - `getReorderedPresets` maintains original order on ties (stable sort test)
  - Handles missing/empty storage gracefully
- `tests/presets.test.js` — update: mock `preset-usage.js` via `vi.mock` and verify `getSuggestedPresetsForType` returns reordered results when usage data exists
