
import express from "express";
import mongoose from "mongoose";
import Request from "../models/Request.js";
import Donation from "../models/Donation.js";

const router = express.Router();

// ================= CREATE FOOD REQUEST =================

router.post("/", async (req, res) => {
  try {
    const { donationId, organizationId } = req.body;

    if (
      !mongoose.isValidObjectId(donationId) ||
      !mongoose.isValidObjectId(organizationId)
    ) {
      return res.status(400).json({
        message: "Valid donation ID and organization ID are required.",
      });
    }

    const donation = await Donation.findById(donationId);

    if (!donation) {
      return res.status(404).json({ message: "Donation not found." });
    }

    if (donation.status !== "AVAILABLE") {
      return res.status(400).json({
        message: "This donation is no longer available.",
      });
    }

    const existingRequest = await Request.findOne({
      donationId,
      organizationId,
      status: { $ne: "REJECTED" },
    });

    if (existingRequest) {
      return res.status(409).json({
        message: "Your organization has already requested this donation.",
      });
    }

    const foodRequest = await Request.create({
      donationId,
      organizationId,
      organizerId: donation.organizerId,
      status: "REQUESTED",
    });

    donation.status = "REQUESTED";
    await donation.save();

    return res.status(201).json({
      message: "Food request submitted successfully.",
      request: foodRequest,
    });
  } catch (error) {
    console.error("CREATE FOOD REQUEST ERROR:", error);
    return res.status(500).json({
      message: error.message || "Failed to create request.",
    });
  }
});

// ================= GET ORGANIZER REQUESTS =================

router.get("/organizer/:organizerId", async (req, res) => {
  try {
    const { organizerId } = req.params;

    if (!mongoose.isValidObjectId(organizerId)) {
      return res.status(400).json({ message: "Invalid organizer ID." });
    }

    const requests = await Request.find({ organizerId })
      .populate("donationId")
      .populate("organizationId")
      .sort({ createdAt: -1 });

    return res.status(200).json(requests);
  } catch (error) {
    console.error("GET ORGANIZER REQUESTS ERROR:", error);
    return res.status(500).json({
      message: error.message || "Failed to load organizer requests.",
    });
  }
});

// ================= GET ORGANIZATION REQUESTS =================

router.get("/organization/:organizationId", async (req, res) => {
  try {
    const { organizationId } = req.params;

    if (!mongoose.isValidObjectId(organizationId)) {
      return res.status(400).json({ message: "Invalid organization ID." });
    }

    const requests = await Request.find({ organizationId })
      .populate("donationId")
      .populate("organizationId")
      .sort({ createdAt: -1 });

    return res.status(200).json(requests);
  } catch (error) {
    console.error("GET ORGANIZATION REQUESTS ERROR:", error);
    return res.status(500).json({
      message: error.message || "Failed to load organization requests.",
    });
  }
});

// ================= ACCEPT REQUEST =================

router.patch("/:requestId/accept", async (req, res) => {
  try {
    const foodRequest = await Request.findById(req.params.requestId);

    if (!foodRequest) {
      return res.status(404).json({ message: "Food request not found." });
    }

    if (foodRequest.status !== "REQUESTED") {
      return res.status(400).json({
        message: "This request cannot be accepted.",
      });
    }

    foodRequest.status = "ACCEPTED";
    foodRequest.acceptedAt = new Date();
    await foodRequest.save();

    return res.status(200).json({
      message: "Food request accepted.",
      request: foodRequest,
    });
  } catch (error) {
    console.error("ACCEPT REQUEST ERROR:", error);
    return res.status(500).json({
      message: error.message || "Failed to accept request.",
    });
  }
});

// ================= REJECT REQUEST =================

router.patch("/:requestId/reject", async (req, res) => {
  try {
    const foodRequest = await Request.findById(req.params.requestId);

    if (!foodRequest) {
      return res.status(404).json({ message: "Food request not found." });
    }

    if (foodRequest.status !== "REQUESTED") {
      return res.status(400).json({
        message: "Only pending requests can be rejected.",
      });
    }

    foodRequest.status = "REJECTED";
    await foodRequest.save();

    const donation = await Donation.findById(foodRequest.donationId);

    if (donation && donation.status === "REQUESTED") {
      donation.status = "AVAILABLE";
      await donation.save();
    }

    return res.status(200).json({
      message: "Food request rejected.",
      request: foodRequest,
    });
  } catch (error) {
    console.error("REJECT REQUEST ERROR:", error);
    return res.status(500).json({
      message: error.message || "Failed to reject request.",
    });
  }
});

