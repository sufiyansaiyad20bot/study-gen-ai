import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import "./index.css";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { PageStateProvider } from "./context/PageStateContext.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <PageStateProvider>
          <App />
        </PageStateProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);