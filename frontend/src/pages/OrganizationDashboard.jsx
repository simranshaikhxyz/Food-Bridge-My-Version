
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Circle,
  Polyline,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const API = (
  import.meta.env.VITE_API_URL || "http://localhost:5000"
).replace(/\/+$/, "");

const GREEN = "#193c2c";
const ACCENT = "#bd7148";
const CREAM = "#f8f7f2";

/* ================= API HELPERS ================= */

async function apiRequest(path, options = {}) {
  const token = localStorage.getItem("token");
  const url = `${API}${path.startsWith("/") ? path : `/${path}`}`;

  const headers = {
    Accept: "application/json",
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  let response;

  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (error) {
    console.error("NETWORK ERROR:", error);

    throw new Error(
      "Cannot connect to the backend. Check that your server is running."
    );
  }

  const text = await response.text();
  let data = {};

  if (text.trim()) {
    try {
      data = JSON.parse(text);
    } catch {
      console.error("NON-JSON API RESPONSE:", {
        url,
        status: response.status,
        response: text.slice(0, 500),
      });

      throw new Error(
        `Invalid server response (HTTP ${response.status}). Check the backend route.`
      );
    }
  }

  if (!response.ok) {
    console.error("API ERROR:", {
      url,
      status: response.status,
      data,
    });

    throw new Error(
      data.message ||
        data.error ||
        `Request failed with HTTP ${response.status}.`
    );
  }

  return data;
}

function getCoordinates(location) {
  if (
    location &&
    Number.isFinite(Number(location.latitude)) &&
    Number.isFinite(Number(location.longitude)) &&
    location.latitude !== null &&
    location.longitude !== null
  ) {
    return [Number(location.latitude), Number(location.longitude)];
  }

  if (
    Array.isArray(location?.coordinates) &&
    location.coordinates.length === 2 &&
    location.coordinates.every(
      (coordinate) =>
        coordinate !== null &&
        coordinate !== "" &&
        Number.isFinite(Number(coordinate))
    )
  ) {
    // GeoJSON stores [longitude, latitude].
    return [
      Number(location.coordinates[1]),
      Number(location.coordinates[0]),
    ];
  }

  return null;
}

function getDonationCoordinates(donation) {
  return getCoordinates(donation?.location);
}

/* ================= MAP ICONS ================= */

const organizationIcon = L.divIcon({
  className: "custom-map-icon",
  html: `
    <div class="user-location-marker">
      <div class="user-location-dot"></div>
    </div>
  `,
  iconSize: [46, 46],
  iconAnchor: [23, 23],
});

const foodIcon = L.divIcon({
  className: "custom-map-icon",
  html: `
    <div class="food-location-marker">
      <span>🍲</span>
    </div>
  `,
  iconSize: [48, 48],
  iconAnchor: [24, 24],
});

/* ================= MAP STYLES ================= */

const mapStyles = `
  .custom-map-icon {
    background: transparent !important;
    border: none !important;
  }

  .user-location-marker {
    width: 46px;
    height: 46px;
    border-radius: 50%;
    background: rgba(25, 60, 44, 0.16);
    display: flex;
    align-items: center;
    justify-content: center;
    animation: locationPulse 2s infinite;
  }

  .user-location-dot {
    width: 25px;
    height: 25px;
    border-radius: 50%;
    background: #193c2c;
    border: 4px solid white;
    box-shadow: 0 3px 10px rgba(0,0,0,0.2);
  }

  .food-location-marker {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: white;
    border: 3px solid #bd7148;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 12px rgba(0,0,0,0.18);
  }

  .food-location-marker span {
    font-size: 24px;
    line-height: 1;
  }

  @keyframes locationPulse {
    0% { box-shadow: 0 0 0 0 rgba(25,60,44,0.4); }
    70% { box-shadow: 0 0 0 15px rgba(25,60,44,0); }
    100% { box-shadow: 0 0 0 0 rgba(25,60,44,0); }
  }

  .leaflet-popup-content-wrapper {
    border-radius: 16px;
  }

  .leaflet-popup-content {
    margin: 14px 16px;
  }

  .leaflet-control-zoom {
    border: none !important;
    box-shadow: 0 4px 15px rgba(0,0,0,0.12) !important;
  }

  .leaflet-control-zoom a {
    border: none !important;
    color: #193c2c !important;
  }
`;

/* ================= MAP VIEW ================= */

function MapView({ organizationPosition, selectedFoodPosition }) {
  const map = useMap();

  useEffect(() => {
    if (organizationPosition && selectedFoodPosition) {
      map.fitBounds(
        L.latLngBounds([organizationPosition, selectedFoodPosition]),
        { padding: [70, 70], maxZoom: 15 }
      );
    } else if (organizationPosition) {
      map.setView(organizationPosition, 14, { animate: true });
    }
  }, [organizationPosition, selectedFoodPosition, map]);

  return null;
}

/* ================= DRIVING ROUTE ================= */

function FoodRoute({ from, to }) {
  const [route, setRoute] = useState([]);

  useEffect(() => {
    if (!from || !to) {
      setRoute([]);
      return;
    }

    let cancelled = false;

    async function loadRoute() {
      try {
        const url =
          `https://router.project-osrm.org/route/v1/driving/` +
          `${from[1]},${from[0]};${to[1]},${to[0]}` +
          `?overview=full&geometries=geojson`;

        const response = await fetch(url);

        if (!response.ok) {
          throw new Error("Driving route could not be loaded.");
        }

        const data = await response.json();

        if (!cancelled && data.routes?.length) {
          setRoute(
            data.routes[0].geometry.coordinates.map(([lng, lat]) => [
              lat,
              lng,
            ])
          );
        } else if (!cancelled) {
          setRoute([]);
        }
      } catch (error) {
        console.error("ROUTE ERROR:", error);
        if (!cancelled) setRoute([]);
      }
    }

    loadRoute();

    return () => {
      cancelled = true;
    };
  }, [from, to]);

  if (!route.length) return null;

  return (
    <>
      <Polyline
        positions={route}
        pathOptions={{
          color: "white",
          weight: 8,
          opacity: 0.9,
          lineCap: "round",
          lineJoin: "round",
        }}
      />
      <Polyline
        positions={route}
        pathOptions={{
          color: ACCENT,
          weight: 5,
          opacity: 0.95,
          lineCap: "round",
          lineJoin: "round",
        }}
      />
    </>
  );
}

/* ================= MAIN DASHBOARD ================= */

function OrganizationDashboard() {
  const [activeSection, setActiveSection] = useState("overview");
  const navigate = useNavigate();

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("organizationId");
    navigate("/auth");
  }

  return (
    <main className="min-h-screen bg-[#f8f7f2] text-[#193c2c]">
      <style>{mapStyles}</style>

      {/* NAVBAR */}
      <nav className="flex items-center justify-between border-b border-[#193c2c]/10 px-6 py-5 md:px-12 lg:px-16">
        <Link to="/" className="group block">
          <span className="text-2xl font-semibold tracking-[-0.05em]">
            Food<span className="text-[#bd7148]">Bridge</span>
          </span>

          <span className="mt-1 block text-[9px] font-medium uppercase tracking-[0.28em] text-[#193c2c]/45">
            Food redistribution
          </span>
        </Link>

        <button
          type="button"
          onClick={logout}
          className="rounded-full border border-[#193c2c]/15 px-5 py-2.5 text-sm transition hover:border-[#193c2c] hover:bg-[#193c2c] hover:text-white"
        >
          Logout
        </button>
      </nav>

      <div className="mx-auto max-w-7xl px-6 py-12 md:px-12 md:py-16 lg:px-16">
        {/* HERO */}
        <section>
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-[#bd7148]">
            Organization workspace
          </p>

          <h1 className="mt-5 text-5xl font-medium leading-[1.05] tracking-[-0.055em] md:text-7xl">
            Find surplus
            <br />
            food
            <span className="font-serif italic text-[#bd7148]">.</span>
          </h1>

          <p className="mt-6 max-w-xl text-base leading-8 text-[#193c2c]/65 md:text-lg">
            Discover nearby food donations, request what your community needs,
            and manage every pickup in one place.
          </p>

          <div className="mt-7 flex flex-wrap gap-3 text-xs">
            <span className="rounded-full border border-[#193c2c]/10 bg-white/70 px-4 py-2 text-[#193c2c]/65">
              Discover donations
            </span>
            <span className="rounded-full border border-[#193c2c]/10 bg-white/70 px-4 py-2 text-[#193c2c]/65">
              Manage requests
            </span>
            <span className="rounded-full border border-[#193c2c]/10 bg-white/70 px-4 py-2 text-[#193c2c]/65">
              Track pickups
            </span>
          </div>
        </section>

        {/* NAVIGATION TABS */}
        <div className="mt-12 flex flex-wrap gap-3 border-b border-[#193c2c]/10 pb-6">
          {[
            ["overview", "Overview"],
            ["nearby", "Nearby Food"],
            ["requests", "My Requests"],
          ].map(([value, label]) => (
            <DashboardButton
              key={value}
              active={activeSection === value}
              onClick={() => setActiveSection(value)}
            >
              {label}
            </DashboardButton>
          ))}
        </div>

        {/* EXISTING SECTIONS */}
        <div className="mt-10">
          {activeSection === "overview" && (
            <Overview setActiveSection={setActiveSection} />
          )}
          {activeSection === "nearby" && <NearbyFood />}
          {activeSection === "requests" && <MyRequests />}
        </div>
      </div>

      {/* FOOTER */}
      <footer className="border-t border-[#193c2c]/10 px-6 py-7 md:px-12 lg:px-16">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 text-xs text-[#193c2c]/45 sm:flex-row sm:items-center sm:justify-between">
          <p>
            Food<span className="text-[#bd7148]">Bridge</span> · Connecting
            surplus food with communities
          </p>
          <p>Organization workspace</p>
        </div>
      </footer>
    </main>
  );
}

/* ================= OVERVIEW ================= */

function Overview({ setActiveSection }) {
  return (
    <section>
      <SectionHeading
        eyebrow="Your workspace"
        title="Make food count."
        description="Find available donations and stay on top of your organization's food requests."
      />

      <div className="mt-9 grid gap-5 md:grid-cols-2">
        <DashboardCard
          symbol="◎"
          number="01"
          title="Nearby food"
          description="Discover surplus food available near your organization and explore donation locations on the map."
          action="Explore available food"
          onClick={() => setActiveSection("nearby")}
        />

        <DashboardCard
          symbol="↗"
          number="02"
          title="My requests"
          description="Review your food requests, check their status, and manage collection and completion."
          action="Manage your requests"
          onClick={() => setActiveSection("requests")}
        />

        <DashboardCard
          symbol="⌖"
          number="03"
          title="Find your location"
          description="Use your current GPS location to discover donations within your preferred search radius."
          action="Find donations nearby"
          onClick={() => setActiveSection("nearby")}
        />
      </div>
    </section>
  );
}

/* ================= NEARBY FOOD ================= */

function NearbyFood() {
  const [position, setPosition] = useState(null);
  const [radius, setRadius] = useState(10000);
  const [donations, setDonations] = useState([]);
  const [selectedFood, setSelectedFood] = useState(null);
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [error, setError] = useState("");
  const [locationMessage, setLocationMessage] = useState("");
  const [requestLoading, setRequestLoading] = useState(null);
  const [requestMessage, setRequestMessage] = useState("");
  const [requestError, setRequestError] = useState("");

  const latitude = position?.[0] ?? null;
  const longitude = position?.[1] ?? null;

  function getCurrentLocation() {
    setLocationLoading(true);
    setError("");
    setLocationMessage("");

    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      setLocationLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setPosition([coords.latitude, coords.longitude]);
        setLocationMessage("Your current location has been captured.");
        setLocationLoading(false);
      },
      (err) => {
        const messages = {
          1: "Location permission was denied. Please allow location access.",
          2: "Your location could not be determined.",
          3: "Location request timed out. Please try again.",
        };

        setError(messages[err.code] || "Unable to get your location.");
        setLocationLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  useEffect(() => {
    if (latitude === null || longitude === null) return;

    let cancelled = false;

    async function loadNearbyFood() {
      setLoading(true);
      setError("");

      try {
        const query = new URLSearchParams({
          latitude: String(latitude),
          longitude: String(longitude),
          radius: String(radius),
        });

        const data = await apiRequest(
          `/api/donations/nearby?${query.toString()}`
        );

        const items = Array.isArray(data)
          ? data
          : Array.isArray(data.donations)
            ? data.donations
            : [];

        if (!cancelled) {
          setDonations(items);

          setSelectedFood((current) =>
            current && items.some((item) => item._id === current._id)
              ? items.find((item) => item._id === current._id)
              : null
          );
        }
      } catch (err) {
        console.error("NEARBY FOOD ERROR:", err);
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadNearbyFood();

    return () => {
      cancelled = true;
    };
  }, [latitude, longitude, radius]);

  async function requestFood(donation) {
    setRequestLoading(donation._id);
    setRequestMessage("");
    setRequestError("");

    try {
      const token = localStorage.getItem("token");
      const organizationId = localStorage.getItem("organizationId");

      if (!token) {
        throw new Error("Please log in before requesting food.");
      }

      if (!organizationId) {
        throw new Error(
          "Organization ID is missing. Log in again using your organization account."
        );
      }

      if (!donation?._id) {
        throw new Error("The selected donation has no valid ID.");
      }

      const result = await apiRequest("/api/requests", {
        method: "POST",
        body: JSON.stringify({
          donationId: donation._id,
          organizationId,
        }),
      });

      setRequestMessage(
        result.message || "Food request submitted successfully."
      );

      setDonations((current) =>
        current.filter((item) => item._id !== donation._id)
      );
      setSelectedFood((current) =>
        current?._id === donation._id ? null : current
      );
    } catch (err) {
      console.error("REQUEST FOOD ERROR:", err);
      setRequestError(err.message || "Unable to create the food request.");
    } finally {
      setRequestLoading(null);
    }
  }

  const selectedFoodPosition = getDonationCoordinates(selectedFood);

  return (
    <section>
      <SectionHeading
        eyebrow="Nearby donations"
        title="Available food."
        description="Find surplus food donations near your current location and request food for your community."
      />

      {/* LOCATION CONTROLS */}
      <div className="mt-9 rounded-3xl border border-[#193c2c]/10 bg-white/60 p-6 md:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-lg font-medium tracking-tight">
              Your location
            </p>
            <p className="mt-2 max-w-lg text-sm leading-6 text-[#193c2c]/55">
              Your browser GPS location is used to find food donations within
              your selected radius.
            </p>
          </div>

          <button
            type="button"
            onClick={getCurrentLocation}
            disabled={locationLoading}
            className="rounded-full bg-[#193c2c] px-6 py-3.5 text-sm text-white transition hover:bg-[#bd7148] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {locationLoading ? "Getting location..." : "Use my current location"}
          </button>
        </div>

        {locationMessage && (
          <MessageBox type="success">{locationMessage}</MessageBox>
        )}

        {position && (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-[#f8f7f2] p-4">
              <p className="text-xs uppercase tracking-wider text-[#193c2c]/45">
                Latitude
              </p>
              <p className="mt-2 break-all text-sm font-medium">
                {latitude.toFixed(6)}
              </p>
            </div>

            <div className="rounded-2xl bg-[#f8f7f2] p-4">
              <p className="text-xs uppercase tracking-wider text-[#193c2c]/45">
                Longitude
              </p>
              <p className="mt-2 break-all text-sm font-medium">
                {longitude.toFixed(6)}
              </p>
            </div>
          </div>
        )}

        <div className="mt-6 max-w-sm">
          <label
            htmlFor="search-radius"
            className="mb-2 block text-sm font-medium text-[#193c2c]/75"
          >
            Search radius
          </label>

          <select
            id="search-radius"
            value={radius}
            onChange={(event) => setRadius(Number(event.target.value))}
            className="w-full rounded-xl border border-[#193c2c]/15 bg-[#f8f7f2] px-4 py-3 text-sm text-[#193c2c] outline-none transition focus:border-[#bd7148]"
          >
            <option value={5000}>5 km</option>
            <option value={10000}>10 km</option>
            <option value={20000}>20 km</option>
            <option value={50000}>50 km</option>
          </select>
        </div>
      </div>

      {error && <MessageBox type="error">{error}</MessageBox>}
      {requestMessage && (
        <MessageBox type="success">{requestMessage}</MessageBox>
      )}
      {requestError && (
        <MessageBox type="error">{requestError}</MessageBox>
      )}

      {/* MAP */}
      {position && (
        <div className="mt-10">
          <SectionHeading
            eyebrow="Explore the area"
            title="Donation map."
            description="Select a food marker to view the donation and its driving route from your current location."
          />

          <div className="mt-5 overflow-hidden rounded-3xl border border-[#193c2c]/10 bg-white p-2">
            <div className="overflow-hidden rounded-[1.35rem]" style={{ height: 460 }}>
              <MapContainer
                center={position}
                zoom={14}
                scrollWheelZoom
                style={{ height: "100%", width: "100%" }}
              >
                <TileLayer
                  attribution="&copy; OpenStreetMap contributors"
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                <MapView
                  organizationPosition={position}
                  selectedFoodPosition={selectedFoodPosition}
                />

                <Marker position={position} icon={organizationIcon}>
                  <Popup>
                    <strong>Your organization</strong>
                    <p className="mt-1 text-xs text-gray-500">
                      Current GPS location
                    </p>
                  </Popup>
                </Marker>

                <Circle
                  center={position}
                  radius={radius}
                  pathOptions={{
                    color: GREEN,
                    weight: 1.5,
                    fillColor: GREEN,
                    fillOpacity: 0.06,
                  }}
                />

                {donations.map((donation) => {
                  const coordinates = getDonationCoordinates(donation);
                  if (!coordinates) return null;

                  return (
                    <Marker
                      key={donation._id}
                      position={coordinates}
                      icon={foodIcon}
                      eventHandlers={{
                        click: () => setSelectedFood(donation),
                      }}
                    >
                      <Popup>
                        <div className="min-w-[200px]">
                          <strong>{donation.eventName}</strong>
                          <p className="mt-2 text-xs text-gray-500">
                            {donation.foodDescription}
                          </p>

                          {donation.distanceKm !== undefined && (
                            <p className="mt-2 text-xs">
                              Distance: {donation.distanceKm} km
                            </p>
                          )}

                          <button
                            type="button"
                            onClick={() => setSelectedFood(donation)}
                            className="mt-3 text-xs font-medium text-[#bd7148]"
                          >
                            Show route →
                          </button>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}

                {selectedFoodPosition && (
                  <FoodRoute from={position} to={selectedFoodPosition} />
                )}
              </MapContainer>
            </div>
          </div>
        </div>
      )}

      {/* DONATION LIST */}
      <div className="mt-10">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-[#bd7148]">
              Food opportunities
            </p>
            <h3 className="mt-2 text-2xl font-medium tracking-tight md:text-3xl">
              Nearby donations
              <span className="font-serif italic text-[#bd7148]">.</span>
            </h3>
          </div>

          {position && !loading && (
            <p className="text-sm text-[#193c2c]/50">
              {donations.length} donation{donations.length === 1 ? "" : "s"} found
            </p>
          )}
        </div>

        {loading && (
          <div className="rounded-3xl border border-[#193c2c]/10 bg-white/60 p-8">
            <p className="text-sm text-[#193c2c]/60">
              Finding nearby food...
            </p>
          </div>
        )}

        {!position && !loading && (
          <EmptyState
            title="Your location is needed."
            description='Select "Use my current location" to find food donations near your organization.'
          />
        )}

        {position && !loading && donations.length === 0 && !error && (
          <EmptyState
            title="No available food found nearby."
            description="Try increasing your search radius to discover more donations."
          />
        )}

        <div className="grid gap-5 md:grid-cols-2">
          {donations.map((donation) => {
            const coordinates = getDonationCoordinates(donation);

            return (
              <div
                key={donation._id}
                className={`rounded-3xl border bg-white/60 p-6 transition duration-200 hover:bg-white md:p-7 ${
                  selectedFood?._id === donation._id
                    ? "border-[#bd7148] shadow-md"
                    : "border-[#193c2c]/10 hover:border-[#193c2c]/20 hover:shadow-sm"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-[#bd7148]">
                      Food donation
                    </p>
                    <h3 className="mt-3 text-2xl font-medium tracking-tight">
                      {donation.eventName}
                    </h3>
                  </div>

                  <span className="shrink-0 rounded-full bg-[#e8eee6] px-3 py-1.5 text-[10px] font-medium uppercase tracking-wide text-[#193c2c]">
                    {donation.status || "AVAILABLE"}
                  </span>
                </div>

                <div className="mt-6 space-y-3 text-sm leading-6 text-[#193c2c]/65">
                  <p>
                    <strong className="font-medium text-[#193c2c]">Event:</strong>{" "}
                    {donation.eventType}
                  </p>
                  <p>
                    <strong className="font-medium text-[#193c2c]">Food:</strong>{" "}
                    {donation.foodDescription}
                  </p>
                  <p>
                    <strong className="font-medium text-[#193c2c]">Food type:</strong>{" "}
                    {donation.foodType}
                  </p>
                  <p>
                    <strong className="font-medium text-[#193c2c]">Quantity:</strong>{" "}
                    {donation.quantity}
                  </p>
                  <p>
                    <strong className="font-medium text-[#193c2c]">Pickup:</strong>{" "}
                    {donation.pickupLocation}
                  </p>

                  {donation.distanceKm !== undefined && (
                    <p>
                      <strong className="font-medium text-[#193c2c]">Distance:</strong>{" "}
                      {donation.distanceKm} km
                    </p>
                  )}
                </div>

                {coordinates && (
                  <div className="mt-5 rounded-2xl bg-[#f8f7f2] p-4">
                    <p className="text-sm font-medium">Food location</p>
                    <a
                      href={`https://www.google.com/maps?q=${coordinates[0]},${coordinates[1]}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block text-xs font-medium text-[#bd7148] transition hover:text-[#193c2c]"
                    >
                      Open in Google Maps →
                    </a>
                  </div>
                )}

                <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => setSelectedFood(donation)}
                    className="flex-1 rounded-full border border-[#193c2c]/15 px-4 py-3 text-sm transition hover:border-[#193c2c] hover:bg-[#193c2c] hover:text-white"
                  >
                    View on Map
                  </button>

                  <button
                    type="button"
                    onClick={() => requestFood(donation)}
                    disabled={requestLoading === donation._id}
                    className="flex-1 rounded-full bg-[#193c2c] px-4 py-3 text-sm text-white transition hover:bg-[#bd7148] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {requestLoading === donation._id
                      ? "Requesting..."
                      : "Request Food"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ================= MY REQUESTS ================= */

function MyRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(null);
  const [trackingId, setTrackingId] = useState(null);
  const [trackingVersion, setTrackingVersion] = useState(0);
  const [trackingMessage, setTrackingMessage] = useState("");
  const [trackingError, setTrackingError] = useState("");

  const watchIds = useRef({});
  const requestsRef = useRef([]);

  useEffect(() => {
    requestsRef.current = requests;
  }, [requests]);

  const stopTracking = useCallback((requestId) => {
    const watchId = watchIds.current[requestId];

    if (watchId !== undefined) {
      navigator.geolocation.clearWatch(watchId);
      delete watchIds.current[requestId];
      setTrackingVersion((version) => version + 1);
    }
  }, []);

  useEffect(() => {
    return () => {
      Object.values(watchIds.current).forEach((watchId) => {
        navigator.geolocation.clearWatch(watchId);
      });
      watchIds.current = {};
    };
  }, []);

  /* ================= LOAD REQUESTS ================= */

  const loadRequests = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setError("");

      const token = localStorage.getItem("token");
      const organizationId = localStorage.getItem("organizationId");

      if (!token || !organizationId) {
        throw new Error(
          "Please log in as an organization. Your session or organization ID is missing."
        );
      }

      const data = await apiRequest(
        `/api/requests/organization/${encodeURIComponent(organizationId)}`
      );

      const items = Array.isArray(data)
        ? data
        : Array.isArray(data.requests)
          ? data.requests
          : [];

      setRequests(items);
    } catch (err) {
      console.error("LOAD REQUESTS ERROR:", err);
      setError(err.message);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();

    const interval = setInterval(() => {
      loadRequests(false);
    }, 10000);

    return () => clearInterval(interval);
  }, [loadRequests]);

  /* ================= UPDATE LIVE LOCATION ================= */

  async function sendLocation(requestId, latitude, longitude) {
    const data = await apiRequest(`/api/requests/${requestId}/location`, {
      method: "PATCH",
      body: JSON.stringify({ latitude, longitude }),
    });

    setRequests((current) =>
      current.map((request) =>
        request._id === requestId
          ? {
              ...request,
              ...(data.request || {}),
              pickupLocation:
                data.request?.pickupLocation || {
                  latitude,
                  longitude,
                },
              lastLocationUpdate:
                data.request?.lastLocationUpdate ||
                new Date().toISOString(),
            }
          : request
      )
    );
  }

  /* ================= START GPS WATCHER ================= */

  function startLiveTracking(requestId) {
    if (watchIds.current[requestId] !== undefined) return;

    if (!navigator.geolocation) {
      setTrackingError("Geolocation is not supported by your browser.");
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      async ({ coords }) => {
        try {
          await sendLocation(
            requestId,
            coords.latitude,
            coords.longitude
          );
          setTrackingError("");
        } catch (err) {
          console.error("LIVE LOCATION ERROR:", err);
          setTrackingError(err.message);
        }
      },
      (err) => {
        const messages = {
          1: "Location permission was denied. Please allow location access.",
          2: "Your location could not be determined.",
          3: "GPS update timed out. Waiting for another update...",
        };

        setTrackingError(
          messages[err.code] || "Live location could not be updated."
        );
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 10000,
      }
    );

    watchIds.current[requestId] = watchId;
    setTrackingVersion((version) => version + 1);
  }

  /* ================= START PICKUP ================= */

  function startPickup(request) {
    setTrackingError("");
    setTrackingMessage("");

    if (!navigator.geolocation) {
      setTrackingError("Geolocation is not supported by your browser.");
      return;
    }

    if (watchIds.current[request._id] !== undefined) {
      setTrackingMessage("Live tracking is already active.");
      return;
    }

    setTrackingId(request._id);

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const data = await apiRequest(
            `/api/requests/${request._id}/start-pickup`,
            {
              method: "PATCH",
              body: JSON.stringify({
                latitude: coords.latitude,
                longitude: coords.longitude,
              }),
            }
          );

          setRequests((current) =>
            current.map((item) =>
              item._id === request._id
                ? {
                    ...item,
                    ...(data.request || {}),
                    status: data.request?.status || "PICKUP_STARTED",
                  }
                : item
            )
          );

          setTrackingMessage(
            data.message || "Pickup started successfully."
          );

          startLiveTracking(request._id);
        } catch (err) {
          console.error("START PICKUP ERROR:", err);
          setTrackingError(err.message);
        } finally {
          setTrackingId(null);
        }
      },
      (err) => {
        const messages = {
          1: "Location permission was denied.",
          2: "Your location could not be determined.",
          3: "Location request timed out. Please try again.",
        };

        setTrackingError(
          messages[err.code] || "Unable to get your current location."
        );
        setTrackingId(null);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  /* ================= RESUME TRACKING ================= */

  function resumeTracking(request) {
    setTrackingError("");
    setTrackingMessage("Live location tracking resumed.");
    startLiveTracking(request._id);
  }

  /* ================= COLLECT / COMPLETE ================= */

  async function updateRequestStatus(request, action) {
    setActionLoading(`${request._id}-${action}`);
    setTrackingError("");
    setTrackingMessage("");

    try {
      const data = await apiRequest(
        `/api/requests/${request._id}/${action}`,
        { method: "PATCH" }
      );

      const fallbackStatus =
        action === "collect" ? "COLLECTED" : "COMPLETED";

      setRequests((current) =>
        current.map((item) =>
          item._id === request._id
            ? {
                ...item,
                ...(data.request || {}),
                status: data.request?.status || fallbackStatus,
              }
            : item
        )
      );

      stopTracking(request._id);

      setTrackingMessage(
        data.message ||
          (action === "collect"
            ? "Donation marked as collected."
            : "Donation completed successfully.")
      );

      await loadRequests(false);
    } catch (err) {
      console.error(`${action.toUpperCase()} REQUEST ERROR:`, err);
      setTrackingError(err.message);
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <section>
      <SectionHeading
        eyebrow="Your activity"
        title="My requests."
        description="Track food donations requested by your organization, follow collection progress, and manage live pickup updates."
      />

      {trackingMessage && (
        <MessageBox type="success">{trackingMessage}</MessageBox>
      )}

      {trackingError && (
        <MessageBox type="error">{trackingError}</MessageBox>
      )}

      {loading && (
        <div className="mt-8 rounded-3xl border border-[#193c2c]/10 bg-white/60 p-6">
          <p className="text-sm text-[#193c2c]/55">
            Loading your requests...
          </p>
        </div>
      )}

      {error && <MessageBox type="error">{error}</MessageBox>}

      {!loading && !error && requests.length === 0 && (
        <EmptyState
          title="No requests yet."
          description="When your organization requests food donations, they will appear here."
        />
      )}

      <div className="mt-9 grid gap-5 md:grid-cols-2">
        {requests.map((request) => {
          const donation = request.donationId;
          const trackingActive =
            trackingVersion >= 0 &&
            watchIds.current[request._id] !== undefined;

          const pickupCoordinates = getCoordinates(
            request.pickupLocation
          );

          const isBusy =
            trackingId === request._id ||
            actionLoading === `${request._id}-collect` ||
            actionLoading === `${request._id}-complete`;

          const statusClasses = {
            REQUESTED: "bg-amber-50 text-amber-800",
            ACCEPTED: "bg-[#e8eee6] text-[#193c2c]",
            REJECTED: "bg-red-50 text-red-700",
            PICKUP_STARTED: "bg-[#f8e9df] text-[#98552f]",
            COLLECTED: "bg-blue-50 text-blue-800",
            COMPLETED: "bg-emerald-50 text-emerald-800",
          };

          return (
            <div
              key={request._id}
              className="rounded-3xl border border-[#193c2c]/10 bg-white/60 p-6 transition hover:bg-white hover:shadow-sm md:p-7"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-[#bd7148]">
                    Food request
                  </p>
                  <h3 className="mt-3 text-2xl font-medium tracking-tight">
                    {donation?.eventName || "Food Donation"}
                  </h3>
                </div>

                <span
                  className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-medium uppercase tracking-wide ${
                    statusClasses[request.status] ||
                    "bg-[#e8eee6] text-[#193c2c]"
                  }`}
                >
                  {(request.status || "REQUESTED").replace(/_/g, " ")}
                </span>
              </div>

              {donation && (
                <div className="mt-6 space-y-3 text-sm leading-6 text-[#193c2c]/65">
                  <p>
                    <strong className="font-medium text-[#193c2c]">Food:</strong>{" "}
                    {donation.foodDescription}
                  </p>
                  <p>
                    <strong className="font-medium text-[#193c2c]">Food type:</strong>{" "}
                    {donation.foodType}
                  </p>
                  <p>
                    <strong className="font-medium text-[#193c2c]">Quantity:</strong>{" "}
                    {donation.quantity}
                  </p>
                  <p>
                    <strong className="font-medium text-[#193c2c]">Pickup:</strong>{" "}
                    {donation.pickupLocation}
                  </p>

                  {getDonationCoordinates(donation) && (
                    <a
                      href={`https://www.google.com/maps?q=${getDonationCoordinates(donation).join(",")}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-block text-xs font-medium text-[#bd7148] transition hover:text-[#193c2c]"
                    >
                      Open organizer's food location →
                    </a>
                  )}
                </div>
              )}

              {request.status === "REQUESTED" && (
                <div className="mt-7 rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-800">
                  Waiting for the organizer to accept your request.
                </div>
              )}

              {request.status === "ACCEPTED" && (
                <div className="mt-7">
                  <p className="mb-4 text-sm leading-6 text-[#193c2c]/55">
                    Your request has been accepted. Start pickup to share your
                    live location.
                  </p>

                  <button
                    type="button"
                    onClick={() => startPickup(request)}
                    disabled={isBusy}
                    className="w-full rounded-full bg-[#193c2c] px-5 py-3.5 text-sm text-white transition hover:bg-[#bd7148] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {trackingId === request._id
                      ? "Starting pickup..."
                      : "Start Pickup"}
                  </button>
                </div>
              )}

              {request.status === "PICKUP_STARTED" && (
                <div className="mt-7 space-y-3">
                  {trackingActive ? (
                    <div className="rounded-2xl border border-[#193c2c]/10 bg-[#e8eee6] p-4 text-sm text-[#193c2c]">
                      <p className="font-medium">Live tracking active</p>
                      <p className="mt-1 text-xs leading-5 text-[#193c2c]/65">
                        Your GPS position is being sent to the backend.
                      </p>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => resumeTracking(request)}
                      disabled={isBusy}
                      className="w-full rounded-full border border-[#193c2c]/15 px-5 py-3.5 text-sm transition hover:border-[#193c2c] hover:bg-[#193c2c] hover:text-white disabled:opacity-50"
                    >
                      Resume Live Tracking
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => updateRequestStatus(request, "collect")}
                    disabled={isBusy}
                    className="w-full rounded-full bg-[#193c2c] px-5 py-3.5 text-sm text-white transition hover:bg-[#bd7148] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {actionLoading === `${request._id}-collect`
                      ? "Updating..."
                      : "Mark as Collected"}
                  </button>
                </div>
              )}

              {request.status === "COLLECTED" && (
                <div className="mt-7">
                  <p className="mb-4 rounded-2xl bg-blue-50 p-4 text-sm leading-6 text-blue-800">
                    Food has been collected. Complete the request when the
                    handover is finished.
                  </p>

                  <button
                    type="button"
                    onClick={() => updateRequestStatus(request, "complete")}
                    disabled={isBusy}
                    className="w-full rounded-full bg-[#193c2c] px-5 py-3.5 text-sm text-white transition hover:bg-[#bd7148] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {actionLoading === `${request._id}-complete`
                      ? "Updating..."
                      : "Mark as Completed"}
                  </button>
                </div>
              )}

              {request.status === "COMPLETED" && (
                <div className="mt-7 rounded-2xl bg-[#e8eee6] p-4 text-sm leading-6 text-[#193c2c]">
                  ✓ This food request has been completed.
                </div>
              )}

              {request.status === "REJECTED" && (
                <div className="mt-7 rounded-2xl bg-red-50 p-4 text-sm leading-6 text-red-700">
                  This request was rejected by the organizer.
                </div>
              )}

              {pickupCoordinates && (
                <div className="mt-5 rounded-2xl border border-[#193c2c]/10 bg-[#f8f7f2] p-4 text-xs text-[#193c2c]/60">
                  <p className="font-medium text-[#193c2c]">
                    Last shared pickup location
                  </p>
                  <p className="mt-3 break-all">
                    Latitude: {pickupCoordinates[0]}
                  </p>
                  <p className="mt-2 break-all">
                    Longitude: {pickupCoordinates[1]}
                  </p>

                  {request.lastLocationUpdate && (
                    <p className="mt-3 text-[#193c2c]/45">
                      Last updated:{" "}
                      {new Date(
                        request.lastLocationUpdate
                      ).toLocaleTimeString()}
                    </p>
                  )}

                  <a
                    href={`https://www.google.com/maps?q=${pickupCoordinates.join(",")}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-block font-medium text-[#bd7148] transition hover:text-[#193c2c]"
                  >
                    View shared location →
                  </a>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ================= REUSABLE COMPONENTS ================= */

function DashboardButton({ children, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-5 py-3 text-sm transition duration-200 ${
        active
          ? "bg-[#193c2c] text-white"
          : "border border-[#193c2c]/15 bg-transparent text-[#193c2c]/65 hover:border-[#193c2c] hover:text-[#193c2c]"
      }`}
    >
      {children}
    </button>
  );
}

function DashboardCard({
  symbol,
  number,
  title,
  description,
  action,
  onClick,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group min-h-[300px] rounded-3xl border border-[#193c2c]/10 bg-white/60 p-7 text-left transition duration-300 hover:-translate-y-1 hover:border-[#193c2c]/20 hover:bg-white hover:shadow-sm md:p-9"
    >
      <div className="flex h-full flex-col justify-between">
        <div className="flex items-start justify-between">
          <span className="text-4xl font-light text-[#bd7148]">
            {symbol}
          </span>
          <span className="text-xs tracking-[0.2em] text-[#193c2c]/35">
            {number}
          </span>
        </div>

        <div className="mt-12">
          <h2 className="text-2xl font-medium tracking-tight md:text-3xl">
            {title}
            <span className="font-serif italic text-[#bd7148]">.</span>
          </h2>

          <p className="mt-4 max-w-sm text-sm leading-7 text-[#193c2c]/60">
            {description}
          </p>
        </div>

        <div className="mt-8 flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-[#193c2c] transition group-hover:text-[#bd7148]">
            {action}
          </span>
          <span className="text-lg text-[#bd7148] transition-transform group-hover:translate-x-1">
            →
          </span>
        </div>
      </div>
    </button>
  );
}

function SectionHeading({ eyebrow, title, description }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-[0.25em] text-[#bd7148]">
        {eyebrow}
      </p>

      <h2 className="mt-4 text-4xl font-medium leading-tight tracking-[-0.045em] md:text-6xl">
        {title.endsWith(".") ? title.slice(0, -1) : title}
        <span className="font-serif italic text-[#bd7148]">.</span>
      </h2>

      <p className="mt-4 max-w-xl text-sm leading-7 text-[#193c2c]/60 md:text-base">
        {description}
      </p>
    </div>
  );
}

function MessageBox({ type = "error", children }) {
  const styles =
    type === "success"
      ? "border border-[#193c2c]/10 bg-[#e8eee6] text-[#193c2c]"
      : "border border-red-200 bg-red-50 text-red-700";

  return (
    <div className={`mt-6 rounded-2xl p-4 text-sm leading-6 ${styles}`}>
      {children}
    </div>
  );
}

function EmptyState({ title, description }) {
  return (
    <div className="mt-8 rounded-3xl border border-dashed border-[#193c2c]/20 bg-white/50 p-8 md:p-10">
      <p className="text-xl font-medium tracking-tight">
        {title}
      </p>
      <p className="mt-3 max-w-lg text-sm leading-7 text-[#193c2c]/55">
        {description}
      </p>
    </div>
  );
}

export default OrganizationDashboard;
