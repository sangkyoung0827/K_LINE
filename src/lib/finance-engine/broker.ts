import "server-only";

import type { BrokerAdapter, BrokerOrder } from "@/lib/finance-engine/types";

export class PaperBroker implements BrokerAdapter {
  async getAccount() {
    return null;
  }

  async getBalance() {
    return null;
  }

  async getPositions() {
    return [] as never[];
  }

  async getQuote(_symbol: string) {
    return null;
  }

  async getOrders() {
    return [] as never[];
  }

  async placeOrder(_order: BrokerOrder): Promise<never> {
    throw new Error("Paper order execution is disabled during WooHyukmon 4.0 Phase 1.");
  }

  async cancelOrder(_orderId: string) {
    throw new Error("Paper order execution is disabled during WooHyukmon 4.0 Phase 1.");
  }
}

export class RealBroker implements BrokerAdapter {
  async getAccount() {
    return null;
  }

  async getBalance() {
    return null;
  }

  async getPositions() {
    return [] as never[];
  }

  async getQuote(_symbol: string) {
    return null;
  }

  async getOrders() {
    return [] as never[];
  }

  async placeOrder(_order: BrokerOrder): Promise<never> {
    throw new Error("Real broker connections are not available in WooHyukmon 4.0 Phase 1.");
  }

  async cancelOrder(_orderId: string) {
    throw new Error("Real broker connections are not available in WooHyukmon 4.0 Phase 1.");
  }
}

