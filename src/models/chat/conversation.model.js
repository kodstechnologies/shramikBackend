import mongoose from "mongoose";

const { Schema, model } = mongoose;

const conversationSchema = new Schema(
  {
    application: {
      type: Schema.Types.ObjectId,
      ref: "Application",
      required: true,
      index: true,
    },
    job: {
      type: Schema.Types.ObjectId,
      ref: "RecruiterJob",
      required: true,
      index: true,
    },
    recruiter: {
      type: Schema.Types.ObjectId,
      ref: "Recruiter",
      required: true,
      index: true,
    },
    jobSeeker: {
      type: Schema.Types.ObjectId,
      ref: "JobSeeker",
      required: true,
      index: true,
    },
    // Track who initiated the conversation
    initiatedBy: {
      type: String,
      enum: ["recruiter", "job-seeker"],
      required: true,
      default: "recruiter",
    },
    // Track last message for quick access
    lastMessage: {
      type: String,
      trim: true,
    },
    lastMessageAt: {
      type: Date,
    },
    lastMessageBy: {
      type: String,
      enum: ["recruiter", "job-seeker"],
    },
    // Track unread messages count for each participant
    unreadCountRecruiter: {
      type: Number,
      default: 0,
    },
    unreadCountJobSeeker: {
      type: Number,
      default: 0,
    },
    // Status of conversation
    status: {
      type: String,
      enum: ["active", "archived", "deleted"],
      default: "active",
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient queries
conversationSchema.index({ recruiter: 1, status: 1 });
conversationSchema.index({ jobSeeker: 1, status: 1 });
conversationSchema.index({ job: 1, recruiter: 1, jobSeeker: 1 });

export const Conversation = model("Conversation", conversationSchema);















