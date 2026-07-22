/**
 * Filter Field Registry — whitelist of fields that can be used in filters.
 * Used by FilterBuilder UI, fanboxFilterService, and table column filters.
 *
 * Each entry:
 *   field        – dot-path on FanProfile (or related model)
 *   label        – human display name
 *   type         – 'string' | 'number' | 'boolean' | 'enum' | 'date'
 *   operators    – allowed operators (defaults from type)
 *   valueSource  – { options: [{value, label}] } for enum fields, or null
 *   department   – which module this field belongs to
 *   industry     – ['football_club'] (extensible)
 */

export const FILTER_FIELDS = [
  // ── Fan profile ──────────────────────────────────────────────────────────
  { field: "fullName", label: "Full Name", type: "string", department: "fans", industry: ["football_club"] },
  { field: "email", label: "Email", type: "string", department: "fans", industry: ["football_club"] },
  { field: "phone", label: "Phone", type: "string", department: "fans", industry: ["football_club"] },
  { field: "cpf", label: "CPF", type: "string", department: "fans", industry: ["football_club"] },
  { field: "passport", label: "Passport", type: "string", department: "fans", industry: ["football_club"] },
  { field: "isForeigner", label: "Is Foreigner", type: "boolean", department: "fans", industry: ["football_club"] },
  { field: "status", label: "Profile Status", type: "enum", department: "fans", industry: ["football_club"],
    valueSource: { options: [{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }, { value: "lead", label: "Lead" }] } },
  { field: "gender", label: "Gender", type: "enum", department: "fans", industry: ["football_club"],
    valueSource: { options: [{ value: "male", label: "Male" }, { value: "female", label: "Female" }, { value: "other", label: "Other" }, { value: "unknown", label: "Unknown" }] } },
  { field: "birthDate", label: "Birth Date", type: "date", department: "fans", industry: ["football_club"] },
  { field: "ageRange", label: "Age Range", type: "string", department: "fans", industry: ["football_club"] },
  { field: "hasChildren", label: "Has Children", type: "enum", department: "fans", industry: ["football_club"],
    valueSource: { options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }, { value: "unknown", label: "Unknown" }] } },
  { field: "householdIncomeBand", label: "Income Band", type: "string", department: "fans", industry: ["football_club"] },
  { field: "address.city", label: "City", type: "string", department: "fans", industry: ["football_club"] },
  { field: "address.state", label: "State", type: "string", department: "fans", industry: ["football_club"] },
  { field: "address.country", label: "Country", type: "string", department: "fans", industry: ["football_club"] },
  { field: "biometricRegistered", label: "Biometric Registered", type: "boolean", department: "fans", industry: ["football_club"] },
  { field: "sportsBetting", label: "Sports Betting", type: "boolean", department: "fans", industry: ["football_club"] },
  { field: "preferredSocialNetwork", label: "Preferred Social Network", type: "string", department: "fans", industry: ["football_club"] },
  { field: "primaryInteractionChannels", label: "Interaction Channel", type: "string", operators: ["contains", "eq"], department: "fans", industry: ["football_club"] },
  { field: "createdAt", label: "Registration Date", type: "date", department: "fans", industry: ["football_club"] },

  // ── Membership ────────────────────────────────────────────────────────────
  { field: "membership.status", label: "Membership Status", type: "enum", department: "membership", industry: ["football_club"],
    valueSource: { options: [{ value: "active", label: "Active" }, { value: "overdue", label: "Overdue" }, { value: "cancelled", label: "Cancelled" }, { value: "suspended", label: "Suspended" }] } },
  { field: "membership.planCode", label: "Membership Plan", type: "string", department: "membership", industry: ["football_club"] },
  { field: "membership.billingCycle", label: "Billing Cycle", type: "enum", department: "membership", industry: ["football_club"],
    valueSource: { options: [{ value: "monthly", label: "Monthly" }, { value: "annual", label: "Annual" }] } },
  { field: "membership.tenureMonths", label: "Tenure (months)", type: "number", department: "membership", industry: ["football_club"] },
  { field: "membership.sectorCode", label: "Stadium Sector", type: "string", department: "membership", industry: ["football_club"] },

  // ── Tickets ───────────────────────────────────────────────────────────────
  { field: "ticket.type", label: "Ticket Type", type: "string", department: "tickets", industry: ["football_club"] },
  { field: "ticket.isLongTermHolder", label: "Long-Term Ticket Holder", type: "boolean", department: "tickets", industry: ["football_club"] },
  { field: "ticket.status", label: "Ticket Status", type: "enum", department: "tickets", industry: ["football_club"],
    valueSource: { options: [{ value: "issued", label: "Issued" }, { value: "used", label: "Used" }, { value: "cancelled", label: "Cancelled" }] } },

  // ── Spend ─────────────────────────────────────────────────────────────────
  { field: "spend.last30DaysCents", label: "Spend Last 30 Days", type: "number", department: "fans", industry: ["football_club"] },
  { field: "spend.last365DaysCents", label: "Spend Last 12 Months", type: "number", department: "fans", industry: ["football_club"] },
  { field: "spend.visitFrequencyPerMatch", label: "Visit Frequency / Match", type: "number", department: "fans", industry: ["football_club"] },

  // ── Labels (WS12) ─────────────────────────────────────────────────────────
  { field: "labels", label: "Label", type: "string", operators: ["contains", "eq", "in"], department: "labels", industry: ["football_club"] },
];

/** Validate a rule field against the whitelist */
export function isAllowedField(fieldPath) {
  return FILTER_FIELDS.some((f) => f.field === fieldPath);
}

/** Get filter fields for a department */
export function getFilterFieldsByDepartment(department) {
  return FILTER_FIELDS.filter((f) => !department || f.department === department);
}

/** Get filter fields for an industry profile */
export function getFilterFieldsByIndustry(industry) {
  return FILTER_FIELDS.filter((f) => f.industry.includes(industry));
}

export default FILTER_FIELDS;
