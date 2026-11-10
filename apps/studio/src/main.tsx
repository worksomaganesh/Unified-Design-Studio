import React from "react";
import { createRoot } from "react-dom/client";
import { StudioApp } from "./studio-app";
import { DiscoveryProvider } from "./discovery/DiscoveryProvider";
import "./style.css";

createRoot(document.getElementById("root")!).render(<React.StrictMode><DiscoveryProvider><StudioApp /></DiscoveryProvider></React.StrictMode>);
