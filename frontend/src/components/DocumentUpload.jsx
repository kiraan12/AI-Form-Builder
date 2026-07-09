import { useState, useRef } from "react";
import { api } from "../api.js";

const ACCEPTED = ["application/pdf", "image/png", "image/jpeg"];

export default function DocumentUpload({ form, onExtracted, onBack }) {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | uploaded | extracting | error
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  const validateAndSet = (selected) => {
    setError("");
    if (!selected) return;
    if (!ACCEPTED.includes(selected.type)) {
      setError(`Unsupported file type "${selected.type || "unknown"}". Please upload a PDF, PNG, or JPEG.`);
      setStatus("error");
      setFile(null);
      return;
    }
    setFile(selected);
    setStatus("uploaded");
  };

  const handleDrop = (e) => {
    e.preventDefault();
    validateAndSet(e.dataTransfer.files?.[0]);
  };

  const handleExtract = async () => {
    setStatus("extracting");
    setError("");
    try {
      const { values } = await api.extract(form.id, form.fields, file);
      onExtracted(values);
    } catch (e) {
      setError(e.message || "Extraction failed. Please try again.");
      setStatus("error");
    }
  };

  return (
    <div className="upload-step">
      <h2>2. Upload a document</h2>
      <p className="step-hint">
        Upload a document for <strong>{form.title}</strong> and the AI will fill in the fields you defined.
      </p>

      <div
        className={`dropzone ${status === "error" ? "dropzone-error" : ""}`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => inputRef.current.click()}
      >
        <i className="ti ti-file-upload" aria-hidden="true" />
        {file ? (
          <p>
            <strong>{file.name}</strong> selected
          </p>
        ) : (
          <p>Click to browse or drag a PDF, PNG, or JPEG here</p>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg"
          hidden
          onChange={(e) => validateAndSet(e.target.files?.[0])}
        />
      </div>

      {status === "uploaded" && <p className="success-text">File uploaded successfully.</p>}
      {error && <p className="error-text">{error}</p>}

      <div className="builder-actions">
        <button type="button" className="btn-secondary" onClick={onBack}>
          Back
        </button>
        <button
          type="button"
          className="btn-primary"
          onClick={handleExtract}
          disabled={!file || status === "extracting"}
        >
          {status === "extracting" ? "Extracting…" : "Extract & fill form"}
        </button>
      </div>
    </div>
  );
}
