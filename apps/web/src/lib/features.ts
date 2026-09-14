import { getLegalSettings } from "./legal";

const legal = getLegalSettings();
const shopRequested = process.env.NEXT_PUBLIC_SHOP_ENABLED === "true";

export const FEATURES = {
  shopRequested,
  legalCommerceReady: legal.commerceIdentityReady,
  shopEnabled: shopRequested && legal.commerceIdentityReady,
} as const;
