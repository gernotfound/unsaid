"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="shell"><h1>Qualcosa non ha funzionato.</h1><button onClick={reset}>Riprova</button></main>;
}
