import type { TraditionalLiquorDataset } from "@/lib/traditional-liquor/types";

export interface TraditionalLiquorRepository {
  getDataset(): Promise<TraditionalLiquorDataset>;
}

