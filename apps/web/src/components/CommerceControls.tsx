"use client";

import { useState } from "react";
import { addCartLine, type CartSize } from "../lib/cart";
import styles from "./CommerceControls.module.css";

const SIZES: readonly CartSize[] = ["XS", "S", "M", "L", "XL", "XXL"];

type Props = {
  productId: string;
  slug: string;
  title: string;
  price: number;
  shopEnabled: boolean;
};

export function CommerceControls({ productId, slug, title, price, shopEnabled }: Props) {
  const [size, setSize] = useState<CartSize | null>(null);
  const [feedback, setFeedback] = useState("");

  function addToCart() {
    if (!shopEnabled || !size) return;
    addCartLine({
      productId,
      slug,
      title,
      size,
      quantity: 1,
      unitPrice: price,
    });
    setFeedback(`${size} aggiunta al carrello`);
  }

  return (
    <div className={styles.commerce} data-shop-enabled={shopEnabled ? "true" : "false"}>
      <p className={styles.label}>Taglia</p>
      <div className={styles.sizes} role="group" aria-label="Seleziona taglia">
        {SIZES.map((item) => (
          <button
            className={styles.size}
            data-selected={size === item ? "true" : "false"}
            key={item}
            type="button"
            aria-pressed={size === item}
            onClick={() => {
              setSize(item);
              setFeedback("");
            }}
          >
            {item}
          </button>
        ))}
      </div>
      <button
        className={styles.add}
        type="button"
        disabled={!shopEnabled || !size}
        onClick={addToCart}
      >
        {shopEnabled ? (size ? "Aggiungi al carrello" : "Seleziona una taglia") : "Shop opening soon"}
      </button>
      <p className={styles.note}>
        {shopEnabled
          ? "Il carrello è attivo. Checkout e pagamenti restano separati dalla UI."
          : "Puoi già provare la selezione taglia; acquisto e checkout sono disattivati tramite feature flag."}
      </p>
      {feedback ? <p className={styles.feedback} aria-live="polite">{feedback}</p> : null}
    </div>
  );
}
