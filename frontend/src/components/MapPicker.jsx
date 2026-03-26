import { useMemo } from "react";
import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";
import L from "leaflet";

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

export default function MapPicker({ value, onChange }) {
  const center = useMemo(() => {
    if (value?.lat && value?.lng) {
      return [value.lat, value.lng];
    }
    return [6.5244, 3.3792];
  }, [value]);

  return (
    <div className="map-wrap">
      <MapContainer center={center} zoom={12} scrollWheelZoom className="map-canvas">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickHandler onSelect={onChange} />
        {value?.lat && value?.lng ? (
          <Marker position={[value.lat, value.lng]} icon={markerIcon} />
        ) : null}
      </MapContainer>
    </div>
  );
}
