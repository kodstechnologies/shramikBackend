import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { SupportConversation } from "../../models/support/supportConversation.model.js";
import { SupportMessage } from "../../models/support/supportMessage.model.js";
import { io, onlineUsers } from "../../../server.js";

// Auto-greeting message for new conversations
const AUTO_GREETING = "Hello! Welcome to Shramik Support. How can we help you today?";

// Helper function to normalize userType (handle kebab-case from mobile clients)
const normalizeUserType = (userType) => {
    if (!userType) return "guest";

    // Map kebab-case to camelCase
    const typeMap = {
        "job-seeker": "jobSeeker",
        "jobseeker": "jobSeeker",
        "jobSeeker": "jobSeeker",
        "recruiter": "recruiter",
        "guest": "guest"
    };

    return typeMap[userType.toLowerCase()] || "guest";
};

/**
 * MOBILE API: Send message OR start conversation
 * POST /api/support/message
 * No authentication required
 * 
 * Start conversation: { phone } - creates conversation and returns greeting
 * First message: { phone, content } - creates conversation and sends message
 * Subsequent: { conversationId, content } - sends message to existing conversation
 */
export const sendMessage = asyncHandler(async (req, res) => {
    const { phone, content, userName, userType, conversationId } = req.body;

    // Must have either phone or conversationId
    if (!phone && !conversationId) {
        throw new ApiError(400, "Either phone or conversationId is required");
    }

    // If conversationId provided, content is required (for subsequent messages)
    if (conversationId && !content) {
        throw new ApiError(400, "Message content is required");
    }

    let conversation;
    let isNewConversation = false;

    // If conversationId provided, find by ID (for subsequent messages)
    if (conversationId) {
        conversation = await SupportConversation.findById(conversationId);
        if (!conversation) {
            throw new ApiError(404, "Conversation not found");
        }
    }
    // Otherwise, find/create by phone
    else if (phone) {
        // Validate phone format (10 digits)
        const phoneRegex = /^[0-9]{10}$/;
        if (!phoneRegex.test(phone)) {
            throw new ApiError(400, "Invalid phone number format (must be 10 digits)");
        }

        conversation = await SupportConversation.findOne({ phone });

        if (!conversation) {
            conversation = await SupportConversation.create({
                phone,
                userName: userName || "Guest",
                userType: normalizeUserType(userType),
                status: "active",
            });
            isNewConversation = true;

            // Create auto-greeting message from admin
            await SupportMessage.create({
                conversation: conversation._id,
                senderType: "admin",
                content: AUTO_GREETING,
                messageType: "system",
                isRead: false,
            });
        }
    }

    // If no content, just return conversation info (start conversation only)
    if (!content) {
        return res.status(isNewConversation ? 201 : 200).json(
            ApiResponse.success({
                conversationId: conversation._id,
                phone: conversation.phone,
                userName: conversation.userName,
                isNewConversation,
                greeting: AUTO_GREETING,
                message: null,
            }, isNewConversation ? "Conversation started successfully" : "Conversation already exists")
        );
    }

    // Create user message
    const message = await SupportMessage.create({
        conversation: conversation._id,
        senderType: "user",
        content,
        messageType: "text",
        isRead: false,
    });

    // Update conversation
    conversation.lastMessage = content;
    conversation.lastMessageAt = new Date();
    conversation.lastMessageBy = "user";
    conversation.unreadCount += 1;
    if (conversation.status === "resolved") {
        conversation.status = "active"; // Reopen if resolved
    }
    await conversation.save();

    // Emit to admin via Socket.io
    io.emit("newSupportMessage", {
        conversationId: conversation._id,
        phone: conversation.phone,
        message: {
            _id: message._id,
            content,
            senderType: "user",
            messageType: "text",
            createdAt: message.createdAt,
        },
        isNewConversation,
    });

    return res.status(201).json(
        ApiResponse.success({
            conversationId: conversation._id,
            phone: conversation.phone,
            message,
            greeting: isNewConversation ? AUTO_GREETING : null,
        }, "Message sent successfully")
    );
});

/**
 * MOBILE API: Start conversation (without sending a message)
 * POST /api/support/start
 * No authentication required
 * 
 * Creates a conversation and returns the greeting
 */
export const startConversation = asyncHandler(async (req, res) => {
    const { phone, userName, userType } = req.body;

    if (!phone) {
        throw new ApiError(400, "Phone number is required");
    }

    // Validate phone format (10 digits)
    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneRegex.test(phone)) {
        throw new ApiError(400, "Invalid phone number format (must be 10 digits)");
    }

    // Check if conversation already exists
    let conversation = await SupportConversation.findOne({ phone });
    let isNewConversation = false;

    if (!conversation) {
        conversation = await SupportConversation.create({
            phone,
            userName: userName || "Guest",
            userType: normalizeUserType(userType),
            status: "active",
        });
        isNewConversation = true;

        // Create auto-greeting message from admin
        await SupportMessage.create({
            conversation: conversation._id,
            senderType: "admin",
            content: AUTO_GREETING,
            messageType: "system",
            isRead: false,
        });
    }

    // Get greeting message
    const greetingMessage = await SupportMessage.findOne({
        conversation: conversation._id,
        messageType: "system"
    });

    return res.status(isNewConversation ? 201 : 200).json(
        ApiResponse.success({
            conversationId: conversation._id,
            phone: conversation.phone,
            userName: conversation.userName,
            isNewConversation,
            greeting: greetingMessage?.content || AUTO_GREETING,
        }, isNewConversation ? "Conversation started successfully" : "Conversation already exists")
    );
});

