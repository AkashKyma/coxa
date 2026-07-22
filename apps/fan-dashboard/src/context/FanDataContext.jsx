/**
 * FanDataContext
 *
 * Caches the fan's loyalty balance and ticket count in memory so navigating
 * between pages doesn't show 0 while data is re-fetching. Also exposes a
 * global `refresh()` to force a reload (used after redemptions, purchases, etc.)
 */
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { loyaltyApi, ticketsApi } from "../lib/api.js";

const FanDataContext = createContext(null);

export function FanDataProvider({ children }) {
  const [loyalty, setLoyalty] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem("coxa_loyalty") ?? "null"); } catch { return null; }
  });
  const [ticketCount, setTicketCount] = useState(() => {
    try { return Number(sessionStorage.getItem("coxa_ticket_count") ?? "0"); } catch { return 0; }
  });
  const [loading, setLoading] = useState(!loyalty);

  const refresh = useCallback(async () => {
    try {
      const [loyaltyRes, ticketsRes] = await Promise.all([
        loyaltyApi.me(),
        ticketsApi.myTickets(),
      ]);
      const loyaltyData = loyaltyRes?.data ?? null;
      const count = ticketsRes?.data?.length ?? 0;
      setLoyalty(loyaltyData);
      setTicketCount(count);
      sessionStorage.setItem("coxa_loyalty", JSON.stringify(loyaltyData));
      sessionStorage.setItem("coxa_ticket_count", String(count));
    } catch {
      // Keep stale data on error
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on first mount
  useEffect(() => { refresh(); }, [refresh]);

  return (
    <FanDataContext.Provider value={{ loyalty, ticketCount, loading, refresh }}>
      {children}
    </FanDataContext.Provider>
  );
}

export function useFanData() {
  const ctx = useContext(FanDataContext);
  if (!ctx) throw new Error("useFanData must be used inside FanDataProvider");
  return ctx;
}
