import mongoose from "mongoose";

const { Schema, model } = mongoose;

const referralSchema = new Schema(
    {
        // Referrer (the person who shared the code)
        referrer: {
            type: Schema.Types.ObjectId,
            required: true,
            refPath: "referrerType",
            index: true,
        },
        referrerType: {
            type: String,
            enum: ["JobSeeker", "Recruiter"],
            required: true,
        },

        // Referee (the new user who signed up with the code)
        referee: {
            type: Schema.Types.ObjectId,
            required: true,
            refPath: "refereeType",
            index: true,
        },
        refereeType: {
            type: String,
            enum: ["JobSeeker", "Recruiter"],
            required: true,
        },

        // Referral code used
        referralCode: {
            type: String,
            required: true,
            index: true,
        },

        // Status of the referral
        status: {
            type: String,
            enum: ["pending", "completed", "rewarded", "failed"],
            default: "pending",
        },

        // Coins awarded
        referrerCoinsAwarded: {
            type: Number,
            default: 0,
        },
        refereeCoinsAwarded: {
            type: Number,
            default: 0,
        },

        // Notes/reason for failed referrals
        note: {
            type: String,
            trim: true,
        },
    },
    {
        timestamps: true,
    }
);

// Indexes for efficient queries
referralSchema.index({ referrer: 1, createdAt: -1 });
referralSchema.index({ status: 1 });

export const Referral = model("Referral", referralSchema);
