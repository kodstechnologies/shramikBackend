import mongoose from "mongoose";

const { Schema, model } = mongoose;

const otpSchema = new Schema(
  {
    phone: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    otp: {
      type: String,
      required: true,
      length: 4,
    },
    expiresAt: {
      type: Date,
      required: true,
     expires: 0, 
    },
    verified: {
      type: Boolean,
      default: false,
    },
    purpose: {
      type: String,
      enum: ["registration", "login", "verification"],
      default: "registration",
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster lookups
otpSchema.index({ phone: 1, verified: 1 });

export const OTP = model("OTP", otpSchema);

