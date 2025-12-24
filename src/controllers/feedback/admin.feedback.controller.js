import { Feedback } from "../../models/jobSeeker/feedback.model.js";
import { JobSeeker } from "../../models/jobSeeker/jobSeeker.model.js";
import { Recruiter } from "../../models/recruiter/recruiter.model.js";
import { RecruiterJob } from "../../models/recruiter/jobPost/jobPost.model.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import ApiError from "../../utils/ApiError.js";
import mongoose from "mongoose";
import { fcmService } from "../../firebase/fcm.service.js";
import Notification from "../../firebase/notification.model.js";

/**
 * API 1: Get & Analytics API
 * GET /admin?type=...&category=...&job_id=...&status=...
 */
export const getAllFeedback = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, type, category, job_id, status } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    console.log(`🔍 [AdminFeedback] Fetching feedback - Page: ${page}, Limit: ${limit}`);

    // Build Dynamic Filter
    let filter = {};
    if (type === "Job Feedback") filter.job = { $exists: true, $ne: null };
    if (type === "App Feedback") filter.job = { $exists: false };
    if (category) filter.appCategory = category;
    if (status) filter.status = status;
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
                statusCounts: [
                    { $group: { _id: "$status", count: { $sum: 1 } } }
                ],
                data: [
                    { $sort: { createdAt: -1 } },
                    { $skip: skip },
                    { $limit: parseInt(limit) },
                    // Lookup job seeker
                    {
                        $lookup: {
                            from: "jobseekers",
                            localField: "jobSeeker",
                            foreignField: "_id",
                            as: "jobSeekerDetails"
                        }
                    },
                    { $unwind: { path: "$jobSeekerDetails", preserveNullAndEmptyArrays: true } },
                    // Lookup job post
                    {
                        $lookup: {
                            from: "recruiterjobs",
                            localField: "job",
                            foreignField: "_id",
                            as: "jobDetails"
                        }
                    },
                    { $unwind: { path: "$jobDetails", preserveNullAndEmptyArrays: true } },
                    // Lookup recruiter from job
                    {
                        $lookup: {
                            from: "recruiters",
                            localField: "jobDetails.recruiter",
                            foreignField: "_id",
                            as: "recruiterDetails"
                        }
                    },
                    { $unwind: { path: "$recruiterDetails", preserveNullAndEmptyArrays: true } },
                    // Project only needed fields
                    {
                        $project: {
                            _id: 1,
                            message: 1,
                            rating: 1,
                            appCategory: 1,
                            status: 1,
                            adminReply: 1,
                            createdAt: 1,
                            updatedAt: 1,
                            jobSeeker: {
                                _id: "$jobSeekerDetails._id",
                                name: "$jobSeekerDetails.name",
                                phone: "$jobSeekerDetails.phone",
                                email: "$jobSeekerDetails.email",
                                profilePhoto: "$jobSeekerDetails.profilePhoto"
                            },
                            job: {
                                _id: "$jobDetails._id",
                                jobTitle: "$jobDetails.jobTitle",
                                city: "$jobDetails.city",
                                status: "$jobDetails.status",
                                jobType: "$jobDetails.jobType"
                            },
                            recruiter: {
                                _id: "$recruiterDetails._id",
                                companyName: "$recruiterDetails.companyName",
                                name: "$recruiterDetails.name",
                                phone: "$recruiterDetails.phone",
                                companyLogo: "$recruiterDetails.companyLogo",
                                isBlocked: "$recruiterDetails.isBlocked"
                            }
                        }
                    }
                ]
            }
        }
    ]);

    const analytics = results[0].metadata[0] || { total_count: 0, averageRating: 0 };

    // Build status counts
    const statusCountsMap = { PENDING: 0, REPLIED: 0, RESOLVED: 0 };
    results[0].statusCounts.forEach(s => {
        statusCountsMap[s._id] = s.count;
    });

    console.log(`✅ [AdminFeedback] Found ${analytics.total_count} records. Avg Rating: ${analytics.averageRating}`);

    res.status(200).json({
        success: true,
        page: parseInt(page),
        limit: parseInt(limit),
        total_count: analytics.total_count,
        average_rating: analytics.averageRating?.toFixed(2) || 0,
        statusCounts: statusCountsMap,
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
    ).populate("jobSeeker", "_id name");

    if (!feedback) {
        console.error(`❌ [AdminFeedback] Reply failed: Feedback ${id} not found`);
        throw new ApiError(404, "Feedback not found");
    }

    console.log(`✅ [AdminFeedback] Reply saved for ${id}. Status is now ${feedback.status}`);

    // Send push notification to the job seeker
    if (feedback.jobSeeker?._id) {
        try {
            const notificationTitle = updatedStatus === "RESOLVED"
                ? "✅ Feedback Resolved"
                : "💬 Admin Replied to Your Feedback";
            const notificationBody = `Your feedback has been ${updatedStatus.toLowerCase()}. Check it out!`;

            await fcmService.sendToUser(feedback.jobSeeker._id, "JobSeeker", {
                title: notificationTitle,
                body: notificationBody,
                data: {
                    type: "feedback_reply",
                    feedbackId: feedback._id.toString(),
                    status: feedback.status
                }
            });

            // Save notification to database
            await Notification.create({
                title: notificationTitle,
                body: notificationBody,
                recipientType: "specific",
                recipients: [{
                    userId: feedback.jobSeeker._id,
                    userType: "JobSeeker",
                    status: "sent",
                    sentAt: new Date()
                }],
                data: {
                    type: "feedback_reply",
                    feedbackId: feedback._id.toString(),
                    status: feedback.status
                },
                status: "sent",
                sentAt: new Date()
            });

            console.log(`📲 [AdminFeedback] Notification sent to JobSeeker ${feedback.jobSeeker._id}`);
        } catch (err) {
            console.error(`❌ [AdminFeedback] Failed to send notification:`, err.message);
        }
    }

    res.status(200).json({
        success: true,
        message: `Feedback marked as ${feedback.status}`,
        data: feedback
    });
});

