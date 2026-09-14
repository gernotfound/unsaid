import { getLegalSettings } from "./legal";

const legal = getLegalSettings();
const shopRequested = process.env.NEXT_PUBLIC_SHOP_ENABLED === "true";
const accountsRequested = process.env.NEXT_PUBLIC_ACCOUNTS_ENABLED === "true";

export const FEATURES = {
  accountsRequested,
  customerAccountsEnabled: accountsRequested && legal.privacyIdentityReady,
  shopRequested,
  legalCommerceReady: legal.commerceIdentityReady,
  shopEnabled:
    shopRequested &&
    accountsRequested &&
    legal.privacyIdentityReady &&
    legal.commerceIdentityReady,
} as const;
