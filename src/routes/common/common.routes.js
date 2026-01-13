import { Router } from "express";
import { JobSeeker } from "../../models/jobSeeker/jobSeeker.model.js";
import { Recruiter } from "../../models/recruiter/recruiter.model.js";
import { Application } from "../../models/jobSeeker/application.model.js";
import { Referral } from "../../models/referral/referral.model.js";
import { RecruiterJob } from "../../models/recruiter/jobPost/jobPost.model.js";
import ApiResponse from "../../utils/ApiResponse.js";
import ApiError from "../../utils/ApiError.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { verifyAccessToken } from "../../utils/jwtToken.js";

const router = Router();

/**
 * Unified Check Block Status API
 * Works for both JobSeeker and Recruiter
 * Frontend should call this periodically to check if user is blocked
 * If blocked, returns shouldLogout: true and frontend should immediately logout
 * 
 * @route GET /api/common/check-block-status
 * @requires Authentication (JWT token)
 */
const checkBlockStatus = asyncHandler(async (req, res) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        throw new ApiError(401, "Access token is required");
    }

    const token = authHeader.split(" ")[1];

    let decoded;
    try {
        decoded = verifyAccessToken(token);
    } catch (error) {
        if (error.name === "TokenExpiredError") {
            throw new ApiError(401, "Access token expired. Please refresh token.");
        }
        throw new ApiError(401, "Invalid access token");
    }

    const userId = decoded.id;
    const role = decoded.role;

    let user = null;
    let userType = null;
    let UserModel = null;

    // Check based on role from token
    if (role === "recruiter") {
        user = await Recruiter.findById(userId).select("isBlocked status").lean();
        userType = "Recruiter";
        UserModel = Recruiter;
    } else if (role === "Worker" || role === "Contractor" || role === "Admin") {
        user = await JobSeeker.findById(userId).select("isBlocked status").lean();
        userType = "JobSeeker";
        UserModel = JobSeeker;
    } else {
        // Try both tables if role is unclear
        user = await JobSeeker.findById(userId).select("isBlocked status").lean();
        if (user) {
            userType = "JobSeeker";
            UserModel = JobSeeker;
        } else {
            user = await Recruiter.findById(userId).select("isBlocked status").lean();
            userType = "Recruiter";
            UserModel = Recruiter;
        }
    }

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    const isBlocked = user.isBlocked === true;
    const isInactive = user.status === "Inactive" || user.status === "Rejected";

    if (isBlocked || isInactive) {
        // ✅ AUTOMATIC LOGOUT: Clear refresh token to invalidate session
        await UserModel.findByIdAndUpdate(userId, {
            refreshToken: null
        });

        console.log(`🚫 User blocked/inactive - Session invalidated: ${userType} ${userId}`);

        return res.status(403).json(
            ApiResponse.error(
                {
                    shouldLogout: true,
                    sessionInvalidated: true,
                    reason: isBlocked ? "blocked" : "inactive",
                    userType,
                },
                isBlocked
                    ? "Your account has been blocked. Please contact support."
                    : "Your account is no longer active. Please contact support."
            )
        );
    }

    return res.status(200).json(
        ApiResponse.success(
            {
                shouldLogout: false,
                isBlocked: false,
                status: user.status,
                userType,
            },
            "Account is active"
        )
    );
});

/**
 * Unified Delete Account API
 * Works for both JobSeeker and Recruiter
 * Permanently deletes the user account and all related data
 * 
 * @route DELETE /api/common/delete-account
 * @requires Authentication (JWT token)
 */
