// Simple OpenStreetMap raster basemap, no API key required

// MapLibre style object using OSM raster tiles (used as an additional base layer)
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
      maxzoom: 22
    }
  ]
};

const INITIAL_CENTER = [-122.4194, 37.7749]; // SF by default
const INITIAL_ZOOM = 12;

const map = new maplibregl.Map({
  container: "map",
  // Use the local OS Transport style as the single base style
  style: "./transport.txt",
  center: INITIAL_CENTER,
  zoom: INITIAL_ZOOM,
  maxZoom: 15
});

// Add zoom/rotation controls
map.addControl(new maplibregl.NavigationControl(), "top-right");

function addCustomLayers() {
  if (!map.getSource("incidents")) {
    map.addSource("incidents", {
      type: "geojson",
      data: "https://data.sfgov.org/resource/wg3w-h783.geojson?$limit=1000"
    });
  }

  if (!map.getLayer("incidents-layer")) {
    map.addLayer({
      id: "incidents-layer",
      type: "circle",
      source: "incidents",
      paint: {
        "circle-radius": 4,
        "circle-color": [
          "match",
          ["get", "incident_category"],
          "Larceny Theft",
          "#2563eb",
          "Burglary",
          "#f97316",
          "Robbery",
          "#dc2626",
          "Assault",
          "#ef4444",
          "Drug/Narcotic",
          "#10b981",
          "Motor Vehicle Theft",
          "#7c3aed",
          "Vandalism",
          "#6366f1",
          "Other Offenses",
          "#4b5563",
          "#e11d48"
        ],
        "circle-opacity": 0.7,
        "circle-stroke-width": 1,
        "circle-stroke-color": "#ffffff"
      }
    });
  }


  if (!map.getLayer("incidents-heatmap")) {
    map.addLayer({
      id: "incidents-heatmap",
      type: "heatmap",
      source: "incidents",
      maxzoom: 15,
      layout: {
        visibility: "none"
      },
      paint: {
        "heatmap-weight": 1,
        "heatmap-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          10,
          20,
          14,
          40
        ],
        "heatmap-intensity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          10,
          0.5,
          14,
          1.5
        ],
        "heatmap-color": [
          "interpolate",
          ["linear"],
          ["heatmap-density"],
          0,
          "rgba(0,0,0,0)",
          0.2,
          "#22c55e",
          0.4,
          "#eab308",
          0.6,
          "#f97316",
          0.8,
          "#dc2626",
          1,
          "#7f1d1d"
        ],
        "heatmap-opacity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          10,
          1,
          15,
          0
        ]
      }
    });
  }

  const incidentsCheckbox = document.getElementById("toggle-incidents");
  if (incidentsCheckbox) {
    incidentsCheckbox.onchange = (e) => {
      const visible = e.target.checked ? "visible" : "none";
      if (map.getLayer("incidents-layer")) {
        map.setLayoutProperty("incidents-layer", "visibility", visible);
      }
    };
  }

  const incidentsHeatmapToggle = document.getElementById("toggle-incidents-heatmap");
  if (incidentsHeatmapToggle) {
    incidentsHeatmapToggle.onchange = (e) => {
      const showHeatmap = e.target.checked ? "visible" : "none";
      const showDots = e.target.checked ? "none" : "visible";
      if (map.getLayer("incidents-heatmap")) {
        map.setLayoutProperty("incidents-heatmap", "visibility", showHeatmap);
      }
      if (map.getLayer("incidents-layer")) {
        map.setLayoutProperty("incidents-layer", "visibility", showDots);
      }
    };
  }

  map.off("click", "incidents-layer");
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

  map.off("mouseenter", "incidents-layer");
  map.off("mouseleave", "incidents-layer");
  map.on("mouseenter", "incidents-layer", () => {
    map.getCanvas().style.cursor = "pointer";
  });
  map.on("mouseleave", "incidents-layer", () => {
    map.getCanvas().style.cursor = "";
  });

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

  layers.forEach((layer) => {
    if (!map.getSource(layer.id)) {
      fetch(layer.url)
        .then((response) => response.json())
        .then((data) => {
          if (!map.getSource(layer.id)) {
            map.addSource(layer.id, {
              type: "geojson",
              data
            });
          }

          if (!map.getLayer(layer.id + "-fill")) {
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
          }

          if (!map.getLayer(layer.id + "-line")) {
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
          }

          const visible = document.getElementById("toggle-" + layer.id).checked
            ? "visible"
            : "none";
          if (map.getLayer(layer.id + "-fill")) {
            map.setLayoutProperty(layer.id + "-fill", "visibility", visible);
          }
          if (map.getLayer(layer.id + "-line")) {
            map.setLayoutProperty(layer.id + "-line", "visibility", visible);
          }
        })
        .catch((err) => {
          console.error("Error loading layer", layer.id, err);
        });
    }
  });

  layers.forEach((layer) => {
    const toggleEl = document.getElementById("toggle-" + layer.id);
    const opacityEl = document.getElementById("opacity-" + layer.id);

    if (toggleEl) {
      toggleEl.onchange = (e) => {
        const visibility = e.target.checked ? "visible" : "none";
        if (map.getLayer(layer.id + "-fill")) {
          map.setLayoutProperty(layer.id + "-fill", "visibility", visibility);
        }
        if (map.getLayer(layer.id + "-line")) {
          map.setLayoutProperty(layer.id + "-line", "visibility", visibility);
        }
      };
    }

    if (opacityEl) {
      opacityEl.oninput = (e) => {
        const opacity = parseFloat(e.target.value);
        if (map.getLayer(layer.id + "-fill")) {
          map.setPaintProperty(layer.id + "-fill", "fill-opacity", opacity);
        }
        if (map.getLayer(layer.id + "-line")) {
          map.setPaintProperty(layer.id + "-line", "line-opacity", opacity);
        }
      };
    }
  });

  const flyToSfBtn = document.getElementById("flyto-sf");
  if (flyToSfBtn) {
    flyToSfBtn.onclick = () => {
      map.flyTo({
        center: [-122.4194, 37.7749],
        zoom: 12
      });
    };
  }

  const flyToCamdenBtn = document.getElementById("flyto-camden");
  if (flyToCamdenBtn) {
    flyToCamdenBtn.onclick = () => {
      map.flyTo({
        center: [-75.05, 39.8],
        zoom: 10
      });
    };
  }

  const flyToUkCrimeBtn = document.getElementById("flyto-uk-crime");
  if (flyToUkCrimeBtn) {
    flyToUkCrimeBtn.onclick = () => {
      map.flyTo({
        center: [-0.1276, 51.5074],
        zoom: 14
      });
    };
  }

  if (!map.getSource("uk-crime")) {
    map.addSource("uk-crime", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] }
    });
  }

  if (!map.getLayer("uk-crime-layer")) {
    map.addLayer({
      id: "uk-crime-layer",
      type: "circle",
      source: "uk-crime",
      paint: {
        "circle-radius": 4,
        "circle-color": [
          "match",
          ["get", "category"],
          "violent-crime",
          "#dc2626",
          "burglary",
          "#f97316",
          "robbery",
          "#ea580c",
          "vehicle-crime",
          "#2563eb",
          "criminal-damage-arson",
          "#6366f1",
          "drugs",
          "#10b981",
          "possession-of-weapons",
          "#7c3aed",
          "public-order",
          "#facc15",
          "shoplifting",
          "#ec4899",
          "other-theft",
          "#0ea5e9",
          "anti-social-behaviour",
          "#22c55e",
          "other-crime",
          "#4b5563",
          "#0f766e"
        ],
        "circle-opacity": 0.7,
        "circle-stroke-width": 1,
        "circle-stroke-color": "#ffffff"
      }
    });
  }

  map.off("click", "uk-crime-layer");
  map.on("click", "uk-crime-layer", (e) => {
    const feature = e.features[0];
    const props = feature.properties || {};
    const coords = feature.geometry.coordinates.slice();

    const category = props.category || "Crime";
    const month = props.month || "";
    const street = props.location && props.location.street
      ? props.location.street.name
      : props["location.street.name"] || "";

    const html = `
      <strong>${category}</strong><br/>
      ${street ? `Street: ${street}<br/>` : ""}
      ${month ? `Month: ${month}<br/>` : ""}
    `;

    new maplibregl.Popup().setLngLat(coords).setHTML(html).addTo(map);
  });

  map.off("mouseenter", "uk-crime-layer");
  map.off("mouseleave", "uk-crime-layer");
  map.on("mouseenter", "uk-crime-layer", () => {
    map.getCanvas().style.cursor = "pointer";
  });
  map.on("mouseleave", "uk-crime-layer", () => {
    map.getCanvas().style.cursor = "";
  });

  const ukCrimeToggle = document.getElementById("toggle-uk-crime");
  if (ukCrimeToggle) {
    ukCrimeToggle.onchange = (e) => {
      const visible = e.target.checked ? "visible" : "none";
      if (map.getLayer("uk-crime-layer")) {
        map.setLayoutProperty("uk-crime-layer", "visibility", visible);
      }
      if (e.target.checked) {
        fetchUkCrimeForView();
      }
    };
  }
}

