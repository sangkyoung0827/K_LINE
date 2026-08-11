"use client";

import { WoohyukmonChatbot } from "@/components/WoohyukmonChatbot";

export function WoohyukmonV4Dashboard({ chatOnly: _chatOnly = false }: { chatOnly?: boolean }) {
  return (
    <main className="min-h-[calc(100svh-5rem)] w-full">
      <WoohyukmonChatbot edition="4" />
    </main>
  );
}
