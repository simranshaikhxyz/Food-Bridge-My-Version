
import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import Organization from "../models/Organization.js";

const router = express.Router();

// Register Organization
router.post("/register", async (req, res) => {
  try {
    const {
      organizationName,
      organizationType,
      contactPerson,
      email,
      phone,
      address,
      peopleServed,
      foodPreferences,
      password,
    } = req.body;

    // Validate required fields and input types
    if (
      typeof organizationName !== "string" ||
      !organizationName.trim() ||
      typeof organizationType !== "string" ||
      !organizationType.trim() ||
      typeof contactPerson !== "string" ||
      !contactPerson.trim() ||
      typeof email !== "string" ||
      !email.trim() ||
      typeof phone !== "string" ||
      !phone.trim() ||
      typeof address !== "string" ||
      !address.trim() ||
      typeof password !== "string" ||
      !password
    ) {
      return res.status(400).json({
        message: "Please fill in all required fields correctly",
      });
    }

    // Normalize email
    const normalizedEmail = email.trim().toLowerCase();

    // Check if organization already exists
    const existingOrganization = await Organization.findOne({
      email: normalizedEmail,
    });

    if (existingOrganization) {
      return res.status(409).json({
        message: "An organization with this email already exists",
      });
    }

    // Validate optional fields
    let validatedPeopleServed;

    if (
      peopleServed !== undefined &&
      peopleServed !== null &&
      peopleServed !== ""
    ) {
      validatedPeopleServed = Number(peopleServed);

      if (
        !Number.isSafeInteger(validatedPeopleServed) ||
        validatedPeopleServed < 0
      ) {
        return res.status(400).json({
          message: "People served must be a non-negative whole number",
        });
      }
    }

    if (
      foodPreferences !== undefined &&
      !Array.isArray(foodPreferences)
    ) {
      return res.status(400).json({
        message: "Food preferences must be a list",
      });
    }

    if (
      Array.isArray(foodPreferences) &&
      !foodPreferences.every(
        (item) => typeof item === "string" && item.trim()
      )
    ) {
      return res.status(400).json({
        message: "Food preferences must contain valid text values",
      });
    }

    const validatedFoodPreferences = [
      ...new Set(
        (foodPreferences || []).map((item) => item.trim())
      ),
    ];

    // Hash password before storing it
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create organization
    const organization = await Organization.create({
      organizationName: organizationName.trim(),
      organizationType: organizationType.trim(),
      contactPerson: contactPerson.trim(),
      email: normalizedEmail,
      phone: phone.trim(),
      address: address.trim(),
      peopleServed: validatedPeopleServed ?? null,
      foodPreferences: validatedFoodPreferences,
      password: hashedPassword,
    });

    // Return details without password
    return res.status(201).json({
      message: "Organization registered successfully",
      organization: {
        id: organization._id,
        _id: organization._id,
        organizationName: organization.organizationName,
        organizationType: organization.organizationType,
        contactPerson: organization.contactPerson,
        email: organization.email,
        phone: organization.phone,
        address: organization.address,
        peopleServed: organization.peopleServed,
        foodPreferences: organization.foodPreferences,
      },
    });
  } catch (error) {
    console.error("Organization registration error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        message: "An organization with this email already exists",
      });
    }

    if (error.name === "ValidationError" || error.name === "CastError") {
      return res.status(400).json({
        message: "Please check the organization details",
      });
    }

    return res.status(500).json({
      message: "Server error during organization registration",
    });
  }
});

// Login Organization
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input types
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

    // Find organization
    const organization = await Organization.findOne({
      email: normalizedEmail,
    });

    if (!organization) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    // Compare entered password with stored hash
    const passwordMatches = await bcrypt.compare(
      password,
      organization.password
    );

    if (!passwordMatches) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        id: organization._id.toString(),
        role: "organization",
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    // Return token and organization details
    return res.status(200).json({
      message: "Login successful",
      token,
      organization: {
        id: organization._id,
        _id: organization._id,
        organizationName: organization.organizationName,
        organizationType: organization.organizationType,
        contactPerson: organization.contactPerson,
        email: organization.email,
        phone: organization.phone,
        address: organization.address,
        peopleServed: organization.peopleServed,
        foodPreferences: organization.foodPreferences,
      },
    });
  } catch (error) {
    console.error("Organization login error:", error);

    return res.status(500).json({
      message: "Server error during organization login",
    });
  }
});

export default router;
