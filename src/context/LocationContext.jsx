import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { API_ENDPOINTS } from "../config/api";
import { selectBestCourier } from "../utils/courierSelection";

const LS_PINCODE = "bk_delivery_pincode";
const LS_SOURCE  = "bk_location_source";   // "gps" | "manual"
const LS_ASKED   = "bk_location_asked";    // "1" once the browser prompt has been shown

// Cache the courier ETA per pincode so the home/listing cards and the product
// detail page show the same, accurate "delivery by" date without each card
// hitting the serviceability API. Refetched at most once every few hours.
const COURIER_ETD_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const courierEtdCacheKey = (pincode) => `bk_courier_etd_${pincode}`;

const LocationContext = createContext(null);

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

async function reverseGeocodeToPin(lat, lon) {
  // Google Geocoding API — resolve the 6-digit pincode from GPS coordinates.
  // This pincode drives the courier ETA used for the estimated delivery date.
  if (GOOGLE_MAPS_API_KEY) {
    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&result_type=postal_code&key=${GOOGLE_MAPS_API_KEY}`,
      );
      if (res.ok) {
        const data = await res.json();
        const components = data?.results?.[0]?.address_components || [];
        const postcode = (components.find((item) => item.types?.includes("postal_code"))?.long_name || "").replace(/\s/g, "");
        if (/^\d{6}$/.test(postcode)) return postcode;
      }
    } catch {
      // fall through to BigDataCloud
    }
  }

  // BigDataCloud fallback — free, no API key
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`,
    );
    if (res.ok) {
      const data = await res.json();
      const postcode = (data?.postcode || "").replace(/\s/g, "");
      if (/^\d{6}$/.test(postcode)) return postcode;
    }
  } catch {
    // both failed
  }

  return null;
}

export function LocationProvider({ children }) {
  const [pincode, setPincodeRaw] = useState(() => localStorage.getItem(LS_PINCODE) || "");
  const [locationSource, setLocationSource] = useState(() => localStorage.getItem(LS_SOURCE) || null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [courierEtd, setCourierEtd] = useState(null);
  const alreadyAsked = useRef(!!localStorage.getItem(LS_ASKED));

  const setPincode = useCallback((pin, source = "manual") => {
    const clean = String(pin || "").replace(/\D/g, "").slice(0, 6);
    setPincodeRaw(clean);
    setLocationSource(source);
    if (clean) {
      localStorage.setItem(LS_PINCODE, clean);
      localStorage.setItem(LS_SOURCE, source);
    } else {
      localStorage.removeItem(LS_PINCODE);
      localStorage.removeItem(LS_SOURCE);
    }
  }, []);

  const clearPincode = useCallback(() => {
    setPincodeRaw("");
    setLocationSource(null);
    localStorage.removeItem(LS_PINCODE);
    localStorage.removeItem(LS_SOURCE);
    // Intentionally keep LS_ASKED so the browser prompt isn't re-triggered.
  }, []);

  useEffect(() => {
    if (alreadyAsked.current || !navigator?.geolocation) return undefined;

    const timer = setTimeout(() => {
      if (alreadyAsked.current) return;
      alreadyAsked.current = true;
      localStorage.setItem(LS_ASKED, "1");
      setLocationLoading(true);

      navigator.geolocation.getCurrentPosition(
        async ({ coords }) => {
          try {
            const pin = await reverseGeocodeToPin(coords.latitude, coords.longitude);
            if (pin) setPincode(pin, "gps");
          } catch {
            // ignore geocoding errors silently
          } finally {
            setLocationLoading(false);
          }
        },
        () => { setLocationLoading(false); }, // denied or timed-out
        { timeout: 10000, maximumAge: 300000 },
      );
    }, 1500);

    return () => clearTimeout(timer);
  }, []); // runs once on mount

  // Resolve a single courier ETA for the active pincode, cached for a few hours.
  // Both the listing cards and the product detail page reuse this so the delivery
  // estimate is consistent and includes real courier transit time.
  useEffect(() => {
    if (!/^\d{6}$/.test(pincode)) {
      setCourierEtd(null);
      return undefined;
    }

    let cancelled = false;

    const loadCourierEtd = async () => {
      try {
        const cached = JSON.parse(sessionStorage.getItem(courierEtdCacheKey(pincode)) || "null");
        if (cached?.etd && Date.now() - cached.ts < COURIER_ETD_TTL_MS) {
          if (!cancelled) setCourierEtd(cached.etd);
          return;
        }
      } catch {
        // ignore malformed cache
      }

      try {
        const res = await fetch(`${API_ENDPOINTS.shiprocket}/serviceability?pincode=${pincode}&weight=0.5`);
        if (!res.ok) return;
        const data = await res.json();
        const best = selectBestCourier(data?.data?.available_courier_companies || [], {
          weightKg: 0.5,
          requireCod: false,
        });
        const etd = best?.etd || null;
        if (!cancelled && etd) {
          setCourierEtd(etd);
          sessionStorage.setItem(courierEtdCacheKey(pincode), JSON.stringify({ etd, ts: Date.now() }));
        }
      } catch {
        // network/serviceability failure — badges fall back to env processing days
      }
    };

    loadCourierEtd();
    return () => { cancelled = true; };
  }, [pincode]);

  return (
    <LocationContext.Provider value={{ pincode, setPincode, clearPincode, locationSource, locationLoading, courierEtd }}>
      {children}
    </LocationContext.Provider>
  );
}

const FALLBACK = { pincode: "", locationSource: null, locationLoading: false, courierEtd: null, setPincode: () => {}, clearPincode: () => {} };

export const useDeliveryLocation = () => useContext(LocationContext) ?? FALLBACK;
