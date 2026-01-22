import express from "express";
import { verifyJWT } from "../../middlewares/authMiddleware.js";
import {
    sendMessage,
    getConversation,
    getAdminConversations,
    getAdminConversation,
    sendAdminMessage,
    resolveConversation,
} from "../../controllers/support/supportChat.controller.js";

const router = express.Router();

// ==========================================
// MOBILE APIs - NO AUTHENTICATION REQUIRED
// ==========================================
// Start conversation: { phone } → returns greeting
// Send message: { conversationId, content } OR { phone, content }
router.post("/message", sendMessage);
router.get("/conversation/:conversationId", getConversation);

// ==========================================
// ADMIN APIs - AUTHENTICATION REQUIRED
// ==========================================
router.get("/admin/conversations", verifyJWT(["Admin"]), getAdminConversations);
router.get("/admin/conversation/:id", verifyJWT(["Admin"]), getAdminConversation);
router.post("/admin/message", verifyJWT(["Admin"]), sendAdminMessage);
router.patch("/admin/resolve/:id", verifyJWT(["Admin"]), resolveConversation);

export default router;
