import { Router } from "express";

const router = Router();

const ISTANBUL_VIEWBOX = "28.35,41.35,29.85,40.75";
const DEFAULT_USER_AGENT = "city-management/1.0";

const toTrimmed = (value) => String(value || "").trim();

const buildParams = ({ query, bounded }) => {
  const params = new URLSearchParams({
    format: "jsonv2",
    addressdetails: "1",
    limit: "5",
    countrycodes: "tr",
    q: query,
  });

  if (bounded) {
    params.set("bounded", "1");
    params.set("viewbox", ISTANBUL_VIEWBOX);
  }

  return params;
};

const mapResults = (rawResults) =>
  Array.isArray(rawResults)
    ? rawResults
        .map((item) => ({
          lat: Number(item.lat),
          lng: Number(item.lon),
          displayName: item.display_name || "",
        }))
        .filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng))
    : [];

router.get("/search", async (req, res) => {
  const q = toTrimmed(req.query.q);
  const city = toTrimmed(req.query.city);
  const district = toTrimmed(req.query.district);
  const mahalle = toTrimmed(req.query.mahalle);
  const street = toTrimmed(req.query.street);
  const number = toTrimmed(req.query.number);

  const inferredCity = city || "Istanbul";
  const streetLine = `${number} ${street}`.trim();
  const composedAddress = [
    streetLine,
    mahalle,
    district,
    inferredCity,
    "Turkey",
  ]
    .filter(Boolean)
    .join(", ");

  const finalQuery = q.length >= 3 ? q : composedAddress;

  if (finalQuery.length < 3) {
    res.status(400).json({ message: "Address query is too short." });
    return;
  }

  const fallbackStreetLine = street.trim();
  const fallbackComposedAddress = [
    fallbackStreetLine,
    mahalle,
    district,
    inferredCity,
    "Turkey",
  ]
    .filter(Boolean)
    .join(", ");

  const candidateQueries = [
    { query: finalQuery, bounded: true },
    { query: fallbackComposedAddress, bounded: true },
    { query: finalQuery, bounded: false },
    { query: fallbackComposedAddress, bounded: false },
  ].filter((item) => item.query.length >= 3);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    let results = [];

    for (const candidate of candidateQueries) {
      const params = buildParams(candidate);
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?${params.toString()}`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
            "User-Agent": process.env.NOMINATIM_USER_AGENT || DEFAULT_USER_AGENT,
          },
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        continue;
      }

      const rawResults = await response.json();
      results = mapResults(rawResults);
      if (results.length) {
        break;
      }
    }

    res.json({ results });
  } catch (error) {
    if (error?.name === "AbortError") {
      res.status(504).json({ message: "Address search timed out." });
      return;
    }

    console.error("Geocode search failed:", error);
    res.status(502).json({ message: "Address search failed." });
  } finally {
    clearTimeout(timeout);
  }
});

export default router;
