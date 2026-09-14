export interface LegalSettings {
  controllerName: string;
  tradingName: string;
  contactEmail: string;
  registeredAddress: string;
  vatNumber: string;
  fiscalCode: string;
  rea: string;
  pec: string;
  dpoEmail: string;
  country: string;
  privacyIdentityReady: boolean;
  commerceIdentityReady: boolean;
  analyticsConsentEnabled: boolean;
}

function env(name: string) {
  return process.env[name]?.trim() ?? "";
}

export function getLegalSettings(): LegalSettings {
  const controllerName = env("LEGAL_CONTROLLER_NAME");
  const tradingName = env("LEGAL_TRADING_NAME") || "UNSAID";
  const contactEmail = env("LEGAL_CONTACT_EMAIL");
  const registeredAddress = env("LEGAL_REGISTERED_ADDRESS");
  const vatNumber = env("LEGAL_VAT_NUMBER");
  const fiscalCode = env("LEGAL_FISCAL_CODE");
  const rea = env("LEGAL_REA");
  const pec = env("LEGAL_PEC");
  const dpoEmail = env("LEGAL_DPO_EMAIL");
  const country = env("LEGAL_COUNTRY") || "Italia";

  const privacyIdentityReady = Boolean(controllerName && contactEmail);
  const commerceIdentityReady = Boolean(
    privacyIdentityReady &&
      registeredAddress &&
      vatNumber &&
      process.env.LEGAL_COMMERCE_READY === "true",
  );

  return {
    controllerName,
    tradingName,
    contactEmail,
    registeredAddress,
    vatNumber,
    fiscalCode,
    rea,
    pec,
    dpoEmail,
    country,
    privacyIdentityReady,
    commerceIdentityReady,
    analyticsConsentEnabled:
      privacyIdentityReady && Boolean(process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID),
  };
}

export function publicLegalValue(value: string) {
  return value || "Da configurare prima del lancio";
}
