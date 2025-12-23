import { Router } from "express";

// JobSeeker auth (this exists)
import { verifyJobSeekerJWT } from "../../middlewares/jobSeeker/authJobSeeker.js";

//  Use your existing role-based auth
import { verifyJWT } from "../../middlewares/authMiddleware.js";

import feedbackValidation from "../../middlewares/feedbackvalidation.js";
import { submitFeedback } from "../../controllers/feedback/jobSeeker.feedback.controller.js";
import {
    getAllFeedback,
    replyToFeedback,
    toggleFeedbackBlock,
    deleteFeedback,
} from "../../controllers/feedback/admin.feedback.controller.js";

import {
    submitFeedbackSchema,
    adminReplySchema,
} from "../../validation/jobSeeker/feedback.validation.js";

const router = Router();

/* ================= JOB SEEKER ================= */
router.post(
    "/",
    verifyJobSeekerJWT,
    feedbackValidation(submitFeedbackSchema),
    submitFeedback
);

/* ================= ADMIN ================= */
router.get(
    "/admin",
    verifyJWT(["Admin"]),
    getAllFeedback
);

router.patch(
    "/admin/:id/reply",
    verifyJWT(["Admin"]),
    feedbackValidation(adminReplySchema),
    replyToFeedback
);

router.patch(
    "/admin/:id/toggle-block",
    verifyJWT(["Admin"]),
    toggleFeedbackBlock
);

router.delete(
    "/admin/:id",
    verifyJWT(["Admin"]),
    deleteFeedback
);

export default router;
