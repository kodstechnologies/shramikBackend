// import { getAppFeedbackCategories } from "../../controllers/feedback/appFeedbackCategory.controller.js";
import { getAppFeedbackCategories } from "../../controllers/feedback/appFeedbackCategory.controller.js";
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
    targetBlockRecruiter,
    getRecruiterWithJobs,
    blockJobPost,
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
   ADMIN FEEDBACK APIs
===================================================== */

/**
 * API 1: Get & Analytics API
 * Supports filters: ?type=...&category=...&job_id=...&status=...
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
 * API 4: Block Recruiter
 * Blocks the Recruiter who posted the problematic job
 */
router.post(
    "/admin/block-recruiter",
    verifyJWT(["Admin"]),
    targetBlockRecruiter
);

/**
 * API 5: Get Recruiter With Jobs
 * Returns recruiter details + their job posts
 */
router.get(
    "/admin/recruiter/:recruiterId/jobs",
    verifyJWT(["Admin"]),
    getRecruiterWithJobs
);

/**
 * API 6: Block Job Post
 * Closes/blocks a specific job post
 */
router.post(
    "/admin/block-job",
    verifyJWT(["Admin"]),
    blockJobPost
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

router.get(
    "/app/categories",
    verifyJobSeekerJWT,
    getAppFeedbackCategories
);

export default router;

