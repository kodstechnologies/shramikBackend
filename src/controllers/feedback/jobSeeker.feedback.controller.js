
//     console.log("📩 [Feedback] Submit request received");

//     const {
//         appCategory,
//         appSubCategory,
//         jobId,
//         jobSubCategory,
//         message,
//         rating,
//     } = req.body;

//     const jobSeekerId = req.jobSeeker?._id;

//     console.log("👤 [Feedback] JobSeeker ID:", jobSeekerId);

//     console.log("📥 [Feedback] Payload snapshot:", {
//         appCategory,
//         appSubCategory,
//         jobId,
//         jobSubCategory,
//         rating,
//         messageLength: message?.length,
//     });

//     // 🔐 Validate job feedback only if jobId exists
//     if (jobId) {
//         console.log("🔎 [Feedback] Job ID provided, validating application:", jobId);

//         const applied = await Application.findOne({
//             job: jobId,
//             jobSeeker: jobSeekerId,
//         }).lean();

//         if (!applied) {
//             console.warn("🚫 [Feedback] Job feedback rejected — job not applied", {
//                 jobId,
//                 jobSeekerId,
//             });

//             throw new ApiError(
//                 403,
//                 "You can only submit feedback for jobs you have applied for"
//             );
//         }

//         console.log("✅ [Feedback] Application found for job feedback");
//     } else {
//         console.log("ℹ️ [Feedback] No jobId provided — app/general feedback");
//     }

//     const feedbackData = {
//         jobSeeker: jobSeekerId,

//         job: jobId || undefined,

//         // App feedback
//         appCategory: appCategory || null,
//         appSubCategory: appSubCategory || null,

//         // Job feedback
//         jobSubCategory: jobSubCategory || null,

//         message,
//         rating,
//     };

//     console.log("📝 [Feedback] Final data before save:", feedbackData);

//     const feedback = await Feedback.create(feedbackData);

//     console.log("✅ [Feedback] Feedback saved successfully", {
//         feedbackId: feedback._id,
//         createdAt: feedback.createdAt,
//     });

//     res.status(201).json({
//         success: true,
//         message: "Feedback submitted successfully",
//         data: feedback,
//     });
// });
import { asyncHandler } from "../../utils/asyncHandler.js";
import { Feedback } from "../../models/jobSeeker/feedback.model.js";
import { Application } from "../../models/jobSeeker/application.model.js";
import ApiError from "../../utils/ApiError.js";

export const submitFeedback = asyncHandler(async (req, res) => {
    console.log("📩 [Feedback] Submit request received");

    const {
        appCategory,
        appSubCategory,
        jobId,
        jobSubCategory,
        message,
        rating,
    } = req.body;

    const jobSeeker = req.jobSeeker; // Get the full user object from middleware
    const jobSeekerId = jobSeeker?._id;

    console.log("👤 [Feedback] JobSeeker ID:", jobSeekerId);

    // 1. 🛡️ TARGETED BLOCK CHECK
    // Logic: Check if the current jobId is in the user's blockedJobs array
    if (jobId && jobSeeker?.blockedJobs?.includes(jobId)) {
        console.warn(`🚫 [Feedback] Submission blocked for JobSeeker ${jobSeekerId} on Job ${jobId}`);
        throw new ApiError(
            403,
            "Blocked: You are restricted from sending feedback for this specific job."
        );
    }

    // 🔐 Validate job feedback only if jobId exists
    let resolvedJobId = jobId;

    if (jobId) {
        console.log("🔎 [Feedback] Job ID provided, validating application:", jobId);

        // First try to find application by job ID
        let applied = await Application.findOne({
            job: jobId,
            jobSeeker: jobSeekerId,
        }).lean();

        // If not found, check if jobId is actually an applicationId
        if (!applied) {
            console.log("🔍 [Feedback] No application found with job ID, checking if it's an application ID...");

            const applicationById = await Application.findOne({
                _id: jobId,
                jobSeeker: jobSeekerId,
            }).lean();

            if (applicationById) {
                console.log("✅ [Feedback] Found application by ID, resolving to job:", applicationById.job);
                resolvedJobId = applicationById.job;
                applied = applicationById;
            }
        }

        if (!applied) {
            console.warn("🚫 [Feedback] Job feedback rejected — job not applied", {
                jobId,
                jobSeekerId,
            });

            throw new ApiError(
                403,
                "You can only submit feedback for jobs you have applied for"
            );
        }

        console.log("✅ [Feedback] Application found for job feedback, resolved jobId:", resolvedJobId);
    } else {
        console.log("ℹ️ [Feedback] No jobId provided — app/general feedback");
    }

    const feedbackData = {
        jobSeeker: jobSeekerId,
        job: resolvedJobId || undefined,
        appCategory: appCategory || null,
        appSubCategory: appSubCategory || null,
        jobSubCategory: jobSubCategory || null,
        message,
        rating,
    };

    console.log("📝 [Feedback] Final data before save:", feedbackData);

    const feedback = await Feedback.create(feedbackData);

    console.log("✅ [Feedback] Feedback saved successfully", {
        feedbackId: feedback._id,
        createdAt: feedback.createdAt,
    });

    res.status(201).json({
        success: true,
        message: "Feedback submitted successfully",
        data: feedback,
    });
});