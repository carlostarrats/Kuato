import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { App } from "./App";
import { AnnotationOverlay } from "./overlay/AnnotationOverlay";
import { cancelNote, createDaemonClearSignal, postNote } from "./overlay/daemonClient";

// Full seam wiring:
// - pinning an element POSTs its location to the local daemon, which buffers it for the
//   next prompt submit (the UserPromptSubmit hook injects it; your terminal message is
//   the comment);
// - Cancel drops the buffered pin;
// - the overlay subscribes to the daemon's SSE clear stream, so when Claude finishes
//   (Stop hook → /complete) the "?" marker clears.
const clearSignal = createDaemonClearSignal();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AnnotationOverlay
      onPin={(note) => postNote(note)}
      onCancel={() => cancelNote()}
      clearSignal={clearSignal}
    >
      <App />
    </AnnotationOverlay>
  </StrictMode>
);
