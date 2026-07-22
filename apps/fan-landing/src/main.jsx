import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { analytics } from "@coxa/analytics";
import LandingPage from "./LandingPage.jsx";

analytics.init();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <LandingPage />
  </StrictMode>,
);
