import mongoose from "mongoose";

const { Schema, model } = mongoose;

const emailCampaignSchema = new Schema(
    {
        // Campaign identification
        name: {
            type: String,
            required: true,
            trim: true,
        },

        // Template reference (optional - can send without template)
        template: {
            type: Schema.Types.ObjectId,
            ref: "EmailTemplate",
        },

        // Email content (stored for history)
        subject: {
            type: String,
            required: true,
            trim: true,
        },
        content: {
            title: String,
            body: String,
            highlights: [String],
            ctaText: String,
            ctaLink: String,
            footer: String,
        },
        htmlContent: {
            type: String, // Final rendered HTML
        },

        // Recipients
        recipientType: {
            type: String,
            enum: ["job-seeker", "recruiter", "all", "custom"],
            required: true,
        },

        // Filters applied
        filters: {
            category: String,       // Non-Degree Holder, Diploma Holder, ITI Holder
            status: String,         // Active, Pending, etc.
            state: String,          // Location filter
            city: String,
            registeredAfter: Date,  // Registration date filter
            registeredBefore: Date,
            hasEmail: {             // Must have email address
                type: Boolean,
                default: true,
            },
        },

        // Recipient list (stored for tracking)
        recipients: [{
            email: String,
            userId: Schema.Types.ObjectId,
            userType: String,
            name: String,
            status: {
                type: String,
                enum: ["pending", "sent", "failed", "bounced", "opened", "clicked"],
                default: "pending",
            },
            sentAt: Date,
            errorMessage: String,
        }],

        // Statistics
        stats: {
            totalRecipients: {
                type: Number,
                default: 0,
            },
            sentCount: {
                type: Number,
                default: 0,
            },
            failedCount: {
                type: Number,
                default: 0,
            },
            openedCount: {
                type: Number,
                default: 0,
            },
            clickedCount: {
                type: Number,
                default: 0,
            },
        },

        // Campaign status
        status: {
            type: String,
            enum: ["draft", "scheduled", "sending", "completed", "failed", "cancelled"],
            default: "draft",
        },

        // Scheduling
        scheduledAt: {
            type: Date, // If null, send immediately
        },
        startedAt: {
            type: Date,
        },
        completedAt: {
            type: Date,
        },

        // Audit
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
        },
        cancelledBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
        },
        cancelledAt: {
            type: Date,
        },
    },
    {
        timestamps: true,
    }
);

// Indexes
emailCampaignSchema.index({ status: 1 });
emailCampaignSchema.index({ recipientType: 1 });
emailCampaignSchema.index({ scheduledAt: 1 });
emailCampaignSchema.index({ createdAt: -1 });
emailCampaignSchema.index({ "recipients.userId": 1 });

export const EmailCampaign = model("EmailCampaign", emailCampaignSchema);
