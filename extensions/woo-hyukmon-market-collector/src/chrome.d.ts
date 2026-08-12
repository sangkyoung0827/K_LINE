declare const chrome: {
  runtime: {
    lastError?: { message?: string };
    onMessage: { addListener(listener: (message: any, sender: any, sendResponse: (response?: any) => void) => boolean | void): void };
    sendMessage(message: any, callback?: (response?: any) => void): void;
  };
  tabs: {
    create(options: { url?: string; active?: boolean }, callback: (tab: { id?: number; url?: string }) => void): void;
    update(tabId: number, options: { url?: string; active?: boolean }, callback?: (tab?: { id?: number; url?: string }) => void): void;
    query(options: Record<string, unknown>, callback: (tabs: Array<{ id?: number; url?: string }>) => void): void;
    sendMessage(tabId: number, message: any, callback?: (response?: any) => void): void;
    onUpdated: { addListener(listener: (tabId: number, info: { status?: string }, tab: { id?: number; url?: string }) => void): void; removeListener(listener: (tabId: number, info: { status?: string }, tab: { id?: number; url?: string }) => void): void };
    onRemoved: { addListener(listener: (tabId: number) => void): void };
  };
  storage: { local: { get(keys: string | string[], callback: (items: Record<string, any>) => void): void; set(items: Record<string, any>, callback?: () => void): void; remove(keys: string | string[], callback?: () => void): void } };
};

declare var WHM_PLATFORM_REGISTRY: Array<Record<string, any>>;
