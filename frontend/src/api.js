const BASE = "/api";

async function handle(res) {
  if (!res.ok) {
    let message = "Request failed.";
    try {
      const body = await res.json();
      message = body.error || message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  return res.json();
}

export const api = {
  listForms: () => fetch(`${BASE}/forms`).then(handle),
  getForm: (id) => fetch(`${BASE}/forms/${id}`).then(handle),
  createForm: (payload) =>
    fetch(`${BASE}/forms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(handle),
  extract: (formId, fields, file) => {
    const fd = new FormData();
    fd.append("schema", JSON.stringify(fields));
    fd.append("file", file);
    return fetch(`${BASE}/extract`, { method: "POST", body: fd }).then(handle);
  },
  saveSubmission: (formId, values) =>
    fetch(`${BASE}/forms/${formId}/submissions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ values }),
    }).then(handle),
};
