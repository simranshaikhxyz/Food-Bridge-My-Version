
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import connectDB from "./config/db.js";
import organizationRoutes from "./routes/organizationRoutes.js";
import organizerRoutes from "./routes/organizerRoutes.js";
import donationRoutes from "./routes/donationRoutes.js";
import requestRoutes from "./routes/requestRoutes.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Allowed frontend origins
const allowedOrigins = [
  process.env.FRONTEND_URL?.trim().replace(/\/+$/, ""),
  "http://localhost:5173",
].filter(Boolean);

// CORS middleware
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests without an Origin header
      if (!origin) {
        return callback(null, true);
      }

      // Allow only configured frontend origins
      const normalizedOrigin = origin.replace(/\/+$/, "");

      if (allowedOrigins.includes(normalizedOrigin)) {
        return callback(null, true);
      }

      console.error("CORS blocked origin:", origin);

      return callback(new Error("Origin not allowed by CORS"));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    optionsSuccessStatus: 204,
  })
);

// Parse JSON requests
app.use(express.json());

// API routes
app.use("/api/organizations", organizationRoutes);
app.use("/api/organizers", organizerRoutes);
app.use("/api/donations", donationRoutes);
app.use("/api/requests", requestRoutes);

// Health check
app.get("/", (req, res) => {
  res.status(200).json({
    message: "FoodBridge backend is running",
  });
});

// Handle unknown routes
app.use((req, res) => {
  res.status(404).json({
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("SERVER ERROR:", err);

  if (res.headersSent) {
    return next(err);
  }

  res.status(err.status || 500).json({
    message:
      err.message === "Origin not allowed by CORS"
        ? "Frontend origin is not allowed"
        : err.status && err.status < 500
          ? err.message
          : "Internal server error",
  });
});

// Connect to MongoDB and start server
const startServer = async () => {
  try {
    await connectDB();

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`FoodBridge server running on port ${PORT}`);
      console.log("Allowed frontend origins:", allowedOrigins);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
