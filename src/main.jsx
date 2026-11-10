import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/global.css";
import "./styles/serverGrid.css";
import "./styles/layout.css";
import "./styles/playback.css";

// Reference-inspired defaults apply only when the user has no saved preference.
try {
  if (localStorage.getItem("streambert_accentColor") === null) {
    localStorage.setItem("streambert_accentColor", JSON.stringify("pink"));
  }
} catch { /* Private/restricted storage must not prevent startup. */ }

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
