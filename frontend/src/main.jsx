import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { SocketProvider } from "./context/SocketContext.jsx";
import "./index.css";
import App from "./App.jsx";
import { CallProvider } from "./context/CallContext.jsx";

import { BrowserRouter } from "react-router";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <SocketProvider>
           <CallProvider>
          <App />
          </CallProvider>
          </SocketProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </StrictMode>
);