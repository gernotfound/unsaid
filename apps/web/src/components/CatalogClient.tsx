"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { primaryAsset, primaryCopy, type CatalogRecord } from "@unsaid/catalog";

type Props = { initialRecords: readonly CatalogRecord[] };
type Sort = "archive" | "newest" | "short" | "long";

function normalize(value: string) {
  return value.toLocaleLowerCase("it").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function phraseLength(record: CatalogRecord) {
  return (record.copy.front?.length ?? 0) + (record.copy.back?.length ?? 0);
}

function badge(record: CatalogRecord) {
  if (record.audience === "18+") return "18+";
  if (record.audience === "sensitive") return "SENSITIVE";
  return record.primaryView === "back" ? "BACK PRINT" : "FRONT / BACK";
}

export function CatalogClient({ initialRecords }: Props) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState<Sort>("archive");
  const [showAdult, setShowAdult] = useState(false);
  const [visible, setVisible] = useState(24);

  const categories = useMemo(
    () => Array.from(new Set(initialRecords.map((record) => record.category).filter(Boolean))).sort((a, b) => a.localeCompare(b, "it")),
    [initialRecords],
  );

  const records = useMemo(() => {
    let items = [...initialRecords];
    if (!showAdult) items = items.filter((item) => item.audience !== "18+");
    if (category !== "all") items = items.filter((item) => item.category === category);

    const needle = normalize(query.trim());
    if (needle) {
      items = items.filter((item) => normalize([
        item.id,
        item.title,
        item.copy.front,
        item.copy.back,
        item.category,
      ].filter(Boolean).join(" ")).includes(needle));
    }

    if (sort === "short") items.sort((a, b) => phraseLength(a) - phraseLength(b));
    else if (sort === "long") items.sort((a, b) => phraseLength(b) - phraseLength(a));
    else if (sort === "newest") items.sort((a, b) => b.sequence - a.sequence);
    else items.sort((a, b) => a.sequence - b.sequence);
    return items;
  }, [category, initialRecords, query, showAdult, sort]);

  if (!initialRecords.length) {
    return (
      <section className="catalog-shell" aria-labelledby="catalog-empty-heading">
        <div className="catalog-empty">
          <p className="eyebrow">ARCHIVE / 000</p>
          <strong id="catalog-empty-heading">Nothing published yet.</strong>
          <p>L&apos;archivio pubblico non contiene ancora maglie pubblicate.</p>
        </div>
      </section>
    );
  }

  const shown = records.slice(0, visible);
  const adultCount = initialRecords.filter((item) => item.audience === "18+").length;

  return (
    <section className="catalog-shell" aria-labelledby="catalog-heading">
      <h2 className="sr-only" id="catalog-heading">Catalogo UNSAID</h2>
      <div className="catalog-tools">
        <label className="search-box">
          <span className="sr-only">Cerca una frase</span>
          <input value={query} onChange={(event) => { setQuery(event.target.value); setVisible(24); }} type="search" placeholder="Cerca frase, parola o ID…" />
          <span aria-hidden="true">⌕</span>
        </label>
        {adultCount ? (
          <div className="adult-control">
            <span>{adultCount} prodotto 18+</span>
            <button type="button" aria-pressed={showAdult} onClick={() => { setShowAdult((value) => !value); setVisible(24); }}>{showAdult ? "Nascondi 18+" : "Mostra 18+"}</button>
          </div>
        ) : null}
      </div>

      <div className="filter-bar" aria-label="Filtra catalogo">
        <div className="filter-scroll">
          <button className={category === "all" ? "active" : ""} type="button" onClick={() => { setCategory("all"); setVisible(24); }}>Tutte</button>
          {categories.map((item) => <button key={item} className={category === item ? "active" : ""} type="button" onClick={() => { setCategory(item); setVisible(24); }}>{item}</button>)}
        </div>
        <select aria-label="Ordina catalogo" value={sort} onChange={(event) => setSort(event.target.value as Sort)}>
          <option value="archive">Archivio</option>
          <option value="newest">Più recenti</option>
          <option value="short">Frasi più corte</option>
          <option value="long">Frasi più lunghe</option>
        </select>
      </div>

      <p className="catalog-count" aria-live="polite">{records.length} risultati · {Math.min(shown.length, records.length)} mostrati{adultCount && !showAdult ? " · 18+ nascosti" : ""}</p>

      {shown.length ? (
        <div className="product-grid">
          {shown.map((record, index) => {
            const asset = primaryAsset(record);
            return (
              <article className={`product-card ${index % 11 === 0 ? "product-card--wide" : ""}`} key={record.id}>
                <Link className="product-media" href={`/product/${record.slug}`} aria-label={`Apri ${record.title}`}>
                  {asset ? (
                    <Image
                      src={asset}
                      alt={`T-shirt ${record.title}, vista ${record.primaryView}`}
                      fill
                      unoptimized={asset.startsWith("http")}
                      sizes="(max-width: 430px) 100vw, (max-width: 860px) 50vw, (max-width: 1200px) 33vw, 25vw"
                    />
                  ) : (
                    <div className="concept-card"><span>{record.id}</span><strong>{primaryCopy(record)}</strong><small>media unavailable</small></div>
                  )}
                  <span className="status-label status-label--ready">{badge(record)}</span>
                </Link>
                <div className="product-meta">
                  <div><span>{record.id}</span><span>{record.priceCents != null ? `€${(record.priceCents / 100).toFixed(2).replace(".", ",")}` : "—"}</span></div>
                  <h3><Link href={`/product/${record.slug}`}>{record.title}</Link></h3>
                  <p>{record.category} / {record.language} / {record.primaryView}</p>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty-state"><strong>Niente qui.</strong><p>La ricerca o i filtri non trovano risultati nell&apos;archivio pubblico.</p><button type="button" onClick={() => { setQuery(""); setCategory("all"); }}>Azzera filtri</button></div>
      )}

      {visible < records.length ? <div className="load-more"><button type="button" onClick={() => setVisible((value) => value + 24)}>Carica altre magliette</button></div> : null}
    </section>
  );
}
