import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setBaseUrl } from "@workspace/api-client-react";

// In packaged Electron the renderer loads via file://, so relative /api
// requests don't resolve. Point the API client at the spawned local server.
if (window.location.protocol === "file:") {
  setBaseUrl("http://127.0.0.1:8080");
}

createRoot(document.getElementById("root")!).render(<App />);
