import http from "http";
import { Server } from "socket.io";
import app from "./app.js";
import connectDB from "./src/config/db.js";
import { emailService } from "./src/services/emailService.js";


await connectDB();

// Initialize email service
emailService.initialize();

const server = http.createServer(app);


export const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins for mobile apps
    methods: ["GET", "POST"],
  },
});


// Store online users: Map<userId, { socketId, userType }>
export const onlineUsers = new Map();

io.on("connection", (socket) => {
  console.log("⚡ Socket connected:", socket.id);
  console.log("   Total connections:", io.engine.clientsCount);

  // Enhanced register event with userType support
  socket.on("register", (data) => {
    let userId, userType;

    // Support both string and object format
    if (typeof data === "string") {
      userId = data;
      userType = "unknown";
    } else if (typeof data === "object") {
      userId = data.userId;
      userType = data.userType || "unknown";
    }

    if (!userId) {
      console.log("❌ Register failed - no userId provided");
      return;
    }

    onlineUsers.set(userId, { socketId: socket.id, userType });
    console.log("✅ User registered:");
    console.log("   UserId:", userId);
    console.log("   UserType:", userType);
    console.log("   SocketId:", socket.id);
    console.log("   Total online users:", onlineUsers.size);

    // Debug: Log all online users
    console.log("   Online users map:", Array.from(onlineUsers.entries()));

    // Emit confirmation back to client
    socket.emit("registered", { success: true, userId, socketId: socket.id });
  });

  // Handle direct socket messages (for real-time relay)
  socket.on("sendMessage", (data) => {
    console.log("\n📨 ========== SOCKET MESSAGE RECEIVED ==========");
    console.log("   From socket:", socket.id);
    console.log("   Data:", JSON.stringify(data, null, 2));

    const { applicationId, receiverId, sender, content, messageType, attachments } = data;

    if (!receiverId) {
      console.log("   ⚠️ No receiverId in message, cannot relay");
      console.log("=================================================\n");
      return;
    }

    const receiverInfo = onlineUsers.get(receiverId);

    if (receiverInfo) {
      console.log("   ✅ Receiver is online:");
      console.log("      SocketId:", receiverInfo.socketId);
      console.log("      UserType:", receiverInfo.userType);

      io.to(receiverInfo.socketId).emit("newMessage", {
        ...data,
        timestamp: new Date().toISOString(),
      });
      console.log("   📤 Message relayed via socket");
    } else {
      console.log("   ❌ Receiver is OFFLINE, userId:", receiverId);
      console.log("   Current online users:", Array.from(onlineUsers.keys()));
    }
    console.log("=================================================\n");
  });

  // Handle typing indicator
  socket.on("typing", (data) => {
    const { receiverId, isTyping } = data;
    const receiverInfo = onlineUsers.get(receiverId);
    if (receiverInfo) {
      io.to(receiverInfo.socketId).emit("userTyping", { isTyping });
    }
  });

  // ==========================================
  // SUPPORT CHAT SOCKET EVENTS
  // ==========================================

  // Register support user (by phone for guests)
  socket.on("registerSupport", (data) => {
    const { phone, userType } = data;
    if (!phone) {
      console.log("❌ Support register failed - no phone provided");
      return;
    }
    onlineUsers.set(phone, { socketId: socket.id, userType: userType || "guest" });
    console.log("✅ Support user registered:");
    console.log("   Phone:", phone);
    console.log("   SocketId:", socket.id);
    socket.emit("supportRegistered", { success: true, phone });
  });

  // Send support message via socket (real-time)
  socket.on("sendSupportMessage", async (data) => {
    console.log("📨 Support message received:", data);
    const { phone, content, conversationId } = data;

    // Broadcast to all admins (they don't register with specific IDs)
    io.emit("newSupportMessage", {
      conversationId,
      phone,
      message: {
        content,
        senderType: "user",
        createdAt: new Date().toISOString(),
      },
    });
  });

  // Admin joins a conversation (opens chat with a user)
  socket.on("adminJoinedChat", (data) => {
    const { phone, conversationId, adminName } = data;
    console.log("👨‍💼 Admin joined chat:", phone);

    // Notify the mobile user that admin is now viewing their chat
    const userSocket = onlineUsers.get(phone);
    if (userSocket) {
      io.to(userSocket.socketId).emit("adminOnline", {
        conversationId,
        adminName: adminName || "Support Agent",
        message: "A support agent has joined the chat",
        timestamp: new Date().toISOString(),
      });
      console.log("   ✅ Notified user:", phone);
    } else {
      console.log("   ℹ️ User not online:", phone);
    }
  });

  // Admin leaves a conversation (closes chat or switches to another)
  socket.on("adminLeftChat", (data) => {
    const { phone, conversationId } = data;
    console.log("👋 Admin left chat:", phone);

    // Notify the mobile user that admin left
    const userSocket = onlineUsers.get(phone);
    if (userSocket) {
      io.to(userSocket.socketId).emit("adminOffline", {
        conversationId,
        message: "Support agent left the chat",
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Admin typing indicator
  socket.on("adminTyping", (data) => {
    const { phone, isTyping } = data;
    const userSocket = onlineUsers.get(phone);
    if (userSocket) {
      io.to(userSocket.socketId).emit("adminTyping", { isTyping });
    }
  });

  // Handle disconnect
  socket.on("disconnect", (reason) => {
    console.log("🔌 Socket disconnected:", socket.id);
    console.log("   Reason:", reason);

    for (const [userId, info] of onlineUsers.entries()) {
      // Support both old format (string) and new format (object)
      const socketId = typeof info === "string" ? info : info.socketId;
      if (socketId === socket.id) {
        onlineUsers.delete(userId);
        console.log("   Removed user from online map:", userId);
        break;
      }
    }
    console.log("   Remaining online users:", onlineUsers.size);
  });

  // Handle connection errors
  socket.on("error", (error) => {
    console.log("❌ Socket error:", error);
  });
});

const PORT = process.env.PORT || 8000;

server.listen(PORT, () => {
  console.log(`🚀 Server + WebSocket running on PORT ${PORT}`);
});

