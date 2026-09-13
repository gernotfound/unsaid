"use client";

import Image from "next/image";
import { useState } from "react";

type Props = {
  title: string;
  front: string;
  back?: string | null;
};

export function ProductGallery({ title, front, back }: Props) {
  const [view, setView] = useState<"front" | "back">("front");
  const src = view === "back" && back ? back : front;

  return (
    <div className="product-gallery">
      <div className="product-gallery__stage">
        <Image src={src} alt={`T-shirt ${title}, vista ${view === "front" ? "frontale" : "posteriore"}`} fill priority sizes="(max-width: 860px) 100vw, 58vw" />
      </div>
      <div className="view-tabs" role="group" aria-label="Vista prodotto">
        <button className={view === "front" ? "active" : ""} type="button" onClick={() => setView("front")}>Fronte</button>
        <button className={view === "back" ? "active" : ""} type="button" disabled={!back} onClick={() => setView("back")}>Retro</button>
      </div>
    </div>
  );
}
