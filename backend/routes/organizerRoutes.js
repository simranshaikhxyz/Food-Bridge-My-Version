
import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import Organizer from "../models/Organizer.js";

const router = express.Router();

// Register Organizer
router.post("/register", async (req, res) => {
  try {
    const {
      fullName,
      email,
      phone,
      eventCompany,
      password,
    } = req.body;

    // Validate required fields and input types
    if (
      typeof fullName !== "string" ||
      !fullName.trim() ||
      typeof email !== "string" ||
      !email.trim() ||
      typeof phone !== "string" ||
      !phone.trim() ||
      typeof eventCompany !== "string" ||
      !eventCompany.trim() ||
      typeof password !== "string" ||
      !password
    ) {
      return res.status(400).json({
        message: "All fields are required and must be valid",
      });
    }

    // Normalize email
    const normalizedEmail = email.trim().toLowerCase();

    // Check for an existing organizer
    const existingOrganizer = await Organizer.findOne({
      email: normalizedEmail,
    });

    if (existingOrganizer) {
      return res.status(409).json({
        message: "Organizer with this email already exists",
      });
    }

    // Hash password before storing it
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create organizer
    const organizer = await Organizer.create({
      fullName: fullName.trim(),
      email: normalizedEmail,
      phone: phone.trim(),
      eventCompany: eventCompany.trim(),
      password: hashedPassword,
    });

    // Return organizer details without password
    return res.status(201).json({
      message: "Organizer registered successfully",
      organizer: {
        id: organizer._id,
        fullName: organizer.fullName,
        email: organizer.email,
        phone: organizer.phone,
        eventCompany: organizer.eventCompany,
      },
    });
  } catch (error) {
    console.error("Organizer registration error:", error);

    // Handle duplicate email errors
    if (error.code === 11000) {
      return res.status(409).json({
        message: "Organizer with this email already exists",
      });
    }

    return res.status(500).json({
      message: "Server error during organizer registration",
    });
  }
});

// Login Organizer
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (
      typeof email !== "string" ||
      !email.trim() ||
      typeof password !== "string" ||
      !password
    ) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    // Check JWT secret
    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is missing");

      return res.status(500).json({
        message: "Server authentication is not configured",
      });
    }

    // Normalize email
    const normalizedEmail = email.trim().toLowerCase();

    // Find organizer
    const organizer = await Organizer.findOne({
      email: normalizedEmail,
    });

    if (!organizer) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    // Compare entered password with stored hash
    const passwordMatches = await bcrypt.compare(
      password,
      organizer.password
    );

    if (!passwordMatches) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        id: organizer._id.toString(),
        role: "organizer",
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    // Return token and organizer details without password
    return res.status(200).json({
      message: "Login successful",
      token,
      organizer: {
        id: organizer._id,
        _id: organizer._id,
        fullName: organizer.fullName,
        email: organizer.email,
        phone: organizer.phone,
        eventCompany: organizer.eventCompany,
      },
    });
  } catch (error) {
    console.error("Organizer login error:", error);

    return res.status(500).json({
      message: "Server error during organizer login",
    });
  }
});

export default router;
