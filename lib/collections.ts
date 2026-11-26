/**
 * Firestore collection paths used by the dashboard tabs. Kept in one place so
 * the assistant's allow/deny lists and the tabs themselves never disagree.
 */
export const COLLECTIONS = {
  meetings: "CanaryMeetings",
  messages: "CanaryMessages",
  treasuryProjects: "TreasuryProjects",
  treasuryIncome: "TreasuryIncome",
  treasurySpendings: "TreasurySpendings",
  treasuryAccounts: "TreasuryAccounts",
  treasuryReceipts: "TreasuryReceipts",
} as const;
