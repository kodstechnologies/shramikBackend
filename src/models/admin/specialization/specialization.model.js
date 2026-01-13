import mongoose from "mongoose";

const { Schema, model } = mongoose;

const specializationSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    userType: {
      type: String,
      enum: ["Non-Degree Holder", "Diploma Holder", "ITI Holder"],
      required: true,
    },
    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
    },
    skills: {
      type: [String],
      default: [],
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

specializationSchema.index({ name: 1 }, { unique: true });

export const Specialization = model("Specialization", specializationSchema);


