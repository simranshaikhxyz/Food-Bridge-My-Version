
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  MapContainer,
  TileLayer,
  Marker,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const API_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:5000"
).replace(/\/+$/, "");

const markerIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

function getOrganizerId() {
  const directId = localStorage.getItem("organizerId");
  if (directId && directId !== "undefined" && directId !== "null") {
    return directId;
  }

  // Support common login storage formats.
  for (const key of ["userInfo", "user", "organizer"]) {
    try {
      const saved = JSON.parse(localStorage.getItem(key) || "null");
      const id =
        saved?.organizerId ||
        saved?.organizer?._id ||
        saved?.user?.organizerId ||
        saved?.user?._id ||
        saved?._id ||
        saved?.id;

      if (id && id !== "undefined" && id !== "null") return id;
    } catch {
      // Ignore values that are not JSON.
    }
  }

  return null;
}

function authHeaders() {
  const token = localStorage.getItem("token");
  if (!token) throw new Error("Please login again.");

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

async function readResponse(response) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const details = data.missingFields?.length
      ? ` Missing fields: ${data.missingFields.join(", ")}.`
      : "";

    throw new Error(
      (data.message || "The request failed.") + details
    );
  }

  return data;
}

function MapCenter({ location }) {
  const map = useMap();

  useEffect(() => {
    if (location) {
      map.setView([location.latitude, location.longitude], 15);
    }
  }, [location, map]);

  return null;
}

function MapClick({ onSelect }) {
  useMapEvents({
    click(e) {
      onSelect({
        latitude: e.latlng.lat,
        longitude: e.latlng.lng,
      });
    },
  });

  return null;
}

/* ================= DASHBOARD ================= */

function OrganizerDashboard() {
  const [section, setSection] = useState("overview");
  const navigate = useNavigate();

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("organizerId");
    navigate("/auth");
  }

  const tabs = [
    ["overview", "Overview"],
    ["post", "Post Food"],
    ["donations", "My Donations"],
    ["requests", "Requests"],
  ];

  return (
    <main className="min-h-screen bg-[#f8f7f2] text-[#193c2c]">
      <nav className="flex items-center justify-between border-b border-[#193c2c]/10 px-6 py-5 md:px-12 lg:px-16">
        <Link to="/" className="text-2xl font-semibold tracking-tight">
          Food<span className="text-[#bd7148]">Bridge</span>
          <span className="ml-2 hidden text-xs font-normal tracking-[0.2em] text-[#193c2c]/45 sm:inline">
            FOOD REDISTRIBUTION
          </span>
        </Link>

        <button
          onClick={logout}
          className="rounded-full border border-[#193c2c]/15 px-5 py-2.5 text-sm transition hover:bg-[#193c2c] hover:text-white"
        >
          Logout ↗
        </button>
      </nav>

      <div className="mx-auto max-w-7xl px-6 py-12 md:px-12 lg:px-16">
        <p className="text-xs uppercase tracking-[0.3em] text-[#bd7148]">
          Organizer workspace
        </p>

        <h1 className="mt-4 text-5xl font-medium tracking-tight md:text-7xl">
          Your dashboard
          <span className="font-serif italic text-[#bd7148]">.</span>
        </h1>

        <p className="mt-5 max-w-xl text-base leading-8 text-[#193c2c]/65 md:text-lg">
          Share surplus food, manage donations and connect with organizations
          that need it most.
        </p>

        <div className="mt-10 flex flex-wrap gap-2 border-b border-[#193c2c]/15 pb-5">
          {tabs.map(([value, label]) => (
            <DashboardButton
              key={value}
              active={section === value}
              onClick={() => setSection(value)}
            >
              {label}
            </DashboardButton>
          ))}
        </div>

        <div className="mt-10">
          {section === "overview" && <Overview setSection={setSection} />}
          {section === "post" && <PostFood />}
          {section === "donations" && <MyDonations />}
          {section === "requests" && <Requests />}
        </div>

        <footer className="mt-20 border-t border-[#193c2c]/10 py-6 text-xs text-[#193c2c]/45">
          FoodBridge · Connecting surplus food with communities
        </footer>
      </div>
    </main>
  );
}

