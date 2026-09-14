import { preferenceConfig } from "./config";

export function recencyDecay(occurredAt: string, asOf: string) {
  const ageDays = Math.max(0, (Date.parse(asOf) - Date.parse(occurredAt)) / 86_400_000);
  return Math.pow(2, -ageDays / preferenceConfig.halfLifeDays);
}
export function affinityScore(rawScore: number) {
  return Math.max(0, Math.min(100, 50 + 50 * Math.tanh(rawScore / preferenceConfig.affinityScale)));
}
export function evidenceConfidence(signalCount: number) {
  return Math.max(0, Math.min(1, 1 - Math.exp(-signalCount / preferenceConfig.confidenceScale)));
}
