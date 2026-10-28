---
name: Patch hunk ordering
description: Avoid context failures from out-of-order patch hunks.
---

When updating one file with multiple hunks, order them from top to bottom. If a hunk must target an earlier location after a later one, split the edits into separate patch passes.

**Why:** apply_patch applies hunks in sequence and may fail to match later context when they are out of file order.

**How to apply:** Check hunk order before a multi-section patch; split out-of-order edits into separate passes.