/* ================= OVERVIEW ================= */

function Overview({ setSection }) {
  const cards = [
    {
      symbol: "+",
      number: "01",
      title: "Post food",
      description: "Share surplus food from your event with organizations.",
      action: "post",
    },
    {
      symbol: "↗",
      number: "02",
      title: "My donations",
      description: "View your donations and check their current status.",
      action: "donations",
    },
    {
      symbol: "✓",
      number: "03",
      title: "Requests",
      description: "Review incoming requests and manage food collection.",
      action: "requests",
    },
  ];

  return (
    <section>
      <SectionHeading
        eyebrow="Your workspace"
        title="Make every meal count."
        description="Choose an action to manage your food redistribution activities."
      />

      <div className="mt-9 grid gap-5 md:grid-cols-3">
        {cards.map((card) => (
          <button
            key={card.action}
            onClick={() => setSection(card.action)}
            className="group min-h-[300px] rounded-3xl border border-[#193c2c]/10 bg-white/60 p-7 text-left transition duration-300 hover:-translate-y-1 hover:bg-white hover:shadow-lg md:p-8"
          >
            <div className="flex items-start justify-between">
              <span className="text-5xl font-light text-[#bd7148]">
                {card.symbol}
              </span>
              <span className="text-xs tracking-widest text-[#193c2c]/35">
                {card.number}
              </span>
            </div>

            <h3 className="mt-16 text-3xl font-medium tracking-tight">
              {card.title}
              <span className="font-serif italic text-[#bd7148]">.</span>
            </h3>

            <p className="mt-3 text-sm leading-7 text-[#193c2c]/60">
              {card.description}
            </p>

            <p className="mt-6 text-sm font-medium transition group-hover:text-[#bd7148]">
              Explore section <span className="ml-1">→</span>
            </p>
          </button>
        ))}
      </div>
    </section>
  );
}

/* ================= POST FOOD ================= */

