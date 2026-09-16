import { getCheckoutConfiguration } from "./checkout";
import { getLegalSettings } from "./legal";
import { getPaymentConfiguration } from "./payment";

const legal = getLegalSettings();
const checkout = getCheckoutConfiguration();
const payment = getPaymentConfiguration();
const shopRequested = process.env.NEXT_PUBLIC_SHOP_ENABLED === "true";
const accountsRequested = process.env.NEXT_PUBLIC_ACCOUNTS_ENABLED === "true";
const shopEnabled =
  shopRequested &&
  accountsRequested &&
  legal.privacyIdentityReady &&
  legal.commerceIdentityReady;

export const FEATURES = {
  accountsRequested,
  customerAccountsEnabled: accountsRequested && legal.privacyIdentityReady,
  shopRequested,
  legalCommerceReady: legal.commerceIdentityReady,
  shopEnabled,
  checkoutPreparationRequested: checkout.requested,
  checkoutConfigurationReady: checkout.ready,
  checkoutPreparationEnabled: shopEnabled && checkout.ready,
  paymentsRequested: payment.requested,
  paymentConfigurationReady: payment.ready,
  paymentEnabled: shopEnabled && checkout.ready && payment.ready,
} as const;
