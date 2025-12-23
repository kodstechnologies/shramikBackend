import mongoose from "mongoose";

const { Schema, model } = mongoose;

const jobSeekerSchema = new Schema(
  {
    // Basic Information
    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    phoneVerified: {
      type: Boolean,
      default: false,
    },
    category: {
      type: String,
      enum: ["Non-Degree Holder", "Diploma Holder", "ITI Holder"],
      required: true,
    },
    role: {
      type: String,
      enum: ["Worker", "Contractor", "Admin"],
      default: "Worker",
    },

    // Personal Information
    name: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    gender: {
      type: String,
      enum: ["male", "female", "prefer not to say"],
      trim: true,
    },
    dateOfBirth: {
      type: Date,
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

    // Skills & Specialization
    specializationId: {
      type: Schema.Types.ObjectId,
      ref: "Specialization",
    },
    skills: {
      type: [String],
      default: [],
    },
    selectedSkills: {
      type: [String],
      default: [],
    },

    // Question Answers (for Diploma/ITI holders)
    questionAnswers: [
      {
        questionId: String, // Reference to question text or ID
        questionText: String,
        selectedOption: String,
        isCorrect: Boolean, // Not required for validation, just stored
      },
    ],

    // Documents
    aadhaarCard: {
      type: String, // File path or URL
    },
    profilePhoto: {
      type: String, // File path or URL
    },
    resume: {
      type: String, // File path or URL
    },
    experienceCertificate: {
      type: String, // File path or URL (if experience status is true)
    },
    documents: [
      {
        type: String, // Array of file paths or URLs
      },
    ],

    // Education Details (for Diploma/ITI holders)
    education: {
      collegeInstituteName: {
        type: String,
        trim: true,
      },
      city: {
        type: String,
        trim: true,
      },
      state: {
        type: String,
        trim: true,
      },
      yearOfPassing: {
        type: String,
        trim: true,
      },
      percentageOrGrade: {
        type: String,
        trim: true,
      },
    },

    // Experience Status (true = has experience, false = is fresher)
    experienceStatus: {
      type: Boolean,
      default: false,
    },

    // Year of Experience (e.g., "1 year", "2 years", "3.5 years")
    yearOfExperience: {
      type: String,
      default: "",
      trim: true,
    },

    // About Me Section
    aboutMe: {
      type: String,
      trim: true,
    },

    // Registration Status
    registrationStep: {
      type: Number,
      default: 0, // 0 = not started, 1 = step 1, 2 = step 2, 3 = step 3, 4 = completed
    },
    isRegistrationComplete: {
      type: Boolean,
      default: false,
    },

    // Status
    status: {
      type: String,
      enum: ["Pending", "Active", "Inactive", "Rejected"],
      default: "Active",
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
      ref: "JobSeeker",
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
      select: false, // Don't include in queries by default (security)
    },

    // JobSeeker schema (add near status fields)
    isFeedbackBlocked: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
jobSeekerSchema.index({ phone: 1 });
jobSeekerSchema.index({ category: 1 });
jobSeekerSchema.index({ specializationId: 1 });
jobSeekerSchema.index({ status: 1 });

export const JobSeeker = model("JobSeeker", jobSeekerSchema);

