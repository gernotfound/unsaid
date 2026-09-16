export type TransactionalEmailKind = "order_confirmation" | "shipment_confirmation";

export interface TransactionalEmailPayload {
  kind: TransactionalEmailKind;
  orderId: string;
  toEmail: string;
  totalCents: number;
  currency: "EUR";
  shipment?: {
    provider: string;
    trackingCode?: string;
    trackingUrl?: string;
  };
}

export interface EmailEnvelope {
  to: string;
  subject: string;
  text: string;
}

export interface EmailProvider {
  send(message: EmailEnvelope, idempotencyKey: string): Promise<{ providerMessageId: string }>;
}

function euros(cents: number) {
  if (!Number.isInteger(cents) || cents < 0) throw new Error("INVALID_EMAIL_TOTAL");
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(cents / 100);
}

export function renderTransactionalEmail(input: TransactionalEmailPayload): EmailEnvelope {
  if (input.kind === "order_confirmation") {
    return {
      to: input.toEmail,
      subject: `UNSAID / ordine ${input.orderId} confermato`,
      text: [
        `Ordine ${input.orderId} confermato.`,
        `Totale: ${euros(input.totalCents)}.`,
        "Puoi controllare lo stato dell'ordine dal tuo account UNSAID.",
      ].join("\n\n"),
    };
  }

  if (!input.shipment) throw new Error("SHIPMENT_EMAIL_REQUIRES_SHIPMENT");
  return {
    to: input.toEmail,
    subject: `UNSAID / ordine ${input.orderId} spedito`,
    text: [
      `Il tuo ordine ${input.orderId} è stato spedito con ${input.shipment.provider}.`,
      input.shipment.trackingCode ? `Tracking: ${input.shipment.trackingCode}.` : "",
      input.shipment.trackingUrl ? `Segui la spedizione: ${input.shipment.trackingUrl}` : "",
      "Lo stato aggiornato è disponibile anche nel tuo account UNSAID.",
    ].filter(Boolean).join("\n\n"),
  };
}
