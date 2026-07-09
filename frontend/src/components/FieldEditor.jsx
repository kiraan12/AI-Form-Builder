const TYPES = [
  { value: "text", label: "Single-line text" },
  { value: "textarea", label: "Multi-line text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "dropdown", label: "Dropdown" },
  { value: "checkbox", label: "Checkbox" },
];

export default function FieldEditor({ field, onUpdate, onRemove }) {
  return (
    <div className="field-editor">
      <input
        type="text"
        className="field-editor-label"
        placeholder="Field label (e.g. Candidate name)"
        value={field.label}
        onChange={(e) => onUpdate({ ...field, label: e.target.value })}
      />

      <select value={field.type} onChange={(e) => onUpdate({ ...field, type: e.target.value })}>
        {TYPES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>

      {field.type === "dropdown" && (
        <input
          type="text"
          className="field-editor-options"
          placeholder="Options, comma separated"
          value={(field.options || []).join(", ")}
          onChange={(e) =>
            onUpdate({
              ...field,
              options: e.target.value
                .split(",")
                .map((o) => o.trim())
                .filter(Boolean),
            })
          }
        />
      )}

      <label className="required-toggle">
        <input
          type="checkbox"
          checked={field.required}
          onChange={(e) => onUpdate({ ...field, required: e.target.checked })}
        />
        Required
      </label>

      <button type="button" className="btn-icon-danger" onClick={onRemove} aria-label="Remove field">
        <i className="ti ti-trash" aria-hidden="true" /> Remove
      </button>
    </div>
  );
}
