import mongoose from "mongoose";

const { Schema, model } = mongoose;

const recruiterSchema = new Schema(
  {
    // Basic Information
    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    phoneVerified: {
      type: Boolean,
      default: false,
    },
    // Contact person name
    name: {
      type: String,
      trim: true,
    },
    companyName: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },

    // Business details
    website: {
      type: String,
      trim: true,
    },
    businessType: {
      type: String,
      trim: true,
    },
    establishedFrom: {
      type: Number, // Year (e.g., 2015)
      min: 1800,
      max: new Date().getFullYear() + 1,
    },

    // Location
    state: {
      type: String,
      trim: true,
    },
    city: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },

    // Documents
    profilePhoto: {
      type: String, // Backward compatibility
    },
    companyLogo: {
      type: String,
    },
    documents: [
      {
        type: String, // Array of file paths or URLs
      },
    ],

    // About Me Section
    aboutMe: {
      type: String,
      trim: true,
    },

    // Registration Status
    registrationStep: {
      type: Number,
      default: 0,
    },
    isRegistrationComplete: {
      type: Boolean,
      default: false,
    },

    // Status
    status: {
      type: String,
      enum: ["Pending", "Active", "Inactive", "Rejected"],
      default: "Pending",
    },

    // Block Status
    isBlocked: {
      type: Boolean,
      default: false,
    },

    // Coin Balance
    coinBalance: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Role (for auth tokens)
    role: {
      type: String,
      default: "recruiter",
      enum: ["recruiter"],
    },

    // FCM Tokens for push notifications (multiple devices)
    fcmTokens: {
      type: [String],
      default: [],
    },

    // Referral System
    referralCode: {
      type: String,
      unique: true,
      sparse: true, // Allows null values while maintaining uniqueness
      index: true,
    },
    referredBy: {
      type: Schema.Types.ObjectId,
      ref: "Recruiter",
      default: null,
    },
    totalReferrals: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Authentication
    refreshToken: {
      type: String,
      default: null,
      select: false,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
recruiterSchema.index({ status: 1 });

export const Recruiter = model("Recruiter", recruiterSchema);

