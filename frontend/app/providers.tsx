"use client";

import { createContext, useCallback, useContext, useState } from "react";
import type { FlashbarProps } from "@cloudscape-design/components";

type FlashType = "success" | "error" | "info" | "warning";

interface FlashContextValue {
  items: FlashbarProps.MessageDefinition[];
  addFlash: (type: FlashType, content: string) => void;
}

const FlashContext = createContext<FlashContextValue>({ items: [], addFlash: () => {} });

export const useFlash = () => useContext(FlashContext);

/** App-wide notification (Flashbar) state, mirroring the AWS console's
 * green/red toast banners at the top of the content area. */
export default function Providers({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<FlashbarProps.MessageDefinition[]>([]);

  const addFlash = useCallback((type: FlashType, content: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setItems(prev => [
      ...prev,
      {
        type,
        content,
        dismissible: true,
        id,
        onDismiss: () => setItems(p => p.filter(i => i.id !== id)),
      },
    ]);
  }, []);

  return <FlashContext.Provider value={{ items, addFlash }}>{children}</FlashContext.Provider>;
}
