import mongoose from "mongoose";

const { Schema, model } = mongoose;

const roleSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    value: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      lowercase: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    icon: {
      type: String,
      trim: true,
      default: "",
    },
    registrationPath: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
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
  { timestamps: true }
);

roleSchema.index({ status: 1 });

export const Role = model("Role", roleSchema);

