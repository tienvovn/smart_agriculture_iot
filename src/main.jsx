import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import "./index.css";
import App from "./App";
import { FarmProvider } from "./context/FarmContext";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <FarmProvider>
        <App />
      </FarmProvider>
    </BrowserRouter>
  </StrictMode>
);