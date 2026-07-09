import { useEffect, useState } from "react";
import FormBuilder from "./components/FormBuilder.jsx";
import DocumentUpload from "./components/DocumentUpload.jsx";
import ReviewForm from "./components/ReviewForm.jsx";
import { api } from "./api.js";

export default function App() {
  const [step, setStep] = useState("build"); // build | upload | review
  const [form, setForm] = useState(null);
  const [extracted, setExtracted] = useState(null);
  const [savedForms, setSavedForms] = useState([]);

  useEffect(() => {
    api.listForms().then(setSavedForms).catch(() => {});
  }, [step]);

  const handleLoadTemplate = async (id) => {
    const loaded = await api.getForm(id);
    setForm(loaded);
    // Jump straight into upload since the form schema already exists
    setStep("upload");
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Form autofill</h1>
        <p>Build a form, upload a document, and let AI fill it in for you.</p>
        <ol className="stepper">
          <li className={step === "build" ? "active" : ""}>1. Build</li>
          <li className={step === "upload" ? "active" : ""}>2. Upload</li>
          <li className={step === "review" ? "active" : ""}>3. Review</li>
        </ol>
      </header>

      <main className="app-main">
        {step === "build" && (
          <FormBuilder
            savedForms={savedForms}
            onLoadTemplate={handleLoadTemplate}
            onFormReady={(savedForm) => {
              setForm(savedForm);
              setStep("upload");
            }}
          />
        )}

        {step === "upload" && form && (
          <DocumentUpload
            form={form}
            onBack={() => setStep("build")}
            onExtracted={(values) => {
              setExtracted(values);
              setStep("review");
            }}
          />
        )}

        {step === "review" && form && (
          <ReviewForm
            form={form}
            extracted={extracted}
            onBack={() => setStep("upload")}
            onSaved={() => {
              setStep("build");
              setForm(null);
              setExtracted(null);
            }}
          />
        )}
      </main>
    </div>
  );
}
