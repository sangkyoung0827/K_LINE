import type { CollectionQuery, CollectionQueryType, QueryCandidate, RawCollectedOffer } from "@/lib/traditional-liquor/collection/types";

export const seedCollectionQueries: Array<Omit<CollectionQuery, "id">> = [
  ["전통주", "GENERAL", 100], ["막걸리", "CATEGORY", 90], ["탁주", "CATEGORY", 90], ["약주", "CATEGORY", 90],
  ["청주", "CATEGORY", 90], ["과실주", "CATEGORY", 90], ["증류주", "CATEGORY", 90], ["증류식 소주", "CATEGORY", 90],
  ["리큐르", "CATEGORY", 80], ["안동소주", "PRODUCT", 80], ["문배주", "PRODUCT", 80], ["이강주", "PRODUCT", 80],
  ["감홍로", "PRODUCT", 80], ["복순도가", "BRAND", 80]
].map(([query, queryType, priority]) => ({ query: query as string, queryType: queryType as CollectionQueryType, priority: priority as number, enabled: true, lastCollectedAt: null }));

export interface QueryRepository {
  list(): Promise<CollectionQuery[]>;
  create(input: Omit<CollectionQuery, "id" | "lastCollectedAt">): Promise<CollectionQuery>;
  update(id: string, input: Partial<Pick<CollectionQuery, "priority" | "enabled">>): Promise<CollectionQuery>;
  markCollected(id: string, collectedAt: string): Promise<void>;
}

export interface QueryExpansionService {
  createCandidates(offers: RawCollectedOffer[]): QueryCandidate[];
}

export class PassiveQueryExpansionService implements QueryExpansionService {
  createCandidates() { return []; }
}

export class QueryEngine {
  constructor(private readonly repository: QueryRepository) {}
  async next(limit = 1) {
    return (await this.repository.list()).filter((item) => item.enabled).sort((a, b) => b.priority - a.priority).slice(0, Math.max(1, Math.min(limit, 5)));
  }
}