const deleteAccount = asyncHandler(async (req, res) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        throw new ApiError(401, "Access token is required");
    }

    const token = authHeader.split(" ")[1];

    let decoded;
    try {
        decoded = verifyAccessToken(token);
    } catch (error) {
        if (error.name === "TokenExpiredError") {
            throw new ApiError(401, "Access token expired. Please refresh token.");
        }
        throw new ApiError(401, "Invalid access token");
    }

    const userId = decoded.id;
    const role = decoded.role;

    let user = null;
    let userType = null;

    console.log(`🗑️ ═══════════════════════════════════════════════════`);
    console.log(`🗑️ DELETE ACCOUNT REQUEST`);
    console.log(`🗑️ User ID: ${userId}`);
    console.log(`🗑️ Role: ${role}`);

    // Determine user type based on role from token
    if (role === "recruiter") {
        user = await Recruiter.findById(userId);
        userType = "Recruiter";
    } else if (role === "Worker" || role === "Contractor" || role === "Admin") {
        user = await JobSeeker.findById(userId);
        userType = "JobSeeker";
    } else {
        // Try both tables if role is unclear
        user = await JobSeeker.findById(userId);
        if (user) {
            userType = "JobSeeker";
        } else {
            user = await Recruiter.findById(userId);
            userType = "Recruiter";
        }
    }

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    console.log(`🗑️ User Type: ${userType}`);
    console.log(`🗑️ User Phone: ${user.phone}`);

    let deletedData = {
        applications: 0,
        jobPosts: 0,
        referrals: 0,
    };

    try {
        if (userType === "JobSeeker") {
            // Delete all job applications by this job seeker
            const applicationResult = await Application.deleteMany({ jobSeeker: userId });
            deletedData.applications = applicationResult.deletedCount;
            console.log(`🗑️ Deleted ${deletedData.applications} applications`);

            // Update referrals where this user is the referee
            await Referral.updateMany(
                { referee: userId },
                { $set: { status: "deleted", note: "Referee account deleted" } }
            );

            // Update referrals where this user is the referrer
            const referralResult = await Referral.updateMany(
                { referrer: userId },
                { $set: { status: "deleted", note: "Referrer account deleted" } }
            );
            deletedData.referrals = referralResult.modifiedCount;
            console.log(`🗑️ Updated ${deletedData.referrals} referral records`);

            // Delete the job seeker account
            await JobSeeker.findByIdAndDelete(userId);
            console.log(`🗑️ Deleted JobSeeker account`);

        } else if (userType === "Recruiter") {
            // Get all job posts by this recruiter
            const jobPosts = await RecruiterJob.find({ recruiter: userId }).select("_id");
            const jobPostIds = jobPosts.map(job => job._id);

            // Delete all applications to recruiter's job posts
            if (jobPostIds.length > 0) {
                const applicationResult = await Application.deleteMany({ job: { $in: jobPostIds } });
                deletedData.applications = applicationResult.deletedCount;
                console.log(`🗑️ Deleted ${deletedData.applications} applications to recruiter's jobs`);
            }

            // Delete all job posts by this recruiter
            const jobPostResult = await RecruiterJob.deleteMany({ recruiter: userId });
            deletedData.jobPosts = jobPostResult.deletedCount;
            console.log(`🗑️ Deleted ${deletedData.jobPosts} job posts`);

            // Update referrals where this user is the referee
            await Referral.updateMany(
                { referee: userId },
                { $set: { status: "deleted", note: "Referee account deleted" } }
            );

            // Update referrals where this user is the referrer
            const referralResult = await Referral.updateMany(
                { referrer: userId },
                { $set: { status: "deleted", note: "Referrer account deleted" } }
            );
            deletedData.referrals = referralResult.modifiedCount;
            console.log(`🗑️ Updated ${deletedData.referrals} referral records`);

            // Delete the recruiter account
            await Recruiter.findByIdAndDelete(userId);
            console.log(`🗑️ Deleted Recruiter account`);
        }

        console.log(`🗑️ ✅ ACCOUNT DELETED SUCCESSFULLY`);
        console.log(`🗑️ ═══════════════════════════════════════════════════`);

        return res.status(200).json(
            ApiResponse.success(
                {
                    userType,
                    deletedData,
                },
                "Account deleted successfully"
            )
        );

    } catch (error) {
        console.error(`🗑️ ❌ ERROR deleting account:`, error);
        throw new ApiError(500, "Failed to delete account. Please try again.");
    }
});

router.get("/check-block-status", checkBlockStatus);
router.delete("/delete-account", deleteAccount);

export default router;

