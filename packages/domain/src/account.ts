export type AccountStatus = "active" | "disabled" | "deleted";
export type CustomerCountry = "IT";

export interface CustomerAddress {
  id: string;
  label: string;
  recipientName: string;
  line1: string;
  line2?: string;
  city: string;
  province: string;
  postalCode: string;
  country: CustomerCountry;
  phone?: string;
}

export type CustomerAddressInput = Omit<CustomerAddress, "id">;

export interface CustomerProfile {
  uid: string;
  email: string;
  displayName?: string;
  status: AccountStatus;
  defaultShippingAddressId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthenticatedCustomer {
  uid: string;
  email: string;
  emailVerified: boolean;
}

export interface CustomerSession extends AuthenticatedCustomer {
  issuedAt: number;
  expiresAt: number;
}

export type CustomerAddressField =
  | "label"
  | "recipientName"
  | "line1"
  | "city"
  | "province"
  | "postalCode"
  | "country"
  | "phone";

export interface CustomerAddressValidationError {
  field: CustomerAddressField;
  message: string;
}

const ITALIAN_POSTAL_CODE = /^\d{5}$/;
const ITALIAN_PROVINCE_CODE = /^[A-Z]{2}$/;
const PHONE = /^[+0-9 ()-]{6,24}$/;

export function normalizeItalianAddress(input: CustomerAddressInput): CustomerAddressInput {
  const line2 = input.line2?.trim();
  const phone = input.phone?.trim();

  return {
    label: input.label.trim(),
    recipientName: input.recipientName.trim(),
    line1: input.line1.trim(),
    ...(line2 ? { line2 } : {}),
    city: input.city.trim(),
    province: input.province.trim().toUpperCase(),
    postalCode: input.postalCode.trim(),
    country: "IT",
    ...(phone ? { phone } : {}),
  };
}

export function validateItalianAddress(input: CustomerAddressInput): readonly CustomerAddressValidationError[] {
  const value = normalizeItalianAddress(input);
  const errors: CustomerAddressValidationError[] = [];

  if (value.label.length < 1 || value.label.length > 40) {
    errors.push({ field: "label", message: "Etichetta obbligatoria (massimo 40 caratteri)." });
  }
  if (value.recipientName.length < 2 || value.recipientName.length > 100) {
    errors.push({ field: "recipientName", message: "Nome destinatario non valido." });
  }
  if (value.line1.length < 3 || value.line1.length > 120) {
    errors.push({ field: "line1", message: "Indirizzo non valido." });
  }
  if (value.city.length < 2 || value.city.length > 80) {
    errors.push({ field: "city", message: "Comune non valido." });
  }
  if (!ITALIAN_PROVINCE_CODE.test(value.province)) {
    errors.push({ field: "province", message: "Usa la sigla provincia di due lettere." });
  }
  if (!ITALIAN_POSTAL_CODE.test(value.postalCode)) {
    errors.push({ field: "postalCode", message: "Il CAP deve contenere 5 cifre." });
  }
  if (value.country !== "IT") {
    errors.push({ field: "country", message: "UNSAID spedisce inizialmente solo in Italia." });
  }
  if (value.phone && !PHONE.test(value.phone)) {
    errors.push({ field: "phone", message: "Numero di telefono non valido." });
  }

  return errors;
}

export function isValidItalianAddress(input: CustomerAddressInput) {
  return validateItalianAddress(input).length === 0;
}
