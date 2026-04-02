import { useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { apiRequest } from "../api.js";

const ISTANBUL_CENTER = [41.0082, 28.9784];

const markerIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const ClickHandler = ({ onSelect }) => {
  useMapEvents({
    click(event) {
      const { lat, lng } = event.latlng;
      onSelect({ lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) });
    },
  });

  return null;
};

const MapViewport = ({ center, zoom }) => {
  const map = useMap();

  useEffect(() => {
    map.setView(center, zoom, { animate: true });
  }, [center, zoom, map]);

  return null;
};

export default function MapPicker({ value, onChange }) {
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [mahalle, setMahalle] = useState("");
  const [street, setStreet] = useState("");
  const [streetNumber, setStreetNumber] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchMessage, setSearchMessage] = useState("");
  const [searchMessageType, setSearchMessageType] = useState("info");

  const center = useMemo(() => {
    if (value?.lat && value?.lng) {
      return [value.lat, value.lng];
    }
    return ISTANBUL_CENTER;
  }, [value]);

  const [viewCenter, setViewCenter] = useState(center);

  useEffect(() => {
    setViewCenter(center);
  }, [center]);

  const handleSearch = async (event) => {
    event.preventDefault();
    const trimmed = query.trim();
    const trimmedCity = city.trim();
    const trimmedDistrict = district.trim();
    const trimmedMahalle = mahalle.trim();
    const trimmedStreet = street.trim();
    const trimmedStreetNumber = streetNumber.trim();
    const streetLine = `${trimmedStreetNumber} ${trimmedStreet}`.trim();
    const inferredCity = trimmedCity || "Istanbul";

    const composedAddress = [streetLine, trimmedMahalle, trimmedDistrict, inferredCity, "Turkey"]
      .filter(Boolean)
      .join(", ");
    const finalQuery = trimmed.length >= 3 ? trimmed : composedAddress;

    if (finalQuery.length < 3) {
      setSearchMessageType("error");
      setSearchMessage("Type at least 3 characters, or fill city/district/street fields.");
      return;
    }

    setSearching(true);
    setSearchMessage("");

    try {
      const params = new URLSearchParams();
      if (finalQuery) params.set("q", finalQuery);
      if (trimmedCity) params.set("city", trimmedCity);
      if (trimmedDistrict) params.set("district", trimmedDistrict);
      if (trimmedMahalle) params.set("mahalle", trimmedMahalle);
      if (trimmedStreet) params.set("street", trimmedStreet);
      if (trimmedStreetNumber) params.set("number", trimmedStreetNumber);

      const payload = await apiRequest({
        path: `/geocode/search?${params.toString()}`,
      });

      const results = Array.isArray(payload?.results) ? payload.results : [];
      const firstIstanbulMatch = results.find((item) =>
        String(item?.displayName || "").toLowerCase().includes("istanbul"),
      );
      const first = firstIstanbulMatch || results[0];

      if (!first) {
        setSearchMessageType("error");
        setSearchMessage("No address found. Try a more specific location.");
        return;
      }

      const lat = Number(Number(first.lat).toFixed(6));
      const lng = Number(Number(first.lng).toFixed(6));
      onChange({ lat, lng });
      setViewCenter([lat, lng]);
      setSearchMessageType("success");
      setSearchMessage(first.displayName || "Address found.");
    } catch (error) {
      setSearchMessageType("error");
      setSearchMessage(error.message || "Unable to search address right now.");
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="map-wrap">
      <div className="map-search">
        <div className="map-search__row">
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Quick search (e.g. Kadikoy, Istanbul)"
            aria-label="Quick search"
          />
          <button type="button" className="map-search__btn" onClick={handleSearch} disabled={searching}>
            {searching ? "Searching..." : "Find"}
          </button>
        </div>

        <div className="map-search__structured">
          <input
            type="text"
            value={city}
            onChange={(event) => setCity(event.target.value)}
            placeholder="City (Istanbul)"
            aria-label="City"
          />
          <input
            type="text"
            value={district}
            onChange={(event) => setDistrict(event.target.value)}
            placeholder="District / Quartier (e.g. Kadikoy)"
            aria-label="District or quartier"
          />
          <input
            type="text"
            value={mahalle}
            onChange={(event) => setMahalle(event.target.value)}
            placeholder="Mahallesi (e.g. Caferaga Mahallesi)"
            aria-label="Mahallesi"
          />
          <input
            type="text"
            value={street}
            onChange={(event) => setStreet(event.target.value)}
            placeholder="Street (e.g. Moda Caddesi)"
            aria-label="Street"
          />
          <input
            type="text"
            value={streetNumber}
            onChange={(event) => setStreetNumber(event.target.value)}
            placeholder="No"
            aria-label="Street number"
          />
        </div>
      </div>

      {searchMessage ? (
        <p className={`map-search__feedback map-search__feedback--${searchMessageType}`}>{searchMessage}</p>
      ) : null}

      <MapContainer center={center} zoom={12} scrollWheelZoom className="map-canvas">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapViewport center={viewCenter} zoom={value?.lat && value?.lng ? 15 : 12} />
        <ClickHandler onSelect={onChange} />
        {value?.lat && value?.lng ? (
          <Marker position={[value.lat, value.lng]} icon={markerIcon} />
        ) : null}
      </MapContainer>
    </div>
  );
}
