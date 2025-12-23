import Joi from "joi";

/**
 * ================= JOB SEEKER SUBMIT FEEDBACK =================
 */
export const submitFeedbackSchema = Joi.object({
    // App issue (optional)
    appCategory: Joi.string()
        .valid(
            "APP_PERFORMANCE",
            "UI_UX",
            "PAYMENT",
            "SERVICE_BOOKING",
            "BUG_REPORT",
            "FEATURE_REQUEST",
            "OTHER"
        )
        .optional(),

    appSubCategory: Joi.string()
        .max(50)
        .optional(),

    // Job issue (optional)
    jobId: Joi.string()
        .hex()
        .length(24)
        .optional(),

    jobSubCategory: Joi.string()
        .max(50)
        .optional(),

    // Required fields
    message: Joi.string()
        .min(10)
        .required(),

    rating: Joi.number()
        .min(1)
        .max(5)
        .required(),
});

/**
 * ================= ADMIN REPLY FEEDBACK =================
 
 */
export const adminReplySchema = Joi.object({
    adminReply: Joi.string()
        .min(5)
        .required(),

    status: Joi.string()
        .valid("REPLIED", "RESOLVED")
        .required(),
});
