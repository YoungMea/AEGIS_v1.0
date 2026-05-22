// Preload runs in an isolated context. We do not expose any Node APIs to the
// remote-loaded site for safety. Kept here so the renderer process has a
// clean entry point if we want to wire native features later.
"use strict";