/**
 * MOBILE API: Get conversation by conversationId
 * GET /api/support/conversation/:conversationId
 * No authentication required
 */
export const getConversation = asyncHandler(async (req, res) => {
    const { conversationId } = req.params;

    const conversation = await SupportConversation.findById(conversationId);

    if (!conversation) {
        return res.status(404).json(
            ApiResponse.error("Conversation not found")
        );
    }

    const messages = await SupportMessage.find({ conversation: conversation._id })
        .sort({ createdAt: 1 })
        .lean();

    return res.status(200).json(
        ApiResponse.success({ conversation, messages }, "Conversation fetched successfully")
    );
});

/**
 * ADMIN API: Get all conversations
 * GET /api/support/admin/conversations
 * Requires admin authentication
 */
export const getAdminConversations = asyncHandler(async (req, res) => {
    const { status, search, page = 1, limit = 20 } = req.query;

    const query = {};

    if (status && status !== "all") {
        query.status = status;
    }

    if (search) {
        query.$or = [
            { phone: { $regex: search, $options: "i" } },
            { userName: { $regex: search, $options: "i" } },
        ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [conversations, total] = await Promise.all([
        SupportConversation.find(query)
            .sort({ lastMessageAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean(),
        SupportConversation.countDocuments(query),
    ]);

    return res.status(200).json(
        ApiResponse.success({
            conversations,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / parseInt(limit)),
            },
        }, "Conversations fetched successfully")
    );
});

/**
 * ADMIN API: Get conversation with messages
 * GET /api/support/admin/conversation/:id
 * Requires admin authentication
 */
export const getAdminConversation = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const conversation = await SupportConversation.findById(id);

    if (!conversation) {
        throw new ApiError(404, "Conversation not found");
    }

    const messages = await SupportMessage.find({ conversation: id })
        .sort({ createdAt: 1 })
        .lean();

    // Mark messages as read
    await SupportMessage.updateMany(
        { conversation: id, senderType: "user", isRead: false },
        { isRead: true, readAt: new Date() }
    );

    // Reset unread count
    conversation.unreadCount = 0;
    await conversation.save();

    return res.status(200).json(
        ApiResponse.success({ conversation, messages }, "Conversation fetched successfully")
    );
});

/**
 * ADMIN API: Send reply
 * POST /api/support/admin/message
 * Requires admin authentication
 */
export const sendAdminMessage = asyncHandler(async (req, res) => {
    const { conversationId, content } = req.body;
    const adminId = req.user?._id;

    if (!conversationId || !content) {
        throw new ApiError(400, "Conversation ID and content are required");
    }

    const conversation = await SupportConversation.findById(conversationId);

    if (!conversation) {
        throw new ApiError(404, "Conversation not found");
    }

    const message = await SupportMessage.create({
        conversation: conversationId,
        senderType: "admin",
        adminId,
        content,
        messageType: "text",
        isRead: false,
    });

    // Update conversation
    conversation.lastMessage = content;
    conversation.lastMessageAt = new Date();
    conversation.lastMessageBy = "admin";
    await conversation.save();

    // Emit to user via Socket.io (by phone)
    const userSocket = onlineUsers.get(conversation.phone);
    if (userSocket) {
        io.to(userSocket.socketId).emit("newSupportMessage", {
            conversationId,
            message: {
                _id: message._id,
                content,
                senderType: "admin",
                messageType: "text",
                createdAt: message.createdAt,
            },
        });
    }

    return res.status(201).json(
        ApiResponse.success({ message }, "Reply sent successfully")
    );
});

/**
 * ADMIN API: Resolve conversation
 * PATCH /api/support/admin/resolve/:id
 * Requires admin authentication
 */
export const resolveConversation = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const adminId = req.user?._id;

    const conversation = await SupportConversation.findById(id);

    if (!conversation) {
        throw new ApiError(404, "Conversation not found");
    }

    conversation.status = "resolved";
    conversation.resolvedAt = new Date();
    conversation.resolvedBy = adminId;
    await conversation.save();

    // Create system message
    await SupportMessage.create({
        conversation: id,
        senderType: "admin",
        content: "This conversation has been marked as resolved. If you need further assistance, please send a new message.",
        messageType: "system",
    });

    return res.status(200).json(
        ApiResponse.success({ conversation }, "Conversation resolved successfully")
    );
});
