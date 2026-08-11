import { traditionalLiquorMockData } from "@/lib/traditional-liquor/mock-data";
import type { TraditionalLiquorRepository } from "@/lib/traditional-liquor/repository";

export class MockTraditionalLiquorRepository implements TraditionalLiquorRepository {
  async getDataset() {
    return structuredClone(traditionalLiquorMockData);
  }
}

