import React from "react";
import { createRoot } from "react-dom/client";
import { GoogleFormsManager } from "../../src/components/google-forms/GoogleFormsManager";
import { googleFormTemplates } from "../../src/lib/googleForms/templates";

createRoot(document.getElementById("root")!).render(<GoogleFormsManager
  initialAccess={{ email: "test-admin@example.test", authenticated: true, canConnect: false, isReadOnly: false, manageableClubs: ["ecc"] }}
  templates={googleFormTemplates}
/>);
