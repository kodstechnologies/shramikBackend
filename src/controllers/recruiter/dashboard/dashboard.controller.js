import { RecruiterJob } from "../../../models/recruiter/jobPost/jobPost.model.js";
import { Application } from "../../../models/jobSeeker/application.model.js";
import ApiResponse from "../../../utils/ApiResponse.js";
import { asyncHandler } from "../../../utils/asyncHandler.js";

/**
 * Get Recruiter Dashboard
 * Returns job statistics for the authenticated recruiter
 * For recent job posts, use the /recent-jobs endpoint
 */
export const getRecruiterDashboard = asyncHandler(async (req, res) => {
  const recruiter = req.recruiter; // From auth middleware

  // Get all jobs for this recruiter
  const allJobs = await RecruiterJob.find({ recruiter: recruiter._id }).lean();

  // Calculate statistics
  const postedJobs = allJobs.length;
  const activeJobs = allJobs.filter((job) => job.status === "Open").length;

  // Get all job IDs for this recruiter
  const jobIds = allJobs.map((job) => job._id);

  // Get application counts
  const totalApplications = await Application.countDocuments({
    job: { $in: jobIds },
    status: { $nin: ["Withdrawn", "Shortlisted", "Rejected"] }, // Exclude withdrawn, shortlisted, and rejected applications
  });

  const shortlistedApplications = await Application.countDocuments({
    job: { $in: jobIds },
    status: "Shortlisted",
  });

  return res.status(200).json(
    ApiResponse.success(
      {
        statistics: {
          postedJobs,
          activeJobs,
          applications: totalApplications,
          shortlisted: shortlistedApplications,
        },
      },
      "Dashboard data fetched successfully"
    )
  );
});

/**
 * Get Recent Job Posts
 * Returns recent job posts for the authenticated recruiter with applicant counts
 */
export const getRecentJobPosts = asyncHandler(async (req, res) => {
  const recruiter = req.recruiter; // From auth middleware
  const { limit = 10, page = 1 } = req.query;

  // Pagination
  const pageNumber = Math.max(1, parseInt(page));
  const limitNumber = Math.min(50, Math.max(1, parseInt(limit))); // Max 50 per page
  const skip = (pageNumber - 1) * limitNumber;

  // Get total count for pagination
  const totalJobs = await RecruiterJob.countDocuments({ recruiter: recruiter._id });

  // Get recent job posts (sorted by creation date)
  const recentJobs = await RecruiterJob.find({ recruiter: recruiter._id })
    .select("jobTitle status applicationCount createdAt city jobType employmentMode")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limitNumber)
    .lean();

  // Get application counts for each recent job
  const recentJobsWithApplicants = await Promise.all(
    recentJobs.map(async (job) => {
      const applicantCount = await Application.countDocuments({
        job: job._id,
        status: { $ne: "Withdrawn" },
      });

      // Calculate days ago
      const daysAgo = Math.floor(
        (Date.now() - new Date(job.createdAt).getTime()) / (1000 * 60 * 60 * 24)
      );

      return {
        _id: job._id,
        jobTitle: job.jobTitle,
        status: job.status,
        city: job.city,
        jobType: job.jobType,
        employmentMode: job.employmentMode,
        applicantCount,
        daysAgo: daysAgo === 0 ? "Today" : `${daysAgo} day${daysAgo > 1 ? "s" : ""} ago`,
        createdAt: job.createdAt,
      };
    })
  );

  const totalPages = Math.ceil(totalJobs / limitNumber);

  return res.status(200).json(
    ApiResponse.success(
      {
        jobs: recentJobsWithApplicants,
        pagination: {
          currentPage: pageNumber,
          totalPages,
          totalJobs,
          limit: limitNumber,
          hasNextPage: pageNumber < totalPages,
          hasPrevPage: pageNumber > 1,
        },
      },
      "Recent job posts fetched successfully"
    )
  );
});

