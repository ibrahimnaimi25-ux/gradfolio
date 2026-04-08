/**
 * Single source of truth for all supported majors.
 * To add a new major: append an entry to MAJORS.
 * The `defaultSections` are suggestions shown in the UI — actual sections
 * are stored in the database and can be managed by admins.
 */
export const MAJORS = [
  {
    name: "Cybersecurity",
    defaultSections: ["Risk Assessment", "SOC / Monitoring", "Policy & Compliance"],
  },
  {
    name: "Business",
    defaultSections: ["Sales", "Operations", "Research"],
  },
  {
    name: "Marketing",
    defaultSections: ["Social Media", "Content", "Market Research"],
  },
] as const;

export type MajorName = (typeof MAJORS)[number]["name"];

/** Plain array of major name strings — use this for dropdowns */
export const MAJOR_NAMES: string[] = MAJORS.map((m) => m.name);
