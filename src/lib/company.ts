export const COMPANY_LEGAL_NAME = "Comply-Quick, LLC";
export const COMPANY_TRADE_NAME = "Comply-Quick";
export const GOVERNING_LAW_STATE = "Louisiana";
export const VENUE_PARISH = "East Baton Rouge Parish";

export const TODO_MAILING_ADDRESS_STREET = "";
export const TODO_MAILING_ADDRESS_ZIP = "";

export const COMPANY_MAILING_ADDRESS = {
  street: TODO_MAILING_ADDRESS_STREET,
  city: "Baton Rouge",
  state: "Louisiana",
  postalCode: TODO_MAILING_ADDRESS_ZIP,
  country: "USA",
} as const;

export const SUPPORT_EMAIL = "support@comply-quick.com";
export const PRIVACY_EMAIL = SUPPORT_EMAIL;
export const LEGAL_EMAIL = SUPPORT_EMAIL;
export const DMCA_EMAIL = SUPPORT_EMAIL;
export const SECURITY_EMAIL = SUPPORT_EMAIL;

export const LEGAL_EFFECTIVE_DATE = "July 12, 2026";
export const LEGAL_VERSION = "2026-07-12";

export const GOVERNING_LAW_CLAUSE = `These terms are governed by the laws of the State of ${GOVERNING_LAW_STATE}, without regard to conflict-of-law principles.`;
export const VENUE_CLAUSE = `Subject to the arbitration provision, any permitted court proceeding must be brought exclusively in the state or federal courts located in ${VENUE_PARISH}, ${GOVERNING_LAW_STATE}.`;
