;

// export default router;
import { Router } from "express";

// Auth Middlewares
import { verifyJobSeekerJWT } from "../../middlewares/jobSeeker/authJobSeeker.js";
import { verifyJWT } from "../../middlewares/authMiddleware.js";

// Validation
import feedbackValidation from "../../middlewares/feedbackvalidation.js";
import {
    submitFeedbackSchema,
    adminReplySchema,
} from "../../validation/jobSeeker/feedback.validation.js";

// Controllers
import { submitFeedback } from "../../controllers/feedback/jobSeeker.feedback.controller.js";
import {
    getAllFeedback,
    replyToFeedback,
    deleteFeedback,
    targetBlockJobseeker, // API 4
} from "../../controllers/feedback/admin.feedback.controller.js";

const router = Router();

/* =====================================================
   JOB SEEKER ROUTES
===================================================== */

// Submit feedback (Includes the check for targeted blocks)
router.post(
    "/",
    verifyJobSeekerJWT,
    feedbackValidation(submitFeedbackSchema),
    submitFeedback
);

/* =====================================================
   ADMIN FEEDBACK APIs (The 4 Requirements)
===================================================== */

/**
 * API 1: Get & Analytics API
 * Supports filters: ?type=...&category=...&job_id=...
 */
router.get(
    "/admin",
    verifyJWT(["Admin"]),
    getAllFeedback
);

/**
 * API 3: Response API
 * Updates adminReply and Status (REPLIED/RESOLVED)
 */
router.patch(
    "/admin/:id/reply",
    verifyJWT(["Admin"]),
    feedbackValidation(adminReplySchema),
    replyToFeedback
);

/**
 * API 4: Targeted Block API
 * Blocks a specific user from a specific job
 */
router.post(
    "/admin/block-target",
    verifyJWT(["Admin"]),
    targetBlockJobseeker
);

/**
 * API 2: Delete API
 * Permanently removes feedback
 */
router.delete(
    "/admin/:id",
    verifyJWT(["Admin"]),
    deleteFeedback
);

export default router;
