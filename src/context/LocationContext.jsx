import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

const LS_PINCODE = "bk_delivery_pincode";
const LS_SOURCE  = "bk_location_source";   // "gps" | "manual"
const LS_ASKED   = "bk_location_asked";    // "1" once the browser prompt has been shown

const LocationContext = createContext(null);

async function reverseGeocodeToPin(lat, lon) {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
    { headers: { "Accept-Language": "en" } },
  );
  if (!res.ok) return null;
  const data = await res.json();
  const postcode = (data?.address?.postcode || "").replace(/\s/g, "");
  return /^\d{6}$/.test(postcode) ? postcode : null;
}

export function LocationProvider({ children }) {
  const [pincode, setPincodeRaw] = useState(() => localStorage.getItem(LS_PINCODE) || "");
  const [locationSource, setLocationSource] = useState(() => localStorage.getItem(LS_SOURCE) || null);
  const [locationLoading, setLocationLoading] = useState(false);
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

  return (
    <LocationContext.Provider value={{ pincode, setPincode, clearPincode, locationSource, locationLoading }}>
      {children}
    </LocationContext.Provider>
  );
}

export const useDeliveryLocation = () => useContext(LocationContext);
