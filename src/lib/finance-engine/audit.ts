import "server-only";

export const financeAuditEventTypes = [
  "LOGIN",
  "V4_ACCESS",
  "FINANCE_ACCESS",
  "ANALYSIS_REQUEST",
  "SIGNAL_CREATED",
  "PAPER_ORDER",
  "TRADE_PROPOSAL",
  "ORDER_APPROVAL",
  "ORDER_REJECTION",
  "ORDER_EXECUTION",
  "STRATEGY_CHANGE"
] as const;

export type FinanceAuditEventType = (typeof financeAuditEventTypes)[number];

export type FinanceAuditEvent = {
  actorEmail: string;
  eventType: FinanceAuditEventType;
  target?: string;
  details?: Record<string, unknown>;
};
