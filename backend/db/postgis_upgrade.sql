-- Optional PostGIS upgrade for advanced GIS queries.
-- Run after schema.sql only if your Neon project supports PostGIS.

CREATE EXTENSION
IF NOT EXISTS postgis;

ALTER TABLE issues
ADD COLUMN
IF NOT EXISTS location geometry
(Point, 4326);

UPDATE issues
SET location = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
WHERE location IS NULL;

CREATE INDEX
IF NOT EXISTS idx_issues_location_gist
ON issues USING GIST
(location);
