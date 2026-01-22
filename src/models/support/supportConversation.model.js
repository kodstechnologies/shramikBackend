import mongoose from "mongoose";

const { Schema, model } = mongoose;

const supportConversationSchema = new Schema(
    {
        // Phone number for guest users (unique identifier)
        phone: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        // Optional: linked user ID for logged-in users
        userId: {
            type: Schema.Types.ObjectId,
            refPath: "userModel",
            default: null,
        },
        userModel: {
            type: String,
            enum: ["JobSeeker", "Recruiter"],
            default: null,
        },
        // User type
        userType: {
            type: String,
            enum: ["jobSeeker", "recruiter", "guest"],
            default: "guest",
        },
        // User name for display
        userName: {
            type: String,
            trim: true,
            default: "Guest",
        },
        // Conversation status
        status: {
            type: String,
            enum: ["active", "pending", "resolved"],
            default: "active",
            index: true,
        },
        // Last message preview
        lastMessage: {
            type: String,
            trim: true,
        },
        lastMessageAt: {
            type: Date,
        },
        lastMessageBy: {
            type: String,
            enum: ["admin", "user"],
        },
        // Unread count for admin
        unreadCount: {
            type: Number,
            default: 0,
        },
        // Resolved by admin
        resolvedAt: {
            type: Date,
        },
        resolvedBy: {
            type: Schema.Types.ObjectId,
            ref: "Admin",
        },
    },
    {
        timestamps: true,
    }
);

// Indexes
supportConversationSchema.index({ status: 1, lastMessageAt: -1 });
supportConversationSchema.index({ userType: 1 });

export const SupportConversation = model("SupportConversation", supportConversationSchema);
