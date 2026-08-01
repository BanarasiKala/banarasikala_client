import { useEffect, useState } from "react";
import { API_ENDPOINTS } from "../config/api";

/**
 * The shop's own contact details, served from the server's invoice-seller config so the
 * footer, the Contact page and the tax invoice cannot drift apart.
 *
 * These are the values shipped before this hook existed. They are the render until the
 * request lands, and the render forever if it never does — a footer that shows a stale
 * address beats one that shows a blank space or a spinner where an address should be.
 * Change them in the server's .env (INVOICE_SELLER_*), not here.
 */
export const FALLBACK_STORE_CONTACT = {
  name: "Banarasi Kala",
  email: "support@banarasikala.com",
  website: "www.banarasikala.com",
  street: "",
  cityState: "Varanasi, Uttar Pradesh, India",
  shortLocation: "Varanasi, UP",
};

/**
 * One in-flight request shared by every caller, and the answer kept for the rest of the
 * session. The footer renders on every page and the Contact page mounts inside it, so
 * without this the same unchanging payload would be fetched twice per navigation.
 *
 * Only a *successful* response is cached. A failed fetch leaves both slots null so a later
 * mount retries rather than inheriting a dead promise for the whole session.
 */
let cachedStore = null;
let inFlight = null;

const loadStoreContact = () => {
  if (cachedStore) return Promise.resolve(cachedStore);
  if (inFlight) return inFlight;

  inFlight = fetch(API_ENDPOINTS.storeInfo)
    .then((res) => {
      if (!res.ok) throw new Error(`store-info ${res.status}`);
      return res.json();
    })
    .then((data) => {
      if (!data?.store) throw new Error("store-info: no store in payload");
      // Merged over the fallback so a field the server leaves blank keeps the shipped value
      // instead of rendering as an empty line.
      cachedStore = { ...FALLBACK_STORE_CONTACT, ...data.store };
      return cachedStore;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
};

/**
 * Returns the contact block, starting from the fallback and swapping in the served values
 * once they arrive. Never throws and never returns null — callers can render it directly.
 */
export const useStoreContact = () => {
  const [store, setStore] = useState(cachedStore || FALLBACK_STORE_CONTACT);

  useEffect(() => {
    if (cachedStore) return undefined;

    let alive = true;
    loadStoreContact()
      .then((next) => {
        if (alive) setStore(next);
      })
      .catch(() => {
        // Keep the fallback. The address is presentational; a failed lookup is not worth
        // surfacing to a customer scrolling past the footer.
      });

    return () => {
      alive = false;
    };
  }, []);

  return store;
};

/**
 * The address as one line, for places with a single row to spend on it (the footer).
 * Street is optional in config, so this joins only what is actually set.
 */
export const formatStoreAddress = (store) =>
  [store?.street, store?.cityState].map((part) => String(part || "").trim()).filter(Boolean).join(", ");

export default useStoreContact;
