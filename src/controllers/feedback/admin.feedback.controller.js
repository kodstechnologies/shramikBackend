import ApiError from "../../utils/ApiError.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { Feedback } from "../../models/jobSeeker/feedback.model.js";

/**
 * Get all feedback (exclude blocked)
 */
export const getAllFeedback = asyncHandler(async (req, res) => {
    console.log("📋 [Admin][Feedback] Get all feedback API called");

    const query = {
        $or: [
            { isBlocked: false },
            { isBlocked: { $exists: false } }
        ]
    };

    console.log("🔍 [Admin][Feedback] Query:", query);

    const feedbacks = await Feedback.find(query)
        .populate("jobSeeker", "name phone")
        .sort({ createdAt: -1 });

    console.log("✅ [Admin][Feedback] Feedback fetched:", feedbacks.length);

    if (feedbacks.length > 0) {
        console.log(
            "🧾 [Admin][Feedback] Sample feedback ID:",
            feedbacks[0]._id
        );
    }

    res.json({ success: true, data: feedbacks });
});


/**
 * Reply to feedback
 */
export const replyToFeedback = asyncHandler(async (req, res) => {
    const { adminReply, status } = req.body;
    const feedbackId = req.params.id;

    console.log("💬 [Admin][Feedback] Reply request", {
        feedbackId,
        status,
        replyLength: adminReply?.length,
    });

    const feedback = await Feedback.findByIdAndUpdate(
        feedbackId,
        { adminReply, status },
        { new: true }
    );

    if (!feedback) {
        console.error("❌ [Admin][Feedback] Feedback not found:", feedbackId);
        throw new ApiError(404, "Feedback not found");
    }

    console.log("✅ [Admin][Feedback] Reply saved:", feedback._id);

    res.json({
        success: true,
        message: "Feedback replied successfully",
        data: feedback,
    });
});

/**
 * Toggle block / unblock feedback
 */
export const toggleFeedbackBlock = asyncHandler(async (req, res) => {
    const feedbackId = req.params.id;
    console.log("🚫 [Admin][Feedback] Toggle block request:", feedbackId);

    const feedback = await Feedback.findById(feedbackId);

    if (!feedback) {
        console.error("❌ [Admin][Feedback] Feedback not found:", feedbackId);
        throw new ApiError(404, "Feedback not found");
    }

    feedback.isBlocked = !feedback.isBlocked;
    await feedback.save();

    console.log("✅ [Admin][Feedback] Block status updated:", {
        feedbackId: feedback._id,
        isBlocked: feedback.isBlocked,
    });

    res.json({
        success: true,
        message: feedback.isBlocked
            ? "Feedback blocked successfully"
            : "Feedback unblocked successfully",
        data: {
            id: feedback._id,
            isBlocked: feedback.isBlocked,
        },
    });
});

/**
 * Delete feedback
 */
export const deleteFeedback = asyncHandler(async (req, res) => {
    const feedbackId = req.params.id;
    console.log("🗑️ [Admin][Feedback] Delete request:", feedbackId);

    const deleted = await Feedback.findByIdAndDelete(feedbackId);

    if (!deleted) {
        console.error("❌ [Admin][Feedback] Feedback not found:", feedbackId);
        throw new ApiError(404, "Feedback not found");
    }

    console.log("✅ [Admin][Feedback] Feedback deleted:", feedbackId);

    res.json({
        success: true,
        message: "Feedback deleted",
    });
});
