import { Router } from "express";
import {
  sendOTP,
  verifyOTP,
  registerRecruiter,
  getRecruiterByPhone,
  refreshRecruiterAccessToken,
  logoutRecruiter,
  getRecruiterProfile,
  updateRecruiterProfile,
  getWebsiteTypes,
} from "../../controllers/recruiter/recruiter.controller.js";
import {
  getJobCategories,
  getJobTypes,
  getFacilities,
  getJobMeta,
} from "../../controllers/recruiter/jobPost/jobMeta.controller.js";
import { validateRequest } from "../../middlewares/recruiter/validateRecruiter.js";
import {
  sendOTPSchema,
  verifyOTPSchema,
  recruiterRegistrationSchema,
  updateRecruiterProfileSchema,
} from "../../validation/recruiter/recruiter.validation.js";
import jobPostRoutes from "../jobPost/jobPost.routes.js";
import dashboardRoutes from "./dashboard/dashboard.routes.js";
import applicationRoutes from "./application/application.routes.js";
import coinRoutes from "./coin.routes.js";
import { verifyRecruiterJWT } from "../../middlewares/recruiter/authRecruiter.js";
import {
  uploadFields,
  uploadToS3Middleware,
} from "../../middlewares/fileUpload.js";
import {
  getAllShortlistedCandidates,
} from "../../controllers/recruiter/application/application.controller.js";
const router = Router();

// Public endpoint - Get all website types (no authentication required)
router.get("/website-types", getWebsiteTypes);

// OTP Routes
router.post(
  "/send-otp",
  validateRequest(sendOTPSchema),
  sendOTP
);

router.post(
  "/verify-otp",
  validateRequest(verifyOTPSchema),
  verifyOTP
);

// Recruiter Registration
router.post(
  "/register",
  uploadFields([
    { name: "companyLogo", maxCount: 1 },
    { name: "documents", maxCount: 5 },
  ]),
  uploadToS3Middleware,
  validateRequest(recruiterRegistrationSchema),
  registerRecruiter
);

// Auth token utilities
router.post("/refresh-token", refreshRecruiterAccessToken);
router.post("/logout", logoutRecruiter);

// Dashboard Routes
router.use("/", dashboardRoutes);
router.get("/applications/shortlisted", verifyRecruiterJWT, getAllShortlistedCandidates);
// Application Routes (for viewing jobs with applications and applicants)
router.use("/", applicationRoutes);

// Coin Routes
router.use("/coins", coinRoutes);

// Job Meta Data APIs (Public - for job posting form)
// Separate endpoints for each section
router.get("/job-categories", getJobCategories); // For Job Category selection buttons
router.get("/job-types", getJobTypes); // For Job Type toggle buttons
router.get("/facilities", getFacilities); // For Facilities toggle switches
// Combined endpoint (optional - if frontend wants all data at once)
router.get("/job-meta", getJobMeta);
// Note: Job Seeker Categories are available at /api/job-seekers/categories (public endpoint)

// Job Posting Routes
router.use("/", jobPostRoutes);

// Profile Routes - Requires authentication
router.get("/profile", verifyRecruiterJWT, getRecruiterProfile);
router.put(
  "/profile",
  verifyRecruiterJWT,
  uploadFields([
    { name: "companyLogo", maxCount: 1 },
    { name: "documents", maxCount: 5 },
  ]),
  uploadToS3Middleware,
  validateRequest(updateRecruiterProfileSchema),
  updateRecruiterProfile
);
// Get all shortlisted candidates across all jobs


// Get Recruiter by Phone - Must be last to avoid route conflicts
router.get("/:phone", getRecruiterByPhone);

export default router;

