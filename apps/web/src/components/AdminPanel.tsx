"use client";

import { useEffect, useMemo, useState } from "react";
import type { CatalogRecord } from "@unsaid/catalog";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import {
  collection,
  doc,
  getDocs,
  getFirestore,
  orderBy,
  query,
  writeBatch,
} from "firebase/firestore";
import { getFirebaseClientApp, isFirebaseClientConfigured } from "../lib/firebaseClient";
import styles from "./AdminPanel.module.css";

type Props = {
  seedRecords: readonly CatalogRecord[];
};

type Session = {
  uid: string;
  email: string | null;
};

type ConnectionState = "booting" | "ready" | "locked" | "error";

function messageFromError(error: unknown) {
  const code = typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code ?? "")
    : "";

  if (code.includes("auth/operation-not-allowed")) return "Abilita Email/Password in Firebase Authentication.";
  if (code.includes("auth/invalid-credential")) return "Email o password non corretti.";
  if (code.includes("permission-denied")) return "Accesso Firestore ancora bloccato dalle regole. Copia il tuo UID e autorizzalo prima di modificare l'archivio.";
  if (error instanceof Error) return error.message;
  return "Operazione non riuscita.";
}

function slugify(value: string) {
  return value
    .toLocaleLowerCase("it")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

function nextId(records: readonly CatalogRecord[]) {
  const highest = records.reduce((max, record) => {
    const parsed = Number.parseInt(record.id.replace(/\D/g, ""), 10);
    return Number.isFinite(parsed) ? Math.max(max, parsed) : max;
  }, 0);
  return `UNS-${String(highest + 1).padStart(4, "0")}`;
}

function blankRecord(records: readonly CatalogRecord[]): CatalogRecord {
  return {
    id: nextId(records),
    legacyId: "",
    slug: "",
    title: "",
    phrase: null,
    backPhrase: null,
    language: "it",
    category: "general",
    audience: "general",
    price: null,
    status: "concept",
    publishable: false,
    images: { front: null, back: null },
    views: ["front"],
    fit: "oversize",
    color: "da definire",
    notes: "",
  };
}

function catalogStats(records: readonly CatalogRecord[]) {
  return {
    total: records.length,
    public: records.filter((record) => record.publishable).length,
    ready: records.filter((record) => record.status === "ready").length,
    concepts: records.filter((record) => record.status === "concept").length,
    review: records.filter((record) => record.status === "review").length,
    adult: records.filter((record) => record.audience === "18+").length,
    schemaVersion: 2,
  };
}

function phraseDocument(record: CatalogRecord) {
  return {
    id: record.id,
    legacyId: record.legacyId,
    frontText: record.phrase,
    backText: record.backPhrase,
    language: record.language,
    category: record.category,
    audience: record.audience,
    editorialStatus: record.status === "review" ? "needs_review" : "approved",
    publishable: record.publishable,
    notes: record.notes,
    schemaVersion: 2,
  };
}

function productDocument(record: CatalogRecord) {
  return {
    id: record.id,
    phraseId: record.id,
    slug: record.slug,
    title: record.title,
    price: record.price,
    status: record.status,
    publishable: record.publishable,
    fit: record.fit,
    color: record.color,
    views: record.views,
    images: record.images,
    schemaVersion: 2,
  };
}

export function AdminPanel({ seedRecords }: Props) {
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [records, setRecords] = useState<CatalogRecord[]>([]);
  const [draft, setDraft] = useState<CatalogRecord | null>(null);
  const [creating, setCreating] = useState(false);
  const [queryText, setQueryText] = useState("");
  const [connection, setConnection] = useState<ConnectionState>("booting");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const configured = isFirebaseClientConfigured();

  async function loadCatalog() {
    if (!configured) return;
    setConnection("booting");
    setNotice("");

    try {
      const db = getFirestore(getFirebaseClientApp());
      const snapshot = await getDocs(query(collection(db, "catalog"), orderBy("id", "asc")));
      const loaded = snapshot.docs.map((item) => item.data() as CatalogRecord);
      setRecords(loaded);
      setDraft(loaded[0] ?? null);
      setCreating(false);
      setConnection("ready");
    } catch (error) {
      const message = messageFromError(error);
      setRecords([]);
      setDraft(null);
      setConnection(message.includes("bloccato") ? "locked" : "error");
      setNotice(message);
    }
  }

  useEffect(() => {
    document.body.classList.add("admin-mode");
    if (!configured) {
      setConnection("error");
      return () => document.body.classList.remove("admin-mode");
    }

    const auth = getAuth(getFirebaseClientApp());
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setSession(null);
        setRecords([]);
        setDraft(null);
        setConnection("ready");
        return;
      }

      setSession({ uid: user.uid, email: user.email });
      void loadCatalog();
    });

    return () => {
      unsubscribe();
      document.body.classList.remove("admin-mode");
    };
    // Firebase configuration is static for the lifetime of the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configured]);

  const filtered = useMemo(() => {
    const needle = queryText.trim().toLocaleLowerCase("it");
    if (!needle) return records;
    return records.filter((record) =>
      [record.id, record.title, record.phrase, record.backPhrase, record.category]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("it")
        .includes(needle),
    );
  }, [queryText, records]);

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!configured) return;
    setBusy(true);
    setNotice("");
    try {
      await signInWithEmailAndPassword(getAuth(getFirebaseClientApp()), email.trim(), password);
      setPassword("");
    } catch (error) {
      setNotice(messageFromError(error));
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    if (!configured) return;
    await signOut(getAuth(getFirebaseClientApp()));
  }

  function updateDraft<K extends keyof CatalogRecord>(key: K, value: CatalogRecord[K]) {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  }

  function selectRecord(record: CatalogRecord) {
    setDraft(record);
    setCreating(false);
    setNotice("");
  }

  function startNewRecord() {
    setDraft(blankRecord(records));
    setCreating(true);
    setNotice("");
  }

  async function saveDraft() {
    if (!draft || !session || connection !== "ready") return;
    const frontText = draft.phrase?.trim() ?? "";
    if (!frontText) {
      setNotice("Inserisci almeno la frase frontale prima di salvare.");
      return;
    }

    const slug = draft.slug || slugify(frontText || draft.title);
    const title = draft.title.trim() || frontText.slice(0, 96);
    if (!slug) {
      setNotice("Non riesco a generare uno slug valido da questa frase.");
      return;
    }

    const record: CatalogRecord = { ...draft, slug, title, phrase: frontText };
    const merged = records.some((item) => item.id === record.id)
      ? records.map((item) => (item.id === record.id ? record : item))
      : [...records, record].sort((a, b) => a.id.localeCompare(b.id));

    setBusy(true);
    setNotice("");
    try {
      const db = getFirestore(getFirebaseClientApp());
      const batch = writeBatch(db);
      batch.set(doc(db, "phrases", record.id), phraseDocument(record));
      batch.set(doc(db, "products", record.id), productDocument(record));
      batch.set(doc(db, "catalog", record.id), {
        ...record,
        schemaVersion: 2,
        updatedAt: new Date().toISOString(),
      });
      batch.set(doc(db, "meta", "catalogStats"), catalogStats(merged));
      await batch.commit();
      setRecords(merged);
      setDraft(record);
      setCreating(false);
      setNotice(`${record.id} salvato.`);
    } catch (error) {
      setNotice(messageFromError(error));
    } finally {
      setBusy(false);
    }
  }

  async function importSeed() {
    if (!session || connection !== "ready" || !seedRecords.length) return;
    setBusy(true);
    setNotice("");

    try {
      const db = getFirestore(getFirebaseClientApp());
      const chunks: CatalogRecord[][] = [];
      for (let index = 0; index < seedRecords.length; index += 100) {
        chunks.push([...seedRecords.slice(index, index + 100)]);
      }

      for (const chunk of chunks) {
        const batch = writeBatch(db);
        for (const record of chunk) {
          batch.set(doc(db, "phrases", record.id), phraseDocument(record));
          batch.set(doc(db, "products", record.id), productDocument(record));
          batch.set(doc(db, "catalog", record.id), { ...record, schemaVersion: 2 });
        }
        await batch.commit();
      }

      const meta = writeBatch(db);
      meta.set(doc(db, "meta", "catalogStats"), catalogStats(seedRecords));
      await meta.commit();
      setNotice(`${seedRecords.length} record importati.`);
      await loadCatalog();
    } catch (error) {
      setNotice(messageFromError(error));
    } finally {
      setBusy(false);
    }
  }

  if (!configured) {
    return (
      <section className={styles.loginShell}>
        <div className={styles.loginCard}>
          <p className={styles.kicker}>UNSAID / CONTROL ROOM</p>
          <h1>Firebase non configurato.</h1>
          <p>La web app Firebase deve essere disponibile nelle variabili pubbliche prima di aprire il pannello.</p>
        </div>
      </section>
    );
  }

  if (!session) {
    return (
      <section className={styles.loginShell}>
        <form className={styles.loginCard} onSubmit={login}>
          <p className={styles.kicker}>UNSAID / CONTROL ROOM</p>
          <h1>Admin.</h1>
          <p>Accesso riservato. Usa l&apos;account creato in Firebase Authentication.</p>
          <label>
            <span>Email</span>
            <input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label>
            <span>Password</span>
            <input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </label>
          <button type="submit" disabled={busy}>{busy ? "Accesso…" : "Accedi"}</button>
          {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
        </form>
      </section>
    );
  }

  return (
    <section className={styles.shell}>
      <header className={styles.topbar}>
        <div>
          <p className={styles.kicker}>UNSAID / CONTROL ROOM</p>
          <strong>Archive admin</strong>
        </div>
        <div className={styles.session}>
          <span>{session.email ?? "Firebase user"}</span>
          <button type="button" onClick={() => void logout()}>Esci</button>
        </div>
      </header>

      {connection === "locked" ? (
        <div className={styles.locked}>
          <div>
            <p className={styles.kicker}>FIRESTORE / LOCKED</p>
            <h1>Account autenticato.</h1>
            <p>Ora serve autorizzare questo account nelle regole Firestore. Il tuo UID è:</p>
            <code>{session.uid}</code>
          </div>
          <button type="button" onClick={() => void navigator.clipboard?.writeText(session.uid)}>Copia UID</button>
          {notice ? <p className={styles.notice}>{notice}</p> : null}
        </div>
      ) : null}

      {connection === "error" ? <p className={styles.globalNotice}>{notice || "Errore di connessione a Firestore."}</p> : null}

      {connection === "ready" ? (
        <div className={styles.workspace}>
          <aside className={styles.sidebar}>
            <div className={styles.sidebarHead}>
              <div><strong>{records.length}</strong><span>records</span></div>
              <button type="button" onClick={startNewRecord}>Nuovo</button>
            </div>
            <label className={styles.search}>
              <span className="sr-only">Cerca archivio</span>
              <input type="search" placeholder="Cerca ID o frase…" value={queryText} onChange={(event) => setQueryText(event.target.value)} />
            </label>
            <div className={styles.recordList}>
              {filtered.map((record) => (
                <button
                  type="button"
                  key={record.id}
                  className={draft?.id === record.id && !creating ? styles.activeRecord : undefined}
                  onClick={() => selectRecord(record)}
                >
                  <span>{record.id} / {record.status}</span>
                  <strong>{record.phrase || record.title}</strong>
                </button>
              ))}
              {!records.length ? (
                <div className={styles.emptyList}>
                  <strong>Archivio vuoto.</strong>
                  <p>Il catalogo di test è stato rimosso. Qui compariranno le frasi reali.</p>
                  {seedRecords.length ? <button type="button" disabled={busy} onClick={() => void importSeed()}>Importa archivio locale</button> : null}
                </div>
              ) : null}
            </div>
          </aside>

          <div className={styles.editor}>
            {draft ? (
              <>
                <div className={styles.editorHead}>
                  <div>
                    <p className={styles.kicker}>{creating ? "NEW RECORD" : `${draft.id} / ${draft.status}`}</p>
                    <h1>{draft.title || draft.phrase || "Nuova frase"}</h1>
                  </div>
                  <button type="button" className={styles.save} disabled={busy} onClick={() => void saveDraft()}>{busy ? "Salvataggio…" : "Salva"}</button>
                </div>

                <div className={styles.formGrid}>
                  <label className={styles.full}><span>Frase fronte</span><textarea rows={4} value={draft.phrase ?? ""} onChange={(event) => updateDraft("phrase", event.target.value || null)} /></label>
                  <label className={styles.full}><span>Frase retro</span><textarea rows={3} value={draft.backPhrase ?? ""} onChange={(event) => updateDraft("backPhrase", event.target.value || null)} /></label>
                  <label><span>Titolo</span><input value={draft.title} onChange={(event) => updateDraft("title", event.target.value)} /></label>
                  <label><span>ID</span><input value={draft.id} readOnly /></label>
                  <label><span>Slug</span><input value={draft.slug || (creating ? "generato al salvataggio" : "")} readOnly /></label>
                  <label><span>Categoria</span><input value={draft.category} onChange={(event) => updateDraft("category", event.target.value)} /></label>
                  <label><span>Lingua</span><select value={draft.language} onChange={(event) => updateDraft("language", event.target.value as CatalogRecord["language"])}><option value="it">Italiano</option><option value="en">English</option><option value="mix">Mix</option></select></label>
                  <label><span>Audience</span><select value={draft.audience} onChange={(event) => updateDraft("audience", event.target.value as CatalogRecord["audience"])}><option value="general">General</option><option value="18+">18+</option><option value="sensitive">Sensitive</option><option value="review">Review</option></select></label>
                  <label><span>Stato</span><select value={draft.status} onChange={(event) => updateDraft("status", event.target.value as CatalogRecord["status"])}><option value="concept">Concept</option><option value="ready">Ready</option><option value="review">Review</option></select></label>
                  <label><span>Prezzo €</span><input inputMode="decimal" value={draft.price ?? ""} onChange={(event) => updateDraft("price", event.target.value ? Number(event.target.value.replace(",", ".")) : null)} /></label>
                  <label><span>Fit</span><input value={draft.fit} onChange={(event) => updateDraft("fit", event.target.value)} /></label>
                  <label><span>Colore</span><input value={draft.color} onChange={(event) => updateDraft("color", event.target.value)} /></label>
                  <label className={styles.full}><span>Immagine fronte</span><input value={draft.images.front ?? ""} onChange={(event) => updateDraft("images", { ...draft.images, front: event.target.value || null })} /></label>
                  <label className={styles.full}><span>Immagine retro</span><input value={draft.images.back ?? ""} onChange={(event) => updateDraft("images", { ...draft.images, back: event.target.value || null })} /></label>
                  <label className={styles.full}><span>Note</span><textarea rows={3} value={draft.notes} onChange={(event) => updateDraft("notes", event.target.value)} /></label>
                  <label className={styles.check}><input type="checkbox" checked={draft.publishable} onChange={(event) => updateDraft("publishable", event.target.checked)} /><span>Pubblicabile nel catalogo</span></label>
                </div>
                {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
              </>
            ) : (
              <div className={styles.blankEditor}>
                <p className={styles.kicker}>ARCHIVE / EMPTY</p>
                <h1>Nessuna maglia ancora.</h1>
                <p>Il vecchio archivio di test è stato eliminato. Quando arriveranno le frasi reali, questo pannello diventerà la loro fonte editoriale.</p>
                <button type="button" onClick={startNewRecord}>Crea il primo record</button>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
