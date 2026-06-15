/*
 * blocscore — a bouldering-gym scoreboard.
 * Copyright (C) 2026 manubloc
 *
 * This program is free software: you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the Free
 * Software Foundation, either version 3 of the License, or (at your option)
 * any later version. See <https://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import React from "react";
import { createRoot } from "react-dom/client";
import storage from "./storage.js";
import App from "./App.jsx";

// Provide the storage API the app expects.
window.storage = storage;

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
