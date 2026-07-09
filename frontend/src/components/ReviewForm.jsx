import { useState } from "react";
import FormRenderer from "./FormRenderer.jsx";
import { api } from "../api.js";

export default function ReviewForm({ form, extracted, onBack, onSaved }) {
  const [values, setValues] = useState(
    Object.fromEntries(form.fields.map((f) => [f.id, extracted?.[f.id]?.value ?? (f.type === "checkbox" ? false : "")]))
  );
  const confidences = Object.fromEntries(form.fields.map((f) => [f.id, extracted?.[f.id]?.confidence]));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const missingRequired = form.fields.filter((f) => f.required && (values[f.id] === "" || values[f.id] == null));

  const handleChange = (fieldId, value) => {
    setValues((prev) => ({ ...prev, [fieldId]: value }));
  };

  const handleSave = async () => {
    if (missingRequired.length > 0) {
      setError(`Please fill in: ${missingRequired.map((f) => f.label).join(", ")}`);
      return;
    }
    setError("");
    setSaving(true);
    try {
      await api.saveSubmission(form.id, values);
      setSaved(true);
      onSaved?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (saved) {
    return (
      <div className="saved-confirmation">
        <i className="ti ti-check" aria-hidden="true" />
        <h2>Saved</h2>
        <p>Your completed "{form.title}" form has been saved.</p>
        <button type="button" className="btn-primary" onClick={onSaved}>
          Back to Home
        </button>
      </div>
    );
  }

  return (
    <div className="review-step">
      <h2>3. Review &amp; save</h2>
      <p className="step-hint">
        Fields extracted from your document are shown below. Edit anything that looks off, then save.
      </p>

      {missingRequired.length > 0 && (
        <p className="warning-text">
          <i className="ti ti-alert-triangle" aria-hidden="true" /> {missingRequired.length} required field(s) still
          need a value.
        </p>
      )}

      <FormRenderer
        fields={form.fields}
        values={values}
        onChange={handleChange}
        confidences={confidences}
        errors={missingRequired.map((f) => f.id)}
      />

      {error && <p className="error-text">{error}</p>}

      <div className="builder-actions">
        <button type="button" className="btn-secondary" onClick={onBack}>
          Back
        </button>
        <button type="button" className="btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save form"}
        </button>
      </div>
    </div>
  );
}
