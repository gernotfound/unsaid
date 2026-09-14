"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  getAuth,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { getFirebaseClientApp } from "../lib/firebaseClient";
import styles from "./CustomerAccount.module.css";

type Mode = "login" | "register";

async function exchangeSession(user: User, displayName?: string) {
  const idToken = await user.getIdToken(true);
  const response = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ idToken, ...(displayName ? { displayName } : {}) }),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? "SESSION_FAILED");
  }
}

function messageFor(error: unknown) {
  const code = error instanceof Error ? error.message : String(error);
  if (code.includes("auth/invalid-credential")) return "Email o password non corretti.";
  if (code.includes("auth/email-already-in-use")) return "Esiste già un account con questa email.";
  if (code.includes("auth/weak-password")) return "La password non soddisfa i requisiti di sicurezza.";
  if (code.includes("auth/too-many-requests")) return "Troppi tentativi. Riprova più tardi.";
  if (code.includes("RECENT_SIGN_IN_REQUIRED")) return "Accedi di nuovo per creare la sessione.";
  return "Operazione non riuscita. Riprova.";
}

export function CustomerAuthPanel() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const displayName = String(form.get("displayName") ?? "").trim();
    setBusy(true);
    setFeedback("");

    try {
      const auth = getAuth(getFirebaseClientApp());
      const credential = mode === "register"
        ? await createUserWithEmailAndPassword(auth, email, password)
        : await signInWithEmailAndPassword(auth, email, password);

      if (mode === "register") {
        if (displayName) await updateProfile(credential.user, { displayName });
        await sendEmailVerification(credential.user);
      }

      await exchangeSession(credential.user, displayName || undefined);
      router.refresh();
    } catch (error) {
      setFeedback(messageFor(error));
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword(emailInput: HTMLInputElement | null) {
    const email = emailInput?.value.trim();
    if (!email) {
      setFeedback("Inserisci prima la tua email.");
      emailInput?.focus();
      return;
    }
    setBusy(true);
    try {
      await sendPasswordResetEmail(getAuth(getFirebaseClientApp()), email);
      setFeedback("Se l'account esiste, riceverai una mail per reimpostare la password.");
    } catch (error) {
      setFeedback(messageFor(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.authPanel}>
      <div className={styles.switcher} role="tablist" aria-label="Accesso account">
        <button type="button" data-active={mode === "login"} onClick={() => setMode("login")}>Accedi</button>
        <button type="button" data-active={mode === "register"} onClick={() => setMode("register")}>Crea account</button>
      </div>

      <form onSubmit={submit} className={styles.form}>
        {mode === "register" ? (
          <label>
            <span>Nome</span>
            <input name="displayName" type="text" autoComplete="name" minLength={2} maxLength={80} required />
          </label>
        ) : null}
        <label>
          <span>Email</span>
          <input id="customer-email" name="email" type="email" autoComplete="email" required />
        </label>
        <label>
          <span>Password</span>
          <input
            name="password"
            type="password"
            autoComplete={mode === "register" ? "new-password" : "current-password"}
            minLength={8}
            required
          />
        </label>
        <button className={styles.primary} type="submit" disabled={busy}>
          {busy ? "Attendi…" : mode === "register" ? "Crea account" : "Accedi"}
        </button>
      </form>

      {mode === "login" ? (
        <button
          type="button"
          className={styles.textButton}
          disabled={busy}
          onClick={() => void resetPassword(document.querySelector<HTMLInputElement>("#customer-email"))}
        >
          Password dimenticata?
        </button>
      ) : (
        <p className={styles.note}>Dopo la registrazione invieremo una mail di verifica. L&apos;email verificata sarà obbligatoria per acquistare.</p>
      )}

      {feedback ? <p className={styles.feedback} aria-live="polite">{feedback}</p> : null}
    </section>
  );
}

export async function logoutCustomer() {
  const auth = getAuth(getFirebaseClientApp());
  await fetch("/api/auth/session", { method: "DELETE" });
  await signOut(auth).catch(() => undefined);
}