/**
 * API 4: Targeted Block API
 * POST /admin/block-target
 * Blocks the Recruiter who posted the job
 */
export const targetBlockRecruiter = asyncHandler(async (req, res) => {
    const { recruiterId, jobId, reason } = req.body;

    console.log(`🚫 [AdminFeedback] Blocking Recruiter ${recruiterId} based on feedback for Job ${jobId}`);

    if (!recruiterId) {
        throw new ApiError(400, "RecruiterId is required for blocking");
    }

    // Import Recruiter model
    const { Recruiter } = await import("../../models/recruiter/recruiter.model.js");

    const recruiter = await Recruiter.findByIdAndUpdate(
        recruiterId,
        {
            isBlocked: true,
            $set: { fcmTokens: [] }  // Log them out from all devices
        },
        { new: true }
    );

    if (!recruiter) {
        console.error(`❌ [AdminFeedback] Block failed: Recruiter ${recruiterId} not found`);
        throw new ApiError(404, "Recruiter not found");
    }

    console.log(`✅ [AdminFeedback] Recruiter ${recruiterId} (${recruiter.companyName || recruiter.phone}) has been blocked`);

    res.status(200).json({
        success: true,
        message: "Recruiter has been blocked successfully",
        data: {
            recruiterId: recruiter._id,
            companyName: recruiter.companyName,
            phone: recruiter.phone,
            isBlocked: recruiter.isBlocked,
            reason: reason || "Blocked from feedback review"
        }
    });
});

/**
 * API 5: Get Recruiter With Jobs
 * GET /admin/recruiter/:recruiterId/jobs
 * Returns recruiter details + their job posts
 */
export const getRecruiterWithJobs = asyncHandler(async (req, res) => {
    const { recruiterId } = req.params;

    console.log(`🔍 [AdminFeedback] Fetching Recruiter ${recruiterId} with jobs`);

    if (!mongoose.Types.ObjectId.isValid(recruiterId)) {
        throw new ApiError(400, "Invalid Recruiter ID format");
    }

    const recruiter = await Recruiter.findById(recruiterId)
        .select("name companyName phone email companyLogo businessType city state isBlocked coinBalance createdAt")
        .lean();

    if (!recruiter) {
        throw new ApiError(404, "Recruiter not found");
    }

    const jobs = await RecruiterJob.find({ recruiter: recruiterId })
        .select("jobTitle jobDescription city status jobType expectedSalary applicationCount createdAt")
        .sort({ createdAt: -1 })
        .lean();

    console.log(`✅ [AdminFeedback] Recruiter ${recruiterId} has ${jobs.length} jobs`);

    res.status(200).json({
        success: true,
        data: {
            recruiter,
            jobs,
            totalJobs: jobs.length
        }
    });
});

/**
 * API 6: Block Job Post
 * POST /admin/block-job
 * Closes/blocks a specific job post
 */
export const blockJobPost = asyncHandler(async (req, res) => {
    const { jobId, reason } = req.body;

    console.log(`🚫 [AdminFeedback] Blocking Job ${jobId}`);

    if (!jobId) {
        throw new ApiError(400, "JobId is required");
    }

    if (!mongoose.Types.ObjectId.isValid(jobId)) {
        throw new ApiError(400, "Invalid Job ID format");
    }

    const job = await RecruiterJob.findByIdAndUpdate(
        jobId,
        {
            status: "Closed",
            $set: { closedReason: reason || "Closed by admin from feedback review" }
        },
        { new: true }
    );

    if (!job) {
        throw new ApiError(404, "Job not found");
    }

    console.log(`✅ [AdminFeedback] Job ${jobId} (${job.jobTitle}) has been closed`);

    res.status(200).json({
        success: true,
        message: "Job post has been closed successfully",
        data: {
            jobId: job._id,
            jobTitle: job.jobTitle,
            status: job.status,
            reason: reason || "Closed by admin from feedback review"
        }
    });
});