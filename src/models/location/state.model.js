import mongoose from "mongoose";

const { Schema, model } = mongoose;

const stateSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    code: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      uppercase: true,
    },
    // Translations for different languages
    translations: {
      hi: { type: String, trim: true }, // Hindi
      mr: { type: String, trim: true }, // Marathi
      ta: { type: String, trim: true }, // Tamil
      te: { type: String, trim: true }, // Telugu
      bn: { type: String, trim: true }, // Bengali
      gu: { type: String, trim: true }, // Gujarati
      kn: { type: String, trim: true }, // Kannada
      ml: { type: String, trim: true }, // Malayalam
      or: { type: String, trim: true }, // Odia
      pa: { type: String, trim: true }, // Punjabi
    },
    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
    },
  },
  {
    timestamps: true,
  }
);

stateSchema.index({ status: 1 });

export const State = model("State", stateSchema);

