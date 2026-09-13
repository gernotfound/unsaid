"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo, useState } from "react";
import type { CatalogRecord } from "@unsaid/catalog";

type Props = { initialRecords: readonly CatalogRecord[] };
type Filter = "all" | "ready" | "rimorchio" | "one-liner" | "pensiero" | "concept" | "pop" | "en";
type Sort = "archive" | "short" | "long" | "ready";

const FILTERS: readonly { id: Filter; label: string }[] = [
  { id: "all", label: "Tutte" },
  { id: "ready", label: "Render pronti" },
  { id: "rimorchio", label: "Rimorchio" },
  { id: "one-liner", label: "One-liner" },
  { id: "pensiero", label: "Pensieri" },
  { id: "concept", label: "Concept" },
  { id: "pop", label: "Pop" },
  { id: "en", label: "English" },
];

function normalize(value: string) {
  return value.toLocaleLowerCase("it").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function status(record: CatalogRecord) {
  if (record.status === "ready") return "READY";
  if (record.audience === "18+") return "18+ / CONCEPT";
  if (record.audience === "sensitive") return "SENSITIVE";
  return "CONCEPT";
}

export function CatalogClient({ initialRecords }: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("archive");
  const [showAdult, setShowAdult] = useState(false);
  const [visible, setVisible] = useState(24);

  const records = useMemo(() => {
    let items = [...initialRecords];
    if (!showAdult) items = items.filter((item) => item.audience !== "18+");
    if (filter === "ready") items = items.filter((item) => item.status === "ready");
    else if (filter === "en") items = items.filter((item) => item.language === "en" || item.language === "mix");
    else if (filter !== "all") items = items.filter((item) => item.category === filter);

    const needle = normalize(query.trim());
    if (needle) {
      items = items.filter((item) => normalize([item.id, item.title, item.phrase, item.backPhrase, item.category].filter(Boolean).join(" ")).includes(needle));
    }

    if (sort === "short") items.sort((a, b) => (a.phrase?.length ?? 9999) - (b.phrase?.length ?? 9999));
    else if (sort === "long") items.sort((a, b) => (b.phrase?.length ?? 0) - (a.phrase?.length ?? 0));
    else if (sort === "ready") items.sort((a, b) => Number(b.status === "ready") - Number(a.status === "ready") || a.id.localeCompare(b.id));
    else items.sort((a, b) => a.id.localeCompare(b.id));
    return items;
  }, [filter, initialRecords, query, showAdult, sort]);

  const shown = records.slice(0, visible);
  const adultCount = initialRecords.filter((item) => item.audience === "18+").length;

  function chooseFilter(next: Filter) {
    setFilter(next);
    setVisible(24);
  }

  if (!initialRecords.length) {
    return (
      <section className="catalog-shell" aria-labelledby="catalog-empty-heading">
        <div className="catalog-empty">
          <p className="eyebrow">ARCHIVE / 000</p>
          <strong id="catalog-empty-heading">Nothing published yet.</strong>
          <p>Il catalogo di test è stato eliminato. La prossima selezione sarà costruita soltanto sulle frasi reali UNSAID.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="catalog-shell" aria-labelledby="catalog-heading">
      <h2 className="sr-only" id="catalog-heading">Catalogo UNSAID</h2>
      <div className="catalog-tools">
        <label className="search-box">
          <span className="sr-only">Cerca una frase</span>
          <input value={query} onChange={(event) => { setQuery(event.target.value); setVisible(24); }} type="search" placeholder="Cerca frase, parola o ID…" />
          <span aria-hidden="true">⌕</span>
        </label>
        <div className="adult-control">
          <span>{adultCount} concept 18+</span>
          <button type="button" aria-pressed={showAdult} onClick={() => { setShowAdult((value) => !value); setVisible(24); }}>{showAdult ? "Nascondi 18+" : "Mostra 18+"}</button>
        </div>
      </div>

      <div className="filter-bar" aria-label="Filtra catalogo">
        <div className="filter-scroll">
          {FILTERS.map((item) => <button key={item.id} className={filter === item.id ? "active" : ""} type="button" onClick={() => chooseFilter(item.id)}>{item.label}</button>)}
        </div>
        <select aria-label="Ordina catalogo" value={sort} onChange={(event) => setSort(event.target.value as Sort)}>
          <option value="archive">Archivio</option>
          <option value="ready">Pronti prima</option>
          <option value="short">Frasi più corte</option>
          <option value="long">Frasi più lunghe</option>
        </select>
      </div>

      <p className="catalog-count" aria-live="polite">{records.length} risultati · {Math.min(shown.length, records.length)} mostrati{!showAdult ? " · 18+ nascosti" : ""}</p>

      {shown.length ? (
        <div className="product-grid">
          {shown.map((record, index) => (
            <article className={`product-card ${index % 11 === 0 ? "product-card--wide" : ""}`} key={record.id}>
              <Link className="product-media" href={`/product/${record.slug}`} aria-label={`Apri ${record.title}`}>
                {record.status === "ready" && record.images.front ? (
                  <Image src={record.images.front} alt={`T-shirt ${record.title}, vista frontale`} fill sizes="(max-width: 430px) 100vw, (max-width: 860px) 50vw, (max-width: 1200px) 33vw, 25vw" />
                ) : (
                  <div className="concept-card">
                    <span>{record.id} / {record.language.toUpperCase()}</span>
                    <strong>{record.phrase}</strong>
                    <small>{record.category} · render pending</small>
                  </div>
                )}
                <span className={`status-label status-label--${record.status}`}>{status(record)}</span>
              </Link>
              <div className="product-meta">
                <div><span>{record.id}</span><span>{record.status === "ready" && record.price ? `€${record.price},00` : "—"}</span></div>
                <h3><Link href={`/product/${record.slug}`}>{record.title}</Link></h3>
                <p>{record.category} / {record.language}</p>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state"><strong>Niente qui.</strong><p>La ricerca o i filtri non trovano risultati nell&apos;archivio pubblico.</p><button type="button" onClick={() => { setQuery(""); chooseFilter("all"); }}>Azzera filtri</button></div>
      )}

      {visible < records.length ? <div className="load-more"><button type="button" onClick={() => setVisible((value) => value + 24)}>Carica altre magliette</button></div> : null}
    </section>
  );
}
