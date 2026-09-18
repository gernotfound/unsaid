import { getCheckoutConfiguration } from "./checkout";
import { getLegalSettings } from "./legal";
import { getPaymentConfiguration } from "./payment";

const legal = getLegalSettings();
const checkout = getCheckoutConfiguration();
const payment = getPaymentConfiguration();
const shopRequested = process.env.NEXT_PUBLIC_SHOP_ENABLED === "true";
const accountsRequested = process.env.NEXT_PUBLIC_ACCOUNTS_ENABLED === "true";
const returnsRequested = process.env.RETURNS_ENABLED === "true";
const returnsPolicyReady = process.env.RETURNS_POLICY_READY === "true";
const withdrawalRequested = process.env.WITHDRAWAL_ENABLED === "true";
const withdrawalPolicyReady = process.env.WITHDRAWAL_POLICY_READY === "true";
const withdrawalAcknowledgementReady = process.env.WITHDRAWAL_ACKNOWLEDGEMENT_READY === "true";
const customerAccountsEnabled = accountsRequested && legal.privacyIdentityReady;
const shopEnabled =
  shopRequested &&
  customerAccountsEnabled &&
  legal.commerceIdentityReady;

export const FEATURES = {
  accountsRequested,
  customerAccountsEnabled,
  shopRequested,
  legalCommerceReady: legal.commerceIdentityReady,
  shopEnabled,
  checkoutPreparationRequested: checkout.requested,
  checkoutConfigurationReady: checkout.ready,
  checkoutPreparationEnabled: shopEnabled && checkout.ready,
  paymentsRequested: payment.requested,
  paymentConfigurationReady: payment.ready,
  paymentEnabled: shopEnabled && checkout.ready && payment.ready,
  returnsRequested,
  returnsPolicyReady,
  returnsEnabled: customerAccountsEnabled && returnsRequested && returnsPolicyReady,
  withdrawalRequested,
  withdrawalPolicyReady,
  withdrawalAcknowledgementReady,
  withdrawalEnabled:
    customerAccountsEnabled &&
    withdrawalRequested &&
    withdrawalPolicyReady &&
    withdrawalAcknowledgementReady,
} as const;
