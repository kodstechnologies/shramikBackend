import mongoose from "mongoose";

const { Schema, model } = mongoose;

const supportMessageSchema = new Schema(
    {
        // Reference to conversation
        conversation: {
            type: Schema.Types.ObjectId,
            ref: "SupportConversation",
            required: true,
            index: true,
        },
        // Who sent the message
        senderType: {
            type: String,
            enum: ["admin", "user"],
            required: true,
        },
        // Admin ID (if sent by admin)
        adminId: {
            type: Schema.Types.ObjectId,
            ref: "Admin",
            default: null,
        },
        // Message content
        content: {
            type: String,
            trim: true,
            required: true,
        },
        // Message type
        messageType: {
            type: String,
            enum: ["text", "system", "file"],
            default: "text",
        },
        // Read status
        isRead: {
            type: Boolean,
            default: false,
            index: true,
        },
        readAt: {
            type: Date,
        },
        // Attachments (for future file support)
        attachments: [
            {
                url: String,
                publicId: String,
                fileType: String,
                fileSize: Number,
            },
        ],
    },
    {
        timestamps: true,
    }
);

// Indexes for efficient queries
supportMessageSchema.index({ conversation: 1, createdAt: -1 });
supportMessageSchema.index({ senderType: 1, isRead: 1 });

export const SupportMessage = model("SupportMessage", supportMessageSchema);
