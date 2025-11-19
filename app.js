// Simple OpenStreetMap raster basemap, no API key required

// MapLibre style object using OSM raster tiles
const OSM_RASTER_STYLE = {
  version: 8,
  sources: {
    "osm-tiles": {
      type: "raster",
      tiles: [
        "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      ],
      tileSize: 256,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }
  },
  layers: [
    {
      id: "osm-tiles",
      type: "raster",
      source: "osm-tiles",
      minzoom: 0,
      maxzoom: 19
    }
  ]
};

const INITIAL_CENTER = [-122.4194, 37.7749];
const INITIAL_ZOOM = 12;

console.log("app.js loaded");

const map = new maplibregl.Map({
  container: "map",
  style: OSM_RASTER_STYLE,
  center: INITIAL_CENTER,
  zoom: INITIAL_ZOOM
});

// Add zoom/rotation controls
map.addControl(new maplibregl.NavigationControl(), "top-right");

// Add data layers once the base style is loaded
map.on("load", () => {
  console.log("map load event fired");

  // --- SF Police Incidents (points from data.sfgov.org) ---

  map.addSource("incidents", {
    type: "geojson",
    data: "https://data.sfgov.org/resource/wg3w-h783.geojson?$limit=1000"
  });

  map.addLayer({
    id: "incidents-layer",
    type: "circle",
    source: "incidents",
    paint: {
      "circle-radius": 4,
      "circle-color": "#e11d48",
      "circle-opacity": 0.7,
      "circle-stroke-width": 1,
      "circle-stroke-color": "#ffffff"
    }
  });

  // Legend checkbox: toggle incidents layer visibility
  const incidentsCheckbox = document.getElementById("toggle-incidents");
  if (incidentsCheckbox) {
    incidentsCheckbox.addEventListener("change", (e) => {
      const visible = e.target.checked ? "visible" : "none";
      map.setLayoutProperty("incidents-layer", "visibility", visible);
    });
  }

  // Click popup for incidents
  map.on("click", "incidents-layer", (e) => {
    const feature = e.features[0];
    const coords = feature.geometry.coordinates.slice();
    const type = feature.properties.incident_category || "Incident";
    const date = feature.properties.incident_datetime || "";
    const district = feature.properties.police_district || "";

    const html = `
      <strong>${type}</strong><br/>
      ${date ? `Date: ${date}<br/>` : ""}
      ${district ? `District: ${district}<br/>` : ""}
    `;

    new maplibregl.Popup().setLngLat(coords).setHTML(html).addTo(map);
  });

  map.on("mouseenter", "incidents-layer", () => {
    map.getCanvas().style.cursor = "pointer";
  });
  map.on("mouseleave", "incidents-layer", () => {
    map.getCanvas().style.cursor = "";
  });

  // --- Contra Costa County Law/EMS/Fire zones from ArcGIS (GeoJSON) ---

  const layers = [
    {
      id: "law",
      url: "https://services7.arcgis.com/uFAr0LUPy14bDaLg/arcgis/rest/services/CCCLaw_Zones091625/FeatureServer/0/query?where=1=1&outFields=*&f=geojson",
      lineColor: "#1f77b4",
      fillColor: "#aec7e8"
    },
    {
      id: "ems",
      url: "https://services7.arcgis.com/uFAr0LUPy14bDaLg/arcgis/rest/services/CCC_EMS_Zones091725/FeatureServer/0/query?where=1=1&outFields=*&f=geojson",
      lineColor: "#ff7f0e",
      fillColor: "#ffbb78"
    },
    {
      id: "fire",
      url: "https://services7.arcgis.com/uFAr0LUPy14bDaLg/arcgis/rest/services/CCC_Fire_Zones082225/FeatureServer/0/query?where=1=1&outFields=*&f=geojson",
      lineColor: "#2ca02c",
      fillColor: "#98df8a"
    }
  ];

  // Fetch each GeoJSON and add as fill + line layers
  layers.forEach((layer) => {
    fetch(layer.url)
      .then((response) => {
        console.log("Fetch status for", layer.id, response.status);
        return response.json();
      })
      .then((data) => {
        console.log("Loaded layer", layer.id, "features:", data.features?.length);

        map.addSource(layer.id, {
          type: "geojson",
          data
        });

        // Fill polygons
        map.addLayer({
          id: layer.id + "-fill",
          type: "fill",
          source: layer.id,
          paint: {
            "fill-color": layer.fillColor,
            "fill-opacity": parseFloat(
              document.getElementById("opacity-" + layer.id).value
            )
          }
        });

        // Outline
        map.addLayer({
          id: layer.id + "-line",
          type: "line",
          source: layer.id,
          paint: {
            "line-color": layer.lineColor,
            "line-width": 2,
            "line-opacity": parseFloat(
              document.getElementById("opacity-" + layer.id).value
            )
          }
        });

        // Initial visibility from checkbox
        const visible = document.getElementById("toggle-" + layer.id).checked
          ? "visible"
          : "none";
        map.setLayoutProperty(layer.id + "-fill", "visibility", visible);
        map.setLayoutProperty(layer.id + "-line", "visibility", visible);

        // TEMP: zoom roughly to Contra Costa County when law layer loads
        if (layer.id === "law") {
          map.flyTo({
            center: [-121.9, 37.9],
            zoom: 9
          });
        }
      })
      .catch((err) => {
        console.error("Error loading layer", layer.id, err);
      });
  });

  // Wire legend controls: toggles and opacity sliders
  layers.forEach((layer) => {
    const toggleEl = document.getElementById("toggle-" + layer.id);
    const opacityEl = document.getElementById("opacity-" + layer.id);

    if (toggleEl) {
      toggleEl.addEventListener("change", (e) => {
        const visibility = e.target.checked ? "visible" : "none";
        map.setLayoutProperty(layer.id + "-fill", "visibility", visibility);
        map.setLayoutProperty(layer.id + "-line", "visibility", visibility);
      });
    }

    if (opacityEl) {
      opacityEl.addEventListener("input", (e) => {
        const opacity = parseFloat(e.target.value);
        map.setPaintProperty(layer.id + "-fill", "fill-opacity", opacity);
        map.setPaintProperty(layer.id + "-line", "line-opacity", opacity);
      });
    }
  });
});