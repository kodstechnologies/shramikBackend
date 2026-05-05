import mongoose from "mongoose";

const { Schema, model } = mongoose;

const emailTemplateSchema = new Schema(
    {
        // Template identification
        name: {
            type: String,
            required: true,
            trim: true,
            unique: true,
        },
        category: {
            type: String,
            enum: [
                "job-alert",
                "platform-update",
                "profile-reminder",
                "promotional",
                "greeting",
                "policy-update",
                "security",
                "maintenance",
                "custom"
            ],
            default: "custom",
        },

        // Email content
        subject: {
            type: String,
            required: true,
            trim: true,
        },
        preheader: {
            type: String, // Preview text shown in email inbox
            trim: true,
        },

        // Structured content (for template-based emails)
        content: {
            title: {
                type: String,
                trim: true,
            },
            body: {
                type: String, // Main paragraph content
                trim: true,
            },
            highlights: [{
                type: String, // Bullet points
                trim: true,
            }],
            ctaText: {
                type: String, // Button text
                trim: true,
            },
            ctaLink: {
                type: String, // Button URL
                trim: true,
            },
            footer: {
                type: String, // Footer message
                trim: true,
            },
        },

        // Raw HTML content (for advanced templates)
        htmlContent: {
            type: String,
        },

        // Target audience
        targetAudience: {
            type: String,
            enum: ["job-seeker", "recruiter", "all"],
            default: "all",
        },

        // Metadata
        isDefault: {
            type: Boolean,
            default: false,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
        },
    },
    {
        timestamps: true,
    }
);

// Indexes
emailTemplateSchema.index({ category: 1 });
emailTemplateSchema.index({ targetAudience: 1 });
emailTemplateSchema.index({ isActive: 1 });

export const EmailTemplate = model("EmailTemplate", emailTemplateSchema);
