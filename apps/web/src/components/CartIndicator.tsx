"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CART_UPDATED_EVENT, cartQuantity, readCart } from "../lib/cart";

export function CartIndicator({ className }: { className?: string }) {
  const [quantity, setQuantity] = useState(0);

  useEffect(() => {
    const sync = () => setQuantity(cartQuantity(readCart()));
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener(CART_UPDATED_EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(CART_UPDATED_EVENT, sync);
    };
  }, []);

  return <Link className={className} href="/cart" aria-label={`Carrello, ${quantity} articoli`}>CART / {quantity}</Link>;
}
