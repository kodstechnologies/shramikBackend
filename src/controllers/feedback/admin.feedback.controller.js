import { Feedback } from "../../models/jobSeeker/feedback.model.js";
import { JobSeeker } from "../../models/jobSeeker/jobSeeker.model.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import ApiError from "../../utils/ApiError.js";
import mongoose from "mongoose";

/**
 * API 1: Get & Analytics API
 * GET /admin?type=...&category=...&job_id=...
 */
export const getAllFeedback = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, type, category, job_id } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    console.log(`🔍 [AdminFeedback] Fetching feedback - Page: ${page}, Limit: ${limit}`);

    // Build Dynamic Filter
    let filter = {};
    if (type === "Job Feedback") filter.job = { $exists: true };
    if (type === "App Feedback") filter.job = { $exists: false };
    if (category) filter.appCategory = category;
    if (job_id) {
        if (!mongoose.Types.ObjectId.isValid(job_id)) throw new ApiError(400, "Invalid Job ID format");
        filter.job = new mongoose.Types.ObjectId(job_id);
    }

    console.log("🛠️ [AdminFeedback] Active Filters:", JSON.stringify(filter));

    const results = await Feedback.aggregate([
        { $match: filter },
        {
            $facet: {
                metadata: [
                    { $group: { _id: null, total_count: { $sum: 1 }, averageRating: { $avg: "$rating" } } }
                ],
                data: [
                    { $sort: { createdAt: -1 } },
                    { $skip: skip },
                    { $limit: parseInt(limit) },
                    {
                        $lookup: {
                            from: "jobseekers",
                            localField: "jobSeeker",
                            foreignField: "_id",
                            as: "jobSeekerDetails"
                        }
                    },
                    { $unwind: { path: "$jobSeekerDetails", preserveNullAndEmptyArrays: true } }
                ]
            }
        }
    ]);

    const analytics = results[0].metadata[0] || { total_count: 0, averageRating: 0 };

    console.log(`✅ [AdminFeedback] Found ${analytics.total_count} records. Avg Rating: ${analytics.averageRating}`);

    res.status(200).json({
        success: true,
        page: parseInt(page),
        limit: parseInt(limit),
        total_count: analytics.total_count,
        average_rating: analytics.averageRating?.toFixed(2) || 0,
        data: results[0].data
    });
});

/**
 * API 2: Delete API
 * DELETE /admin/:id
 */
export const deleteFeedback = asyncHandler(async (req, res) => {
    const { id } = req.params;
    console.log(`🗑️ [AdminFeedback] Attempting to delete feedback ID: ${id}`);

    const feedback = await Feedback.findByIdAndDelete(id);

    if (!feedback) {
        console.error(`❌ [AdminFeedback] Delete failed: Feedback ${id} not found`);
        throw new ApiError(404, "Feedback not found");
    }

    console.log(`✅ [AdminFeedback] Feedback ${id} deleted successfully`);
    res.status(200).json({ success: true, message: "Feedback entry removed" });
});

/**
 * API 3: Response API
 * PATCH /admin/:id/reply
 */
export const replyToFeedback = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { adminReply, status } = req.body;

    // Validation for status: Default to REPLIED if not provided, but allow RESOLVED
    const validStatuses = ["PENDING", "REPLIED", "RESOLVED"];
    const updatedStatus = status && validStatuses.includes(status) ? status : "REPLIED";

    console.log(`💬 [AdminFeedback] Replying to ${id}. New Status: ${updatedStatus}`);

    const feedback = await Feedback.findByIdAndUpdate(
        id,
        {
            adminReply,
            status: updatedStatus
        },
        { new: true, runValidators: true }
    );

    if (!feedback) {
        console.error(`❌ [AdminFeedback] Reply failed: Feedback ${id} not found`);
        throw new ApiError(404, "Feedback not found");
    }

    console.log(`✅ [AdminFeedback] Reply saved for ${id}. Status is now ${feedback.status}`);

    res.status(200).json({
        success: true,
        message: `Feedback marked as ${feedback.status}`,
        data: feedback
    });
});

/**
 * API 4: Targeted Block API
 * POST /admin/block-target
 */
export const targetBlockJobseeker = asyncHandler(async (req, res) => {
    const { jobSeekerId, jobId } = req.body;

    console.log(`🚫 [AdminFeedback] Blocking JobSeeker ${jobSeekerId} from Job ${jobId}`);

    if (!jobSeekerId || !jobId) {
        throw new ApiError(400, "JobSeekerId and JobId are required for blocking");
    }

    const jobSeeker = await JobSeeker.findByIdAndUpdate(
        jobSeekerId,
        { $addToSet: { blockedJobs: jobId } },
        { new: true }
    );

    if (!jobSeeker) {
        console.error(`❌ [AdminFeedback] Block failed: JobSeeker ${jobSeekerId} not found`);
        throw new ApiError(404, "JobSeeker not found");
    }

    console.log(`✅ [AdminFeedback] User ${jobSeekerId} successfully restricted from Job ${jobId}`);

    res.status(200).json({
        success: true,
        message: "JobSeeker blocked from sending feedback to this specific job"
    });
});