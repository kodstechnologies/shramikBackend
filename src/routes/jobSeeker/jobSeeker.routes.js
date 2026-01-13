import { Router } from "express";
import {
  sendOTP,
  verifyOTP,
  registerNonDegree,
  step1Registration,
  step2Registration,
  step3Registration,
  getCategories,
  getAllSpecializations,
  getSpecializationSkills,
  getSkillsByCategory,
  getJobSeekerByPhone,
  refreshAccessToken,
  logoutJobSeeker,
  getJobSeekerProfile,
  updateJobSeekerProfile,
} from "../../controllers/jobSeeker/jobSeeker.controller.js";
import { getSuggestedJobs } from "../../controllers/jobSeeker/suggestedJobs.controller.js";
import {
  applyForJob,
  getMyApplications,
  withdrawApplication,
} from "../../controllers/jobSeeker/application.controller.js";
import coinRoutes from "./coin.routes.js";
import { validateRequest } from "../../middlewares/jobSeeker/validateJobSeeker.js";
import { verifyJobSeekerJWT, optionalJobSeekerAuth } from "../../middlewares/jobSeeker/authJobSeeker.js";
import {
  sendOTPSchema,
  verifyOTPSchema,
  nonDegreeRegistrationSchema,
  step1RegistrationSchema,
  step2RegistrationSchema,
  step3RegistrationSchema,
  getSpecializationSkillsSchema,
  getSkillsByCategorySchema,
  applyForJobSchema,
  getMyApplicationsSchema,
  updateJobSeekerProfileSchema,
} from "../../validation/jobSeeker/jobSeeker.validation.js";
import { uploadFields, uploadToS3Middleware } from "../../middlewares/fileUpload.js";

const router = Router();

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

// Non-Degree Holder Registration (Complete in one step)
router.post(
  "/register/non-degree",
  uploadFields([
    { name: "aadhaarCard", maxCount: 1 },
    { name: "profilePhoto", maxCount: 1 },
  ]),
  uploadToS3Middleware, // Upload files to S3
  (req, res, next) => {
    // Debug: Log what multer received
    console.log("After multer - req.body:", req.body);
    console.log("After multer - req.files:", req.files);
    console.log("After multer - req.body keys:", Object.keys(req.body || {}));
    next();
  },
  validateRequest(nonDegreeRegistrationSchema),
  registerNonDegree
);

// Diploma/ITI Holder Registration - Step 1
router.post(
  "/register/step1",
  uploadFields([
    { name: "aadhaarCard", maxCount: 1 },
    { name: "profilePhoto", maxCount: 1 },
  ]),
  uploadToS3Middleware, // Upload files to S3
  validateRequest(step1RegistrationSchema),
  step1Registration
);

// Diploma/ITI Holder Registration - Step 2
router.post(
  "/register/step2",
  validateRequest(step2RegistrationSchema),
  step2Registration
);

// Diploma/ITI Holder Registration - Step 3
router.post(
  "/register/step3",
  uploadFields([
    { name: "resume", maxCount: 1 },
    { name: "experienceCertificate", maxCount: 1 },
    { name: "documents", maxCount: 5 },
  ]),
  uploadToS3Middleware, // Upload files to S3
  validateRequest(step3RegistrationSchema),
  step3Registration
);

// Get Available Categories (Public - for registration)
router.get("/categories", getCategories);

// Get All Specializations (Public/Auth - for registration) - Must be before /:phone route
router.get("/specializations", optionalJobSeekerAuth, getAllSpecializations);

// Get Specialization with Skills and Questions - Must be before /:phone route
router.get(
  "/specialization/:specializationId",
  validateRequest(getSpecializationSkillsSchema, "params"),
  getSpecializationSkills
);

// Get Skills by Category (for Non-Degree/Diploma/ITI registration) - Must be before /:phone route
router.get(
  "/skills-by-category",
  validateRequest(getSkillsByCategorySchema, "query"),
  getSkillsByCategory
);

// Refresh Token Route (Public - no auth required)
router.post("/refresh-token", refreshAccessToken);

// Logout Route (Public - no auth required, but should send refresh token)
router.post("/logout", logoutJobSeeker);

// Suggested Jobs - Requires authentication
router.get("/suggested-jobs", verifyJobSeekerJWT, getSuggestedJobs);

// Application Routes - Requires authentication
router.post(
  "/apply",
  verifyJobSeekerJWT,
  validateRequest(applyForJobSchema),
  applyForJob
);

router.get(
  "/applications",
  verifyJobSeekerJWT,
  validateRequest(getMyApplicationsSchema, "query"),
  getMyApplications
);

router.patch(
  "/applications/:applicationId/withdraw",
  verifyJobSeekerJWT,
  withdrawApplication
);

// Coin Routes
router.use("/coins", coinRoutes);

// Profile Routes - Requires authentication
router.get("/profile", verifyJobSeekerJWT, getJobSeekerProfile);
router.put(
  "/profile",
  verifyJobSeekerJWT,
  uploadFields([
    { name: "aadhaarCard", maxCount: 1 },
    { name: "profilePhoto", maxCount: 1 },
    { name: "resume", maxCount: 1 },
    { name: "experienceCertificate", maxCount: 1 },
    { name: "documents", maxCount: 5 },
  ]),
  uploadToS3Middleware,
  validateRequest(updateJobSeekerProfileSchema),
  updateJobSeekerProfile
);

// Get Job Seeker by Phone - Must be last to avoid route conflicts
router.get("/phone/:phone", getJobSeekerByPhone);

export default router;

