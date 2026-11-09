import React from "react";
import { createRoot } from "react-dom/client";
import { StudioApp } from "./studio-app";
import "./style.css";

createRoot(document.getElementById("root")!).render(<React.StrictMode><StudioApp /></React.StrictMode>);
