import { useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";

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

    if (trimmed.length < 3) {
      setSearchMessageType("error");
      setSearchMessage("Type at least 3 characters to search.");
      return;
    }

    setSearching(true);
    setSearchMessage("");

    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(trimmed)}`;
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Address search failed. Please try again.");
      }

      const results = await response.json();
      const first = results?.[0];

      if (!first) {
        setSearchMessageType("error");
        setSearchMessage("No address found. Try a more specific location.");
        return;
      }

      const lat = Number(Number(first.lat).toFixed(6));
      const lng = Number(Number(first.lon).toFixed(6));
      onChange({ lat, lng });
      setViewCenter([lat, lng]);
      setSearchMessageType("success");
      setSearchMessage(first.display_name || "Address found.");
    } catch (error) {
      setSearchMessageType("error");
      setSearchMessage(error.message || "Unable to search address right now.");
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="map-wrap">
      <form className="map-search" onSubmit={handleSearch}>
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search address (e.g. Kadikoy, Istanbul)"
          aria-label="Search address"
        />
        <button type="submit" className="map-search__btn" disabled={searching}>
          {searching ? "Searching..." : "Find"}
        </button>
      </form>

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