map.on("load", () => {
  // Add OSM raster tiles as an additional basemap inside the OS style
  if (!map.getSource("osm-tiles")) {
    const osmSource = OSM_RASTER_STYLE.sources["osm-tiles"];
    map.addSource("osm-tiles", {
      type: "raster",
      tiles: osmSource.tiles,
      tileSize: osmSource.tileSize,
      attribution: osmSource.attribution
    });
  }

  if (!map.getLayer("osm-tiles")) {
    map.addLayer({
      id: "osm-tiles",
      type: "raster",
      source: "osm-tiles",
      minzoom: 0,
      maxzoom: 22
    });
  }

  addCustomLayers();
  fetchUkCrimeForView();

  // Ensure initial basemap visibility matches the selector
  updateBasemapVisibility();
});

map.on("styledata", () => {
  if (map.isStyleLoaded()) {
    addCustomLayers();
    fetchUkCrimeForView();
  }
});

let ukCrimeAbortController = null;

function fetchUkCrimeForView() {
  const toggle = document.getElementById("toggle-uk-crime");
  if (!toggle || !toggle.checked) {
    if (map.getSource("uk-crime")) {
      map.getSource("uk-crime").setData({
        type: "FeatureCollection",
        features: []
      });
    }
    return;
  }

  if (!map.getSource("uk-crime")) {
    return;
  }

  const bounds = map.getBounds();
  const ne = bounds.getNorthEast();
  const sw = bounds.getSouthWest();

  const poly = [
    `${ne.lat},${sw.lng}`,
    `${ne.lat},${ne.lng}`,
    `${sw.lat},${ne.lng}`,
    `${sw.lat},${sw.lng}`
  ].join(":");

  const url = `https://data.police.uk/api/crimes-street/all-crime?poly=${encodeURIComponent(
    poly
  )}`;

  if (ukCrimeAbortController) {
    ukCrimeAbortController.abort();
  }
  ukCrimeAbortController = new AbortController();

  fetch(url, { signal: ukCrimeAbortController.signal })
    .then((response) => response.json())
    .then((data) => {
      const features = (data || [])
        .filter((d) => d.location && d.location.latitude && d.location.longitude)
        .map((d) => ({
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [
              parseFloat(d.location.longitude),
              parseFloat(d.location.latitude)
            ]
          },
          properties: d
        }));

      if (map.getSource("uk-crime")) {
        map.getSource("uk-crime").setData({
          type: "FeatureCollection",
          features
        });
      }
    })
    .catch((err) => {
      if (err.name !== "AbortError") {
        console.error("Error fetching UK crime data", err);
      }
    });
}