// ================= START PICKUP =================

router.patch("/:requestId/start-pickup", async (req, res) => {
  try {
    const { latitude, longitude } = req.body;

    if (
      typeof latitude !== "number" ||
      typeof longitude !== "number" ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return res.status(400).json({
        message: "Valid pickup GPS coordinates are required.",
      });
    }

    const foodRequest = await Request.findById(req.params.requestId);

    if (!foodRequest) {
      return res.status(404).json({ message: "Food request not found." });
    }

    if (foodRequest.status !== "ACCEPTED") {
      return res.status(400).json({
        message: "Only accepted requests can start pickup.",
      });
    }

    foodRequest.status = "PICKUP_STARTED";
    foodRequest.pickupStartedAt = new Date();
    foodRequest.pickupLocation = {
      type: "Point",
      coordinates: [longitude, latitude],
    };
    foodRequest.lastLocationUpdate = new Date();

    await foodRequest.save();

    return res.status(200).json({
      message: "Pickup started. Live location tracking is active.",
      request: foodRequest,
    });
  } catch (error) {
    console.error("START PICKUP ERROR:", error);
    return res.status(500).json({
      message: error.message || "Failed to start pickup.",
    });
  }
});

// ================= UPDATE LIVE LOCATION =================

router.patch("/:requestId/location", async (req, res) => {
  try {
    const { latitude, longitude } = req.body;

    if (
      typeof latitude !== "number" ||
      typeof longitude !== "number" ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return res.status(400).json({
        message: "Valid GPS coordinates are required.",
      });
    }

    const foodRequest = await Request.findById(req.params.requestId);

    if (!foodRequest) {
      return res.status(404).json({ message: "Food request not found." });
    }

    if (foodRequest.status !== "PICKUP_STARTED") {
      return res.status(400).json({
        message: "Live location can only be updated during pickup.",
      });
    }

    foodRequest.pickupLocation = {
      type: "Point",
      coordinates: [longitude, latitude],
    };
    foodRequest.lastLocationUpdate = new Date();

    await foodRequest.save();

    return res.status(200).json({
      message: "Pickup location updated.",
      request: foodRequest,
    });
  } catch (error) {
    console.error("UPDATE LOCATION ERROR:", error);
    return res.status(500).json({
      message: error.message || "Failed to update pickup location.",
    });
  }
});

// ================= MARK AS COLLECTED =================

router.patch("/:requestId/collect", async (req, res) => {
  try {
    const foodRequest = await Request.findById(req.params.requestId);

    if (!foodRequest) {
      return res.status(404).json({ message: "Food request not found." });
    }

    if (foodRequest.status !== "PICKUP_STARTED") {
      return res.status(400).json({
        message: "Start pickup before marking food as collected.",
      });
    }

    foodRequest.status = "COLLECTED";
    foodRequest.collectedAt = new Date();
    await foodRequest.save();

    return res.status(200).json({
      message: "Food marked as collected.",
      request: foodRequest,
    });
  } catch (error) {
    console.error("COLLECT REQUEST ERROR:", error);
    return res.status(500).json({
      message: error.message || "Failed to mark food as collected.",
    });
  }
});

// ================= COMPLETE REQUEST =================

router.patch("/:requestId/complete", async (req, res) => {
  try {
    const foodRequest = await Request.findById(req.params.requestId);

    if (!foodRequest) {
      return res.status(404).json({ message: "Food request not found." });
    }

    if (foodRequest.status !== "COLLECTED") {
      return res.status(400).json({
        message: "Only collected requests can be completed.",
      });
    }

    foodRequest.status = "COMPLETED";
    foodRequest.completedAt = new Date();
    await foodRequest.save();

    return res.status(200).json({
      message: "Food request completed successfully.",
      request: foodRequest,
    });
  } catch (error) {
    console.error("COMPLETE REQUEST ERROR:", error);
    return res.status(500).json({
      message: error.message || "Failed to complete request.",
    });
  }
});

export default router;
