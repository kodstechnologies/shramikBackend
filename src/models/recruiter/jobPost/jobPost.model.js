import mongoose from "mongoose";

const { Schema, model } = mongoose;

const benefitsSchema = new Schema(
  {
    foodProvided: {
      type: Boolean,
      default: false,
    },
    accommodationProvided: {
      type: Boolean,
      default: false,
    },
    travelFacility: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

const salarySchema = new Schema(
  {
    min: {
      type: Number,
      required: true,
    },
    max: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: "INR",
    },
    payPeriod: {
      type: String,
      enum: ["monthly", "annual"],
      default: "monthly",
    },
  },
  { _id: false }
);

const experienceSchema = new Schema(
  {
    minYears: {
      type: Number,
      default: 0,
    },
    maxYears: {
      type: Number,
    },
  },
  { _id: false }
);

const ageRangeSchema = new Schema(
  {
    minAge: {
      type: Number,
      min: 18,
      max: 100,
    },
    maxAge: {
      type: Number,
      min: 18,
      max: 100,
    },
  },
  { _id: false }
);

const companySnapshotSchema = new Schema(
  {
    name: String,
    industry: String,
    location: String,
    employeeCount: String,
    description: String,
    logo: String,
  },
  { _id: false }
);

const recruiterJobSchema = new Schema(
  {
    recruiter: {
      type: Schema.Types.ObjectId,
      ref: "Recruiter",
      required: true,
      index: true,
    },
    jobTitle: {
      type: String,
      required: true,
      trim: true,
    },
    jobDescription: {
      type: String,
      required: true,
      trim: true,
    },
    city: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    state: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    expectedSalary: {
      type: salarySchema,
      required: true,
    },
    employeeCount: {
      type: Number,
    },
    jobType: {
      type: String,
      enum: ["Full Time", "Part Time", "Contract Based"],
      required: true,
      index: true,
    },
    employmentMode: {
      type: String,
      enum: ["Onsite", "Remote", "Hybrid"],
      default: "Onsite",
      index: true,
    },
    jobSeekerCategory: {
      type: String,
      enum: ["Non-Degree Holder", "Diploma Holder", "ITI Holder"],
      required: true,
      index: true,
    },
    categories: [
      {
        type: String,
        trim: true,
      },
    ],
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    skills: [
      {
        type: String,
        trim: true,
      },
    ],
    benefits: {
      type: benefitsSchema,
      default: () => ({}),
    },
    experienceRange: {
      type: experienceSchema,
      default: () => ({}),
    },
    preferredAgeRange: {
      type: ageRangeSchema,
      default: () => ({}),
    },
    qualifications: [
      {
        type: String,
        trim: true,
      },
    ],
    responsibilities: [
      {
        type: String,
        trim: true,
      },
    ],
    companySnapshot: {
      type: companySnapshotSchema,
      default: () => ({}),
    },
    status: {
      type: String,
      enum: ["Draft", "Open", "Closed", "Archived"],
      default: "Open",
      index: true,
    },
    applicationCount: {
      type: Number,
      default: 0,
    },
    vacancyCount: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
    isBlocked: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

recruiterJobSchema.index({ jobTitle: "text", jobDescription: "text", city: "text" });

export const RecruiterJob = model("RecruiterJob", recruiterJobSchema);

