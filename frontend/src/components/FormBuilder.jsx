import { useState } from "react";
import FieldEditor from "./FieldEditor.jsx";
import FormRenderer from "./FormRenderer.jsx";
import { api } from "../api.js";

let tempId = 0;
const nextTempId = () => `tmp_${Date.now()}_${tempId++}`;

export default function FormBuilder({ onFormReady, savedForms, onLoadTemplate }) {
  const [title, setTitle] = useState("");
  const [fields, setFields] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showAIGenerator, setShowAIGenerator] = useState(false);
  const [aiDescription, setAIDescription] = useState("");
  const [aiGenerating, setAIGenerating] = useState(false);

  const addField = () => {
    setFields((prev) => [
      ...prev,
      { id: nextTempId(), label: "", type: "text", required: false, options: [] },
    ]);
  };

  const updateField = (id, updated) => {
    setFields((prev) => prev.map((f) => (f.id === id ? updated : f)));
  };

  const removeField = (id) => {
    setFields((prev) => prev.filter((f) => f.id !== id));
  };

  const exportSchema = () => {
    const blob = new Blob([JSON.stringify({ title, fields }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title || "form"}-schema.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importSchema = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        setTitle(parsed.title || "");
        setFields((parsed.fields || []).map((f) => ({ ...f, id: nextTempId() })));
      } catch {
        setError("That schema file could not be read.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleContinue = async () => {
    setError("");
    if (!title.trim()) return setError("Give your form a title first.");
    if (fields.length === 0) return setError("Add at least one field before continuing.");
    if (fields.some((f) => !f.label.trim())) return setError("Every field needs a label.");

    setSaving(true);
    try {
      const savedForm = await api.createForm({ title, fields });
      onFormReady(savedForm);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAIGenerate = async () => {
    setError("");
    if (!aiDescription.trim() || aiDescription.trim().length < 10) {
      return setError("Please provide a more detailed description (at least 10 characters).");
    }

    setAIGenerating(true);
    try {
      const response = await fetch("http://localhost:4000/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: aiDescription }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate form");
      }

      const schema = await response.json();
      setTitle(schema.title);
      setFields(schema.fields.map((f) => ({ ...f, id: nextTempId() })));
      setShowAIGenerator(false);
      setAIDescription("");
    } catch (e) {
      setError(e.message);
    } finally {
      setAIGenerating(false);
    }
  };

  return (
    <div className="builder-layout">
      <div className="builder-panel">
        <h2>1. Build your form</h2>

        <div className="builder-mode-toggle">
          <button 
            type="button" 
            className={`btn-secondary ${!showAIGenerator ? 'active' : ''}`}
            onClick={() => setShowAIGenerator(false)}
          >
            Manual Builder
          </button>
          <button 
            type="button" 
            className={`btn-secondary ${showAIGenerator ? 'active' : ''}`}
            onClick={() => setShowAIGenerator(true)}
          >
            AI Builder ✨
          </button>
        </div>

        {showAIGenerator ? (
          <div className="ai-generator">
            <p>Describe your form and AI will generate it for you:</p>
            <textarea
              className="ai-description-input"
              placeholder="e.g., Create a job application form with name, email, phone, work experience, education, and availability"
              value={aiDescription}
              onChange={(e) => setAIDescription(e.target.value)}
              rows={4}
            />
            <button 
              type="button" 
              className="btn-primary" 
              onClick={handleAIGenerate}
              disabled={aiGenerating}
            >
              {aiGenerating ? "Generating..." : "Generate Form"}
            </button>
            <button 
              type="button" 
              className="btn-secondary"
              onClick={() => setShowAIGenerator(false)}
            >
              Cancel
            </button>
          </div>
        ) : (
          <>
            {savedForms?.length > 0 && (
              <div className="template-picker">
                <label>Load a saved form as a starting point</label>
                <select
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) onLoadTemplate(e.target.value);
                  }}
                >
                  <option value="">— None —</option>
                  {savedForms.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

        <input
          type="text"
          className="form-title-input"
          placeholder="Form title (e.g. Candidate Application)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        {fields.map((f) => (
          <FieldEditor
            key={f.id}
            field={f}
            onUpdate={(updated) => updateField(f.id, updated)}
            onRemove={() => removeField(f.id)}
          />
        ))}

        <div className="builder-actions">
          <button type="button" className="btn-secondary" onClick={addField}>
            <i className="ti ti-plus" aria-hidden="true" /> Add field
          </button>
          <button type="button" className="btn-secondary" onClick={exportSchema} disabled={!fields.length}>
            <i className="ti ti-download" aria-hidden="true" /> Export schema
          </button>
          <label className="btn-secondary file-import">
            <i className="ti ti-upload" aria-hidden="true" /> Import schema
            <input type="file" accept="application/json" onChange={importSchema} hidden />
          </label>
        </div>

        {error && <p className="error-text">{error}</p>}

        <button type="button" className="btn-primary" onClick={handleContinue} disabled={saving}>
          {saving ? "Saving…" : "Continue to document upload"}
        </button>
          </>
        )}
      </div>

      <div className="preview-panel">
        <h2>Live preview</h2>
        <div className="preview-card">
          <h3>{title || "Untitled form"}</h3>
          <FormRenderer fields={fields} values={{}} readOnlyPreview />
        </div>
      </div>
    </div>
  );
}