function PostFood() {
  const initialForm = {
    eventName: "",
    eventType: "",
    foodDescription: "",
    foodType: "",
    quantity: "",
    availableFrom: "",
    availableUntil: "",
    pickupLocation: "",
  };

  const [form, setForm] = useState(initialForm);
  const [location, setLocation] = useState(null);
  const [searchLocation, setSearchLocation] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function change(e) {
    const { name, value } = e.target;

    // Quantity accepts digits only while typing (no minus sign or decimals).
    if (name === "quantity" && value !== "" && !/^\d+$/.test(value)) {
      return;
    }

    // Event name and event type accept letters and spaces only.
    if (
      ["eventName", "eventType"].includes(name) &&
      value !== "" &&
      !/^[a-zA-Z\s]*$/.test(value)
    ) {
      return;
    }

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function searchMapLocation() {
    const query = searchLocation.trim();

    if (!query) {
      setError("Please enter a location to search.");
      return;
    }

    setSearchLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`
      );
      const results = await response.json();

      if (!response.ok) {
        throw new Error("Unable to search for this location.");
      }

      if (!results.length) {
        throw new Error("Location not found. Try a more specific place.");
      }

      const result = results[0];

      setLocation({
        latitude: Number(result.lat),
        longitude: Number(result.lon),
      });

      setForm((current) => ({
        ...current,
        pickupLocation: result.display_name,
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setSearchLoading(false);
    }
  }

  function getLocation() {
    setLocationLoading(true);
    setError("");
    setMessage("");

    if (!navigator.geolocation) {
      setError("Geolocation is not supported by this browser.");
      setLocationLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const selectedLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };

        setLocation(selectedLocation);

        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${selectedLocation.latitude}&lon=${selectedLocation.longitude}`
          );
          const data = await response.json();

          if (data.display_name) {
            setForm((current) => ({
              ...current,
              pickupLocation: data.display_name,
            }));
          }
        } catch {
          // Keep the selected GPS coordinates.
        } finally {
          setLocationLoading(false);
        }
      },
      () => {
        setError("Unable to get your current location.");
        setLocationLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function selectMapLocation(selectedLocation) {
    setLocation(selectedLocation);
    setMessage("");
    setError("");

    setForm((current) => ({
      ...current,
      pickupLocation: `Selected location (${selectedLocation.latitude.toFixed(6)}, ${selectedLocation.longitude.toFixed(6)})`,
    }));
  }

  function handleMarkerDrag(e) {
    const position = e.target.getLatLng();

    selectMapLocation({
      latitude: position.lat,
      longitude: position.lng,
    });
  }

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("Please login as organizer.");

      // The backend requires organizerId explicitly in the JSON body.
      const organizerId = getOrganizerId();

      if (!organizerId) {
        throw new Error(
          "Organizer ID is missing. Please log out, log in again, and check that login saves the organizer ID."
        );
      }

      // Validate required text fields
      const requiredFields = [
        ["Event Name", form.eventName],
        ["Event Type", form.eventType],
        ["Food Description", form.foodDescription],
        ["Food Type", form.foodType],
      ];

      for (const [label, value] of requiredFields) {
        if (!value || !value.trim()) {
          throw new Error(`${label} is required.`);
        }
      }

      // Validate event name and event type: letters and spaces only.
      if (!/^[a-zA-Z\s]+$/.test(form.eventName.trim())) {
        throw new Error("Event Name must contain only letters and spaces.");
      }

      if (!/^[a-zA-Z\s]+$/.test(form.eventType.trim())) {
        throw new Error("Event Type must contain only letters and spaces.");
      }

      // Food description must contain letters and must not be only symbols.
      if (!/[a-zA-Z]/.test(form.foodDescription)) {
        throw new Error("Please enter a valid Food Description.");
      }

      // Validate quantity: positive whole number only (no minus or decimals).
      if (!/^[1-9]\d*$/.test(form.quantity.trim())) {
        throw new Error(
          "Quantity must be a positive whole number. Negative numbers and decimals are not allowed."
        );
      }

      const quantity = Number(form.quantity);

      // Validate availability dates
      if (!form.availableFrom || !form.availableUntil) {
        throw new Error("Please select both availability dates.");
      }

      const availableFrom = new Date(form.availableFrom);
      const availableUntil = new Date(form.availableUntil);

      if (
        Number.isNaN(availableFrom.getTime()) ||
        Number.isNaN(availableUntil.getTime())
      ) {
        throw new Error("Please enter valid availability dates.");
      }

      if (availableUntil <= availableFrom) {
        throw new Error(
          "Available Until must be later than Available From."
        );
      }

      // Validate pickup location
      if (!location) {
        throw new Error(
          "Please select the food pickup location on the map."
        );
      }

      if (
        !form.pickupLocation ||
        !form.pickupLocation.trim()
      ) {
        throw new Error(
          "Please enter or select a pickup location."
        );
      }
      const donationData = {
        ...form,
        organizerId,
        quantity: Number(form.quantity),
        latitude: location.latitude,
        longitude: location.longitude,
      };

      console.log("Submitting donation:", donationData);

      const response = await fetch(`${API_URL}/api/donations`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(donationData),
      });

      const data = await readResponse(response);

      setMessage(data.message || "Food donation posted successfully.");
      setForm({ ...initialForm });
      setSearchLocation("");
      setLocation(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="max-w-5xl">
      <SectionHeading
        eyebrow="New donation"
        title="Share good food."
        description="Provide the food details and choose the exact pickup location on the map."
      />

      <form
        onSubmit={submit}
        className="mt-9 rounded-3xl border border-[#193c2c]/10 bg-white/60 p-6 md:p-10"
      >
        <div className="mb-8 flex items-center gap-3 border-b border-[#193c2c]/10 pb-5">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#193c2c] text-lg text-white">
            01
          </span>
          <div>
            <h3 className="font-medium">Food information</h3>
            <p className="mt-1 text-xs text-[#193c2c]/50">
              Tell organizations what is available.
            </p>
          </div>
        </div>

        <div className="grid gap-x-5 md:grid-cols-2">
          <Input label="Event Name" name="eventName" value={form.eventName} onChange={change} required placeholder="e.g. Community gathering" />
          <Input label="Event Type" name="eventType" value={form.eventType} onChange={change} required placeholder="e.g. Wedding, conference" />

          <div className="mb-5 md:col-span-2">
            <label className="mb-2 block text-sm text-[#193c2c]/70">
              Food Description
            </label>
            <textarea
              name="foodDescription"
              value={form.foodDescription}
              onChange={change}
              required
              rows={3}
              placeholder="Describe the available food..."
              className="w-full resize-y rounded-xl border border-[#193c2c]/15 bg-[#f8f7f2] px-4 py-3 outline-none transition focus:border-[#bd7148]"
            />
          </div>

          <div className="mb-5">
            <label className="mb-2 block text-sm text-[#193c2c]/70">
              Food Type
            </label>
            <select
              name="foodType"
              value={form.foodType}
              onChange={change}
              required
              className="w-full rounded-xl border border-[#193c2c]/15 bg-[#f8f7f2] px-4 py-3 outline-none focus:border-[#bd7148]"
            >
              <option value="">Select food type</option>
              <option value="vegetarian">Vegetarian</option>
              <option value="non_vegetarian">Non-vegetarian</option>
              <option value="both">Both</option>
            </select>
          </div>

          <Input label="Quantity" name="quantity" type="number" value={form.quantity} onChange={change} required placeholder="Enter quantity" />
          <Input label="Available From" name="availableFrom" type="datetime-local" value={form.availableFrom} onChange={change} required />
          <Input label="Available Until" name="availableUntil" type="datetime-local" value={form.availableUntil} onChange={change} required />
        </div>

        <div className="mb-8 mt-5 flex items-center gap-3 border-b border-[#193c2c]/10 pb-5">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#193c2c] text-lg text-white">
            02
          </span>
          <div>
            <h3 className="font-medium">Pickup location</h3>
            <p className="mt-1 text-xs text-[#193c2c]/50">
              Set where the organization should collect the food.
            </p>
          </div>
        </div>

        <div className="mb-5">
          <label className="mb-2 block text-sm text-[#193c2c]/70">
            Search for a location
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              value={searchLocation}
              onChange={(e) => setSearchLocation(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  searchMapLocation();
                }
              }}
              placeholder="Search a street, area or landmark"
              className="min-w-0 flex-1 rounded-xl border border-[#193c2c]/15 bg-[#f8f7f2] px-4 py-3 outline-none focus:border-[#bd7148]"
            />
            <button
              type="button"
              onClick={searchMapLocation}
              disabled={searchLoading}
              className="rounded-xl bg-[#193c2c] px-6 py-3 text-sm text-white transition hover:bg-[#28543e] disabled:opacity-50"
            >
              {searchLoading ? "Searching..." : "Search location"}
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-[#193c2c]/15">
          <MapContainer
            center={[19.076, 72.8777]}
            zoom={11}
            scrollWheelZoom
            className="h-[350px] w-full md:h-[420px]"
          >
            <TileLayer
              attribution="&copy; OpenStreetMap contributors"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapClick onSelect={selectMapLocation} />
            <MapCenter location={location} />
            {location && (
              <Marker
                position={[location.latitude, location.longitude]}
                icon={markerIcon}
                draggable
                eventHandlers={{ dragend: handleMarkerDrag }}
              />
            )}
          </MapContainer>
        </div>

        <div className="mt-4 rounded-2xl bg-[#eeede3] p-5">
          <p className="font-medium">📍 Select the exact pickup point</p>
          <p className="mt-2 text-sm leading-6 text-[#193c2c]/60">
            Search for a place, click on the map, or drag the marker to adjust the pickup location.
          </p>
          <button
            type="button"
            onClick={getLocation}
            disabled={locationLoading}
            className="mt-4 rounded-full border border-[#193c2c]/20 px-5 py-3 text-sm transition hover:bg-[#193c2c] hover:text-white disabled:opacity-50"
          >
            {locationLoading ? "Getting location..." : "◎ Use my current location"}
          </button>

          {location && (
            <div className="mt-4 rounded-xl border border-[#193c2c]/10 bg-white p-4">
              <p className="font-medium text-[#193c2c]">✓ Pickup location selected</p>
              <p className="mt-2 break-words text-sm text-[#193c2c]/60">
                {form.pickupLocation}
              </p>
              <div className="mt-3 grid gap-2 text-xs text-[#193c2c]/65 md:grid-cols-2">
                <p>Latitude: {location.latitude.toFixed(6)}</p>
                <p>Longitude: {location.longitude.toFixed(6)}</p>
              </div>
            </div>
          )}
        </div>

        {error && (
          <p className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">
            {error}
          </p>
        )}
        {message && (
          <p className="mt-5 rounded-xl bg-green-50 p-4 text-sm text-green-800">
            {message}
          </p>
        )}

        <button
          disabled={loading}
          className="mt-7 w-full rounded-full bg-[#193c2c] px-6 py-4 text-sm text-white transition hover:bg-[#28543e] disabled:opacity-50"
        >
          {loading ? "Posting donation..." : "Post food donation →"}
        </button>
      </form>
    </section>
  );
}

