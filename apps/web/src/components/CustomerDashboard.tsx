"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { getAuth, sendEmailVerification } from "firebase/auth";
import type { CustomerAddress, CustomerProfile, Order } from "@unsaid/domain";
import { getFirebaseClientApp } from "../lib/firebaseClient";
import { logoutCustomer } from "./CustomerAuthPanel";
import styles from "./CustomerAccount.module.css";

type Props = {
  profile: CustomerProfile;
  addresses: readonly CustomerAddress[];
  orders: readonly Order[];
  emailVerified: boolean;
};

async function jsonRequest(url: string, init: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
  });
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;
  if (!response.ok) throw new Error(payload?.error ?? "REQUEST_FAILED");
  return payload;
}

function errorMessage(error: unknown) {
  const code = error instanceof Error ? error.message : String(error);
  if (code.startsWith("INVALID_ADDRESS:")) return "Controlla i dati dell'indirizzo.";
  if (code === "ADDRESS_LIMIT_REACHED") return "Hai raggiunto il limite di indirizzi salvati.";
  if (code === "EMAIL_NOT_VERIFIED") return "Verifica prima la tua email.";
  return "Operazione non riuscita. Riprova.";
}

export function CustomerDashboard({ profile, addresses, orders, emailVerified }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [showAddressForm, setShowAddressForm] = useState(addresses.length === 0);

  async function updateProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setFeedback("");
    try {
      await jsonRequest("/api/account/profile", {
        method: "PATCH",
        body: JSON.stringify({ displayName: String(form.get("displayName") ?? "") }),
      });
      setFeedback("Profilo aggiornato.");
      router.refresh();
    } catch (error) {
      setFeedback(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function addAddress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    setBusy(true);
    setFeedback("");
    try {
      await jsonRequest("/api/account/addresses", { method: "POST", body: JSON.stringify(payload) });
      event.currentTarget.reset();
      setShowAddressForm(false);
      setFeedback("Indirizzo salvato.");
      router.refresh();
    } catch (error) {
      setFeedback(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function setDefault(id: string) {
    setBusy(true);
    setFeedback("");
    try {
      await jsonRequest(`/api/account/addresses/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "default" }),
      });
      router.refresh();
    } catch (error) {
      setFeedback(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function removeAddress(id: string) {
    setBusy(true);
    setFeedback("");
    try {
      await jsonRequest(`/api/account/addresses/${encodeURIComponent(id)}`, { method: "DELETE" });
      router.refresh();
    } catch (error) {
      setFeedback(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function resendVerification() {
    setBusy(true);
    setFeedback("");
    try {
      const auth = getAuth(getFirebaseClientApp());
      await auth.authStateReady();
      const user = auth.currentUser;
      if (!user) throw new Error("AUTH_REQUIRED");
      await sendEmailVerification(user);
      setFeedback("Email di verifica inviata.");
    } catch (error) {
      setFeedback(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function refreshVerification() {
    setBusy(true);
    setFeedback("");
    try {
      const auth = getAuth(getFirebaseClientApp());
      await auth.authStateReady();
      const user = auth.currentUser;
      if (!user) throw new Error("AUTH_REQUIRED");
      await user.reload();
      const idToken = await user.getIdToken(true);
      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      if (!response.ok) throw new Error("SESSION_FAILED");
      router.refresh();
    } catch (error) {
      setFeedback(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setBusy(true);
    try {
      await logoutCustomer();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.dashboard}>
      <section className={styles.identityCard}>
        <div>
          <p className={styles.kicker}>IDENTITY</p>
          <h2>{profile.displayName ?? profile.email}</h2>
          <p>{profile.email}</p>
        </div>
        <div className={emailVerified ? styles.statusOk : styles.statusWarn}>
          {emailVerified ? "EMAIL VERIFIED" : "VERIFY EMAIL"}
        </div>
      </section>

      {!emailVerified ? (
        <section className={styles.notice}>
          <div>
            <strong>Verifica la tua email prima del checkout.</strong>
            <p>L&apos;account può essere configurato subito, ma per acquistare richiederemo un indirizzo email verificato.</p>
          </div>
          <div className={styles.inlineActions}>
            <button type="button" disabled={busy} onClick={() => void resendVerification()}>Reinvia email</button>
            <button type="button" disabled={busy} onClick={() => void refreshVerification()}>Ho verificato</button>
          </div>
        </section>
      ) : null}

      <div className={styles.grid}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}><p className={styles.kicker}>PROFILE</p><span>01</span></div>
          <form className={styles.form} onSubmit={updateProfile}>
            <label><span>Nome</span><input name="displayName" defaultValue={profile.displayName ?? ""} minLength={2} maxLength={80} required /></label>
            <label><span>Email</span><input value={profile.email} disabled /></label>
            <button className={styles.primary} type="submit" disabled={busy}>Salva profilo</button>
          </form>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div><p className={styles.kicker}>SHIPPING / IT ONLY</p><span>02</span></div>
            <button className={styles.textButton} type="button" onClick={() => setShowAddressForm((value) => !value)}>
              {showAddressForm ? "Chiudi" : "+ Aggiungi"}
            </button>
          </div>

          <div className={styles.addressList}>
            {addresses.map((address) => {
              const isDefault = profile.defaultShippingAddressId === address.id;
              return (
                <article className={styles.address} key={address.id}>
                  <div>
                    <strong>{address.label}{isDefault ? " / DEFAULT" : ""}</strong>
                    <p>{address.recipientName}<br />{address.line1}{address.line2 ? <><br />{address.line2}</> : null}<br />{address.postalCode} {address.city} ({address.province})</p>
                  </div>
                  <div className={styles.inlineActions}>
                    {!isDefault ? <button type="button" disabled={busy} onClick={() => void setDefault(address.id)}>Predefinito</button> : null}
                    <button type="button" disabled={busy} onClick={() => void removeAddress(address.id)}>Elimina</button>
                  </div>
                </article>
              );
            })}
            {!addresses.length && !showAddressForm ? <p className={styles.empty}>Nessun indirizzo salvato.</p> : null}
          </div>

          {showAddressForm ? (
            <form className={styles.addressForm} onSubmit={addAddress}>
              <label><span>Etichetta</span><input name="label" placeholder="Casa" maxLength={40} required /></label>
              <label><span>Destinatario</span><input name="recipientName" autoComplete="name" maxLength={100} required /></label>
              <label className={styles.wide}><span>Indirizzo</span><input name="line1" autoComplete="address-line1" maxLength={120} required /></label>
              <label className={styles.wide}><span>Interno / scala (opzionale)</span><input name="line2" autoComplete="address-line2" maxLength={120} /></label>
              <label><span>Comune</span><input name="city" autoComplete="address-level2" maxLength={80} required /></label>
              <label><span>Provincia</span><input name="province" autoComplete="address-level1" placeholder="NA" maxLength={2} required /></label>
              <label><span>CAP</span><input name="postalCode" inputMode="numeric" autoComplete="postal-code" pattern="[0-9]{5}" maxLength={5} required /></label>
              <label><span>Paese</span><input value="Italia" disabled /></label>
              <label className={styles.wide}><span>Telefono (opzionale)</span><input name="phone" type="tel" autoComplete="tel" maxLength={24} /></label>
              <button className={styles.primary} type="submit" disabled={busy}>Salva indirizzo</button>
            </form>
          ) : null}
        </section>
      </div>

      <section className={styles.panel}>
        <div className={styles.panelHeader}><p className={styles.kicker}>ORDERS</p><span>03</span></div>
        {orders.length ? (
          <div className={styles.orders}>
            {orders.map((order) => (
              <article key={order.id}>
                <strong>{order.id}</strong>
                <span>{order.status}</span>
                <span>€{(order.totals.total.amountCents / 100).toFixed(2).replace(".", ",")}</span>
                <small>{new Date(order.createdAt).toLocaleDateString("it-IT")}</small>
              </article>
            ))}
          </div>
        ) : <p className={styles.empty}>Nessun ordine. Il checkout non è ancora attivo.</p>}
      </section>

      <div className={styles.footerActions}>
        <a href="/api/account/export">Esporta i miei dati</a>
        <button type="button" disabled={busy} onClick={() => void logout()}>Esci dall&apos;account</button>
      </div>
      {feedback ? <p className={styles.feedback} aria-live="polite">{feedback}</p> : null}
    </div>
  );
}
