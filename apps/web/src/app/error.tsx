"use client";

import { useEffect } from "react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("UNSAID route error", {
      name: error.name,
      message: error.message,
      digest: error.digest,
    });
  }, [error]);

  return (
    <main className="shell">
      <p className="eyebrow">SYSTEM / RECOVERABLE ERROR</p>
      <h1>Something broke.</h1>
      <p>La pagina non è stata completata correttamente. Puoi riprovare senza perdere l&apos;intero sito.</p>
      <button type="button" onClick={reset}>Riprova</button>
    </main>
  );
}
