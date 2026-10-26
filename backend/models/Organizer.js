
import mongoose from "mongoose";

const OrganizerSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    eventCompany: {
      type: String,
      default: null,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const Organizer =
  mongoose.models.Organizer ||
  mongoose.model("Organizer", OrganizerSchema);

export default Organizer;
