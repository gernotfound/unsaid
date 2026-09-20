"use client";

import Image from "next/image";
import { useState } from "react";
import type { CatalogView } from "@unsaid/catalog";

type Props = {
  title: string;
  front: string;
  back: string;
  initialView?: CatalogView;
};

export function ProductGallery({ title, front, back, initialView = "front" }: Props) {
  const [view, setView] = useState<CatalogView>(initialView);
  const src = view === "back" ? back : front;
  const isRemoteAsset = src.startsWith("http");

  return (
    <div className="product-gallery">
      <div className="product-gallery__stage">
        <Image
          src={src}
          alt={`T-shirt ${title}, vista ${view === "front" ? "frontale" : "posteriore"}`}
          fill
          priority
          unoptimized={isRemoteAsset}
          quality={isRemoteAsset ? undefined : 90}
          sizes="(max-width: 860px) 100vw, 58vw"
        />
      </div>
      <div className="view-tabs" role="group" aria-label="Vista prodotto">
        <button className={view === "front" ? "active" : ""} type="button" onClick={() => setView("front")}>Fronte</button>
        <button className={view === "back" ? "active" : ""} type="button" onClick={() => setView("back")}>Retro</button>
      </div>
    </div>
  );
}