/* ================= MY DONATIONS ================= */

function MyDonations() {
  const [donations, setDonations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const id = getOrganizerId();
        if (!id) throw new Error("Organizer ID missing. Please log in again.");

        const response = await fetch(
          `${API_URL}/api/donations/organizer/${id}`,
          { headers: authHeaders() }
        );

        setDonations(await readResponse(response));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  return (
    <section>
      <SectionHeading
        eyebrow="Your activity"
        title="My donations."
        description="Keep track of the food you have shared and its pickup details."
      />
      {loading && <Loading />}
      {error && <ErrorMessage message={error} />}
      {!loading && !error && donations.length === 0 && (
        <EmptyState message="No donations yet. Your food donations will appear here." />
      )}

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        {donations.map((donation) => {
          const coordinates = donation.location?.coordinates;
          return (
            <article key={donation._id} className="rounded-3xl border border-[#193c2c]/10 bg-white/60 p-6 transition hover:bg-white md:p-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-widest text-[#bd7148]">Food donation</p>
                  <h3 className="mt-2 text-2xl font-medium">{donation.eventName}</h3>
                </div>
                <StatusBadge status={donation.status} />
              </div>
              <div className="mt-6 space-y-3 text-sm text-[#193c2c]/65">
                <Detail label="Food" value={donation.foodDescription} />
                <Detail label="Type" value={donation.foodType} />
                <Detail label="Quantity" value={donation.quantity} />
                <Detail label="Pickup" value={donation.pickupLocation} />
              </div>
              {coordinates?.length === 2 && (
                <LocationCard
                  title="Food pickup location"
                  latitude={coordinates[1]}
                  longitude={coordinates[0]}
                  description="These coordinates identify where the food is available."
                />
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

/* ================= REQUESTS ================= */

function Requests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tracking, setTracking] = useState({});
  const [selectedTracking, setSelectedTracking] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const id = getOrganizerId();
        if (!id) throw new Error("Organizer ID missing. Please log in again.");

        const response = await fetch(
          `${API_URL}/api/requests/organizer/${id}`,
          { headers: authHeaders() }
        );

        setRequests(await readResponse(response));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  async function updateRequest(id, action) {
    try {
      const response = await fetch(`${API_URL}/api/requests/${id}/${action}`, {
        method: "PATCH",
        headers: authHeaders(),
      });

      const data = await readResponse(response);

      setRequests((items) =>
        items.map((item) =>
          item._id === id
            ? {
              ...item,
              status: data.request.status,
              acceptedAt: data.request.acceptedAt,
            }
            : item
        )
      );
    } catch (err) {
      alert(err.message);
    }
  }

  async function loadTracking(requestId) {
    try {
      const response = await fetch(
        `${API_URL}/api/requests/${requestId}/tracking`,
        { headers: authHeaders() }
      );

      const data = await readResponse(response);

      setTracking((current) => ({
        ...current,
        [requestId]: data.request || data,
      }));

      setSelectedTracking(requestId);
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <section>
      <SectionHeading
        eyebrow="Incoming"
        title="Food requests."
        description="Review organizations requesting your food and coordinate collection."
      />
      {loading && <Loading />}
      {error && <ErrorMessage message={error} />}
      {!loading && !error && requests.length === 0 && (
        <EmptyState message="No requests yet. New organization requests will appear here." />
      )}

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        {requests.map((request) => {
          const organization = request.organizationId;
          const food = request.donationId;
          const foodCoordinates = food?.location?.coordinates;
          const trackingData = tracking[request._id];
          const liveCoordinates =
            trackingData?.pickupLocation?.coordinates ||
            request.pickupLocation?.coordinates;

          return (
            <article key={request._id} className="rounded-3xl border border-[#193c2c]/10 bg-white/60 p-6 md:p-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-widest text-[#bd7148]">Organization request</p>
                  <h3 className="mt-2 text-2xl font-medium">
                    {organization?.organizationName || "Organization"}
                  </h3>
                </div>
                <StatusBadge status={request.status} />
              </div>

              <div className="mt-6 space-y-3 text-sm text-[#193c2c]/65">
                <Detail label="Type" value={organization?.organizationType || "N/A"} />
                <Detail label="Contact" value={organization?.contactPerson || "N/A"} />
                <Detail label="Phone" value={organization?.phone || "N/A"} />
                <Detail label="Email" value={organization?.email || "N/A"} />
                <Detail label="Address" value={organization?.address || "N/A"} />
              </div>

              {food && (
                <div className="mt-6 rounded-2xl bg-[#eeede3] p-5">
                  <p className="text-xs uppercase tracking-[0.2em] text-[#bd7148]">Requested food</p>
                  <div className="mt-4 space-y-3 text-sm text-[#193c2c]/70">
                    <Detail label="Food" value={food.foodDescription} />
                    <Detail label="Type" value={food.foodType} />
                    <Detail label="Quantity" value={food.quantity} />
                    <Detail label="Pickup" value={food.pickupLocation} />
                  </div>
                  {foodCoordinates?.length === 2 && (
                    <LocationCard
                      title="Food pickup location"
                      latitude={foodCoordinates[1]}
                      longitude={foodCoordinates[0]}
                      description="The location where the food is available for collection."
                    />
                  )}
                </div>
              )}

              {request.status === "REQUESTED" && (
                <div className="mt-6 flex gap-3">
                  <button onClick={() => updateRequest(request._id, "accept")} className="flex-1 rounded-full bg-[#193c2c] px-4 py-3 text-sm text-white transition hover:bg-[#28543e]">
                    Accept request
                  </button>
                  <button onClick={() => updateRequest(request._id, "reject")} className="flex-1 rounded-full border border-[#193c2c]/20 px-4 py-3 text-sm transition hover:border-red-300 hover:bg-red-50 hover:text-red-700">
                    Reject
                  </button>
                </div>
              )}

              {request.status === "ACCEPTED" && (
                <div className="mt-7 border-t border-[#193c2c]/10 pt-6">
                  <p className="text-xs uppercase tracking-[0.2em] text-[#bd7148]">Organization tracking</p>
                  {liveCoordinates?.length === 2 ? (
                    <>
                      <button onClick={() => loadTracking(request._id)} className="mt-4 w-full rounded-full bg-[#193c2c] px-5 py-3 text-sm text-white transition hover:bg-[#28543e]">
                        Refresh live location ↻
                      </button>
                      {selectedTracking === request._id && (
                        <div className="mt-4 rounded-2xl bg-green-50 p-5">
                          <p className="font-medium text-green-800">● Organization location available</p>
                          <p className="mt-3 text-sm text-green-800/70">Latitude: {liveCoordinates[1]}</p>
                          <p className="mt-1 text-sm text-green-800/70">Longitude: {liveCoordinates[0]}</p>
                          {trackingData?.lastLocationUpdate && (
                            <p className="mt-3 text-xs text-green-800/60">
                              Last update: {new Date(trackingData.lastLocationUpdate).toLocaleTimeString()}
                            </p>
                          )}
                          <a href={`https://www.google.com/maps?q=${liveCoordinates[1]},${liveCoordinates[0]}`} target="_blank" rel="noreferrer" className="mt-4 inline-block rounded-full bg-green-800 px-4 py-2 text-xs text-white">
                            Open live location →
                          </a>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="mt-4 rounded-2xl bg-[#eeede3] p-5 text-sm leading-6 text-[#193c2c]/60">
                      Waiting for the organization to start pickup and share its live GPS location.
                    </div>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

/* ================= SHARED COMPONENTS ================= */

function DashboardButton({ children, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-5 py-3 text-sm transition ${active
          ? "bg-[#193c2c] text-white"
          : "border border-[#193c2c]/15 text-[#193c2c]/65 hover:border-[#193c2c] hover:text-[#193c2c]"
        }`}
    >
      {children}
    </button>
  );
}

function SectionHeading({ eyebrow, title, description }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.25em] text-[#bd7148]">{eyebrow}</p>
      <h2 className="mt-4 text-4xl font-medium tracking-tight md:text-5xl">
        {title.endsWith(".") ? (
          <>
            {title.slice(0, -1)}
            <span className="font-serif italic text-[#bd7148]">.</span>
          </>
        ) : title}
      </h2>
      <p className="mt-4 max-w-xl leading-7 text-[#193c2c]/60">{description}</p>
    </div>
  );
}

function Input({
  label,
  name,
  type = "text",
  value,
  onChange,
  placeholder,
  required,
}) {
  return (
    <div className="mb-5">
      <label className="mb-2 block text-sm text-[#193c2c]/70">{label}</label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        min={name === "quantity" ? "1" : undefined}
        step={name === "quantity" ? "1" : undefined}
        className="w-full rounded-xl border border-[#193c2c]/15 bg-[#f8f7f2] px-4 py-3 outline-none transition focus:border-[#bd7148]"
      />
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    ACCEPTED: "bg-green-100 text-green-800",
    REJECTED: "bg-red-100 text-red-700",
    DELIVERED: "bg-green-100 text-green-800",
    COMPLETED: "bg-green-100 text-green-800",
    COLLECTED: "bg-blue-100 text-blue-800",
    REQUESTED: "bg-orange-100 text-orange-800",
    AVAILABLE: "bg-[#eeede3] text-[#193c2c]",
  };

  return (
    <span className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${styles[status] || "bg-[#eeede3] text-[#193c2c]"}`}>
      {status || "UNKNOWN"}
    </span>
  );
}

function Detail({ label, value }) {
  return (
    <div className="flex items-start gap-2">
      <span className="w-20 shrink-0 text-[#193c2c]/45">{label}</span>
      <span className="min-w-0 break-words text-[#193c2c]">{value ?? "N/A"}</span>
    </div>
  );
}

function LocationCard({ title, latitude, longitude, description }) {
  return (
    <div className="mt-5 rounded-2xl border border-[#193c2c]/10 bg-[#f8f7f2] p-4">
      <p className="font-medium">📍 {title}</p>
      <p className="mt-2 text-xs leading-5 text-[#193c2c]/55">{description}</p>
      <div className="mt-3 space-y-1 text-xs text-[#193c2c]/65">
        <p>Latitude: {latitude}</p>
        <p>Longitude: {longitude}</p>
      </div>
      <a
        href={`https://www.google.com/maps?q=${latitude},${longitude}`}
        target="_blank"
        rel="noreferrer"
        className="mt-4 inline-block text-sm font-medium text-[#bd7148] hover:underline"
      >
        Open in Google Maps →
      </a>
    </div>
  );
}

function Loading() {
  return (
    <p className="mt-8 rounded-2xl bg-white/60 p-5 text-sm text-[#193c2c]/60">
      Loading your information...
    </p>
  );
}

function ErrorMessage({ message }) {
  return (
    <p className="mt-8 rounded-xl bg-red-50 p-4 text-sm text-red-700">{message}</p>
  );
}

function EmptyState({ message }) {
  return (
    <div className="mt-8 rounded-2xl border border-dashed border-[#193c2c]/20 bg-white/40 p-8 text-sm text-[#193c2c]/60">
      {message}
    </div>
  );
}

export default OrganizerDashboard;
