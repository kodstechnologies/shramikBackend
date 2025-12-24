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

        appCategory: {
            type: String,
            enum: [
                "APP_PERFORMANCE",
                "UI_UX",
                "JOB_SEARCH",
                "JOB_APPLY_ISSUE",
                "PAYMENT",
                "NOTIFICATION_ISSUE",
                "BUG_REPORT",
                "FEATURE_REQUEST",
                "TRUST_SAFETY",
                "OTHER",
            ],
            required: false,
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
