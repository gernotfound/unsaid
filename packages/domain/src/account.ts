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
