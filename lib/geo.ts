// Where a lead is (PRD-013): a point on the street map, and how it was set.
// Shared by the server's geocode route and the map, so no browser or server API.

export interface LeadGeo {
  lat: number;
  lng: number;
  by: "maps" | "alamat" | "pin" | "gps";   // Google Maps result, address search, a tap on the map, the phone's GPS
}

export interface GeoHit { lat: number; lng: number; label: string; address: string }

// Jakarta, when nothing has a location yet.
export const HOME: [number, number] = [106.8272, -6.1754];

export const validGeo = (g: unknown): g is LeadGeo =>
  !!g && typeof (g as LeadGeo).lat === "number" && typeof (g as LeadGeo).lng === "number"
  && Math.abs((g as LeadGeo).lat) <= 90 && Math.abs((g as LeadGeo).lng) <= 180;

// Directions in Google Maps, from wherever the phone is.
export const routeUrl = (g: { lat: number; lng: number }) => `https://www.google.com/maps/dir/?api=1&destination=${g.lat},${g.lng}`;
