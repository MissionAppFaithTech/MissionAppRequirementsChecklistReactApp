---
name: Mission App checklist
description: Product decisions for the Mission App Requirements React rebuild.
---

The requirements atlas is intentionally a public, frontend-only experience. Checklist state belongs to the current browser via localStorage; there is no authentication, backend validation, or cross-user synchronization.

**Why:** The requested product is an open requirements reference and progress tracker, not an operational workflow requiring accounts or server persistence.

**How to apply:** Preserve independent parent and nested-item checkboxes, local progress summaries, search/filter behavior, and a safe reset flow when extending the app.