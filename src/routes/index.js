// src/routes/index.js
import { Router } from "express";
import authRoutes from "./auth.routes.js";
import unifiedAuthRoutes from "./auth/unifiedAuth.routes.js";
import userRoutes from "./user.routes.js";
import specializationRoutes from "./admin/specialization/specialization.routes.js";
import questionSetRoutes from "./admin/questionSet/questionSet.routes.js";
import coinPricingRoutes from "./admin/coinPricing/coinPricing.routes.js";
import publicCoinPricingRoutes from "./coin/coinPricing.routes.js";
import categoryRoutes from "./admin/category/category.routes.js";
import adminDashboardRoutes from "./admin/dashboard/dashboard.routes.js";
import adminJobSeekerRoutes from "./admin/jobSeeker/jobSeeker.routes.js";
import adminRecruiterRoutes from "./admin/recruiter/recruiter.routes.js";
import adminEmailRoutes from "./admin/email/email.routes.js";
import jobSeekerRoutes from "./jobSeeker/jobSeeker.routes.js";
import recruiterRoutes from "./recruiter/recruiter.routes.js";
import roleRoutes from "./role/role.routes.js";
import locationRoutes from "./location/location.routes.js";
import skillsRoutes from "./skills/skills.routes.js";
import chatRoutes from "./chat/chat.routes.js";
import notificationRoutes from "../firebase/notification.routes.js";
import jobSeekerPaymentRoutes from "./jobSeeker/payment.routes.js";
import recruiterPaymentRoutes from "./recruiter/payment.routes.js";

import feedbackRoutes from "./feedback/feedback.routes.js";

const router = Router();

router.get("/", (req, res) => {
  res.json({ success: true, message: "API root is working 🚀" });
});

// Admin auth routes (for admin panel login)
router.use("/api/auth", authRoutes);

// Unified auth routes (for job seekers and recruiters - automatically detects user type)
router.use("/api/auth", unifiedAuthRoutes);

router.use("/api/users", userRoutes);
router.use("/api/specializations", specializationRoutes);
router.use("/api/question-sets", questionSetRoutes);
// Admin coin pricing routes (requires authentication)
router.use("/api/coin-pricing", coinPricingRoutes);
// Public coin pricing routes (no authentication required)
router.use("/api/public/coin-pricing", publicCoinPricingRoutes);
router.use("/api/categories", categoryRoutes);
// Admin dashboard routes
router.use("/api/admin/dashboard", adminDashboardRoutes);
// Admin job seeker insights routes
router.use("/api/admin/job-seekers", adminJobSeekerRoutes);
// Admin recruiter performance routes
router.use("/api/admin/recruiters", adminRecruiterRoutes);
// Admin email marketing routes
router.use("/api/admin/email", adminEmailRoutes);
router.use("/api/job-seekers", jobSeekerRoutes);
router.use("/api/recruiters", recruiterRoutes);
router.use("/api/roles", roleRoutes);
router.use("/api/location", locationRoutes);
router.use("/api/skills", skillsRoutes);
router.use("/api/chat", chatRoutes);
// Firebase push notification routes
router.use("/api/notifications", notificationRoutes);

//payment routes
router.use("/api/job-seekers/payment", jobSeekerPaymentRoutes);
router.use("/api/recruiters/payment", recruiterPaymentRoutes);

// Feedback routes (JobSeeker + Admin)
router.use("/api/feedback", feedbackRoutes);



export default router;

