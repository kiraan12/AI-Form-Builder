export default function FormRenderer({ fields, values, onChange, errors, confidences, readOnlyPreview }) {
  if (!fields.length) {
    return <p className="empty-hint">Add a field to see the form preview here.</p>;
  }

  return (
    <div className="form-renderer">
      {fields.map((f) => {
        const value = values?.[f.id]?.value ?? values?.[f.id] ?? "";
        const confidence = confidences?.[f.id];
        const hasError = errors?.includes(f.id);

        return (
          <div key={f.id} className={`field-row ${hasError ? "field-error" : ""}`}>
            <label>
              {f.label}
              {f.required && <span className="required-star"> *</span>}
              {confidence && (
                <span className={`confidence-badge confidence-${confidence}`}>{confidence}</span>
              )}
            </label>

            {f.type === "text" && (
              <input
                type="text"
                value={value}
                disabled={readOnlyPreview}
                onChange={(e) => onChange?.(f.id, e.target.value)}
                placeholder={readOnlyPreview ? "Sample text" : ""}
              />
            )}

            {f.type === "textarea" && (
              <textarea
                rows={3}
                value={value}
                disabled={readOnlyPreview}
                onChange={(e) => onChange?.(f.id, e.target.value)}
              />
            )}

            {f.type === "number" && (
              <input
                type="number"
                value={value}
                disabled={readOnlyPreview}
                onChange={(e) => onChange?.(f.id, e.target.value)}
              />
            )}

            {f.type === "date" && (
              <input
                type="date"
                value={value}
                disabled={readOnlyPreview}
                onChange={(e) => onChange?.(f.id, e.target.value)}
              />
            )}

            {f.type === "dropdown" && (
              <select
                value={value}
                disabled={readOnlyPreview}
                onChange={(e) => onChange?.(f.id, e.target.value)}
              >
                <option value="">Select…</option>
                {(f.options || []).map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            )}

            {f.type === "checkbox" && (
              <input
                type="checkbox"
                checked={!!value}
                disabled={readOnlyPreview}
                onChange={(e) => onChange?.(f.id, e.target.checked)}
              />
            )}

            {hasError && <span className="field-error-text">This field is required.</span>}
          </div>
        );
      })}
    </div>
  );
}
