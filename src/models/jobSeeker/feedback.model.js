import mongoose from "mongoose";

const { Schema, model } = mongoose;

const feedbackSchema = new Schema(
    {
        jobSeeker: {
            type: Schema.Types.ObjectId,
            ref: "JobSeeker",
            required: true,
            index: true,
        },

        // Optional job reference
        job: {
            type: Schema.Types.ObjectId,
            ref: "RecruiterJob",
            required: false,
            index: true,
        },

        // 🔹 App feedback
        appCategory: {
            type: String,
            enum: [
                "APP_PERFORMANCE",
                "UI_UX",
                "PAYMENT",
                "SERVICE_BOOKING",
                "BUG_REPORT",
                "FEATURE_REQUEST",
                "OTHER",
            ],
            default: null,
        },

        appSubCategory: {
            type: String,
            trim: true,
            default: null,
            // e.g. SLOW_APP, CRASH, PAYMENT_FAILED
        },

        // 🔹 Job feedback
        jobSubCategory: {
            type: String,
            trim: true,
            default: null,
            // e.g. SCAM, FAKE_JOB, MISLEADING_INFO
        },

        message: {
            type: String,
            required: true,
            minlength: 10,
            trim: true,
        },

        rating: {
            type: Number,
            required: true,
            min: 1,
            max: 5,
        },

        adminReply: {
            type: String,
            default: null,
        },

        status: {
            type: String,
            enum: ["PENDING", "REPLIED", "RESOLVED"],
            default: "PENDING",
        },
    },
    { timestamps: true }
);

export const Feedback = model("Feedback", feedbackSchema);