map.on("moveend", () => {
  fetchUkCrimeForView();
});

function updateBasemapVisibility() {
  const basemapSelectEl = document.getElementById("basemap-select");
  if (!basemapSelectEl) return;

  const styleValue = basemapSelectEl.value;
  const style = map.getStyle();
  const layers = (style && style.layers) || [];

  const osLayerIds = layers
    .filter((l) => l.source === "esri")
    .map((l) => l.id);

  if (styleValue === "os-transport") {
    // Show OS Transport layers, hide OSM raster layer
    osLayerIds.forEach((id) => {
      map.setLayoutProperty(id, "visibility", "visible");
    });
    if (map.getLayer("osm-tiles")) {
      map.setLayoutProperty("osm-tiles", "visibility", "none");
    }
  } else {
    // Show OSM raster layer, hide OS Transport layers
    osLayerIds.forEach((id) => {
      map.setLayoutProperty(id, "visibility", "none");
    });
    if (map.getLayer("osm-tiles")) {
      map.setLayoutProperty("osm-tiles", "visibility", "visible");

      // Ensure OSM basemap draws beneath overlays
      const overlayOrder = [
        "incidents-layer",
        "law-fill",
        "ems-fill",
        "fire-fill",
        "uk-crime-layer"
      ];
      const beforeId = overlayOrder.find((id) => map.getLayer(id));
      if (beforeId) {
        map.moveLayer("osm-tiles", beforeId);
      }
    }
  }
}

const basemapSelect = document.getElementById("basemap-select");
if (basemapSelect) {
  basemapSelect.onchange = () => {
    updateBasemapVisibility();
  };
}