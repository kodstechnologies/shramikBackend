import ApiResponse from "../../utils/ApiResponse.js";
import ApiError from "../../utils/ApiError.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { RecruiterJob } from "../../models/recruiter/jobPost/jobPost.model.js";
import { Application } from "../../models/jobSeeker/application.model.js";

/**
 * Get Suggested Jobs For Job Seeker
 * Returns jobs matching the job seeker's skills from registration
 * Requires: Job Seeker authentication (JWT token)
 */
export const getSuggestedJobs = asyncHandler(async (req, res) => {
  const jobSeeker = req.jobSeeker;

  if (!jobSeeker) {
    throw new ApiError(401, "Unauthorized: Job seeker not found");
  }

  const {
    page = 1,
    limit = 10,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = req.query;

  // Get job seeker's skills
  const userSkills = jobSeeker.selectedSkills || jobSeeker.skills || [];

  if (userSkills.length === 0) {
    // If no skills, return empty result with message
    return res.status(200).json(
      ApiResponse.success(
        {
          jobs: [],
          pagination: {
            currentPage: 1,
            totalPages: 0,
            totalJobs: 0,
            limit: parseInt(limit),
            hasNextPage: false,
            hasPrevPage: false,
          },
          message: "No skills found. Please complete your profile with skills to get job suggestions.",
        },
        "No suggested jobs available"
      )
    );
  }

  // Normalize user skills: trim and filter empty strings
  const normalizedUserSkills = userSkills
    .map((skill) => skill.trim())
    .filter((skill) => skill.length > 0);

  // Build filter for suggested jobs
  const filter = {
    status: "Open", // Only show open jobs
    jobSeekerCategory: jobSeeker.category, // Only show jobs for this job seeker's category
  };

  // Get jobs the user has already applied for and exclude them
  const appliedApplications = await Application.find(
    { jobSeeker: jobSeeker._id },
    { job: 1 }
  ).lean();
  const appliedJobIds = appliedApplications.map((app) => app.job);

  if (appliedJobIds.length > 0) {
    filter._id = { $nin: appliedJobIds }; // Exclude already applied jobs
  }

  // Match jobs based on skills field
  // If job's skills array contains at least one skill from job seeker's skills, show that job
  // Use $in operator to check if any of the job seeker's skills exist in the job's skills array
  if (normalizedUserSkills.length > 0) {
    filter.skills = { $in: normalizedUserSkills };
  } else {
    // If no skills, return empty result (already handled above, but keeping as safety)
    return res.status(200).json(
      ApiResponse.success(
        {
          jobs: [],
          pagination: {
            currentPage: 1,
            totalPages: 0,
            totalJobs: 0,
            limit: parseInt(limit),
            hasNextPage: false,
            hasPrevPage: false,
          },
          message: "No skills found. Please complete your profile with skills to get job suggestions.",
        },
        "No suggested jobs available"
      )
    );
  }

  // Pagination
  const pageNumber = Math.max(1, parseInt(page));
  const limitNumber = Math.min(100, Math.max(1, parseInt(limit)));
  const skip = (pageNumber - 1) * limitNumber;

  // Sort options
  const sortOptions = {};
  if (sortBy === "salary") {
    sortOptions["expectedSalary.min"] = sortOrder === "asc" ? 1 : -1;
  } else if (sortBy === "experience") {
    sortOptions["experienceRange.minYears"] = sortOrder === "asc" ? 1 : -1;
  } else {
    sortOptions[sortBy] = sortOrder === "asc" ? 1 : -1;
  }

  // Fetch suggested jobs with pagination
  const jobs = await RecruiterJob.find(filter)
    .populate("recruiter", "companyName companyLogo city state email phone")
    .sort(sortOptions)
    .skip(skip)
    .limit(limitNumber)
    .lean();

  // Get total count
  const totalJobs = await RecruiterJob.countDocuments(filter);
  const totalPages = Math.ceil(totalJobs / limitNumber);

  // Format jobs with summary and matched skills
  const formattedJobs = jobs.map((job) => {
    const salaryLabel = `₹${Math.round(job.expectedSalary.min).toLocaleString("en-IN")} - ₹${Math.round(
      job.expectedSalary.max
    ).toLocaleString("en-IN")}/${job.expectedSalary.payPeriod === "monthly" ? "month" : "year"}`;

    const experienceLabel = job.experienceRange.maxYears
      ? `${job.experienceRange.minYears}-${job.experienceRange.maxYears} YoE`
      : `${job.experienceRange.minYears}+ YoE`;

    // Find which skills matched between job seeker and job
    const jobSkills = (job.skills || []).map((s) => s.trim());
    const matchedSkills = normalizedUserSkills.filter((userSkill) =>
      jobSkills.includes(userSkill)
    );

    return {
      _id: job._id,
      jobTitle: job.jobTitle,
      jobDescription: job.jobDescription,
      city: job.city,
      expectedSalary: job.expectedSalary,
      salaryLabel,
      employeeCount: job.employeeCount,
      jobType: job.jobType,
      employmentMode: job.employmentMode,
      categories: job.categories,
      tags: job.tags,
      skills: jobSkills,
      matchedSkills: matchedSkills, // Skills that matched between job seeker and job
      benefits: job.benefits,
      experienceRange: job.experienceRange,
      experienceLabel,
      qualifications: job.qualifications,
      responsibilities: job.responsibilities,
      companySnapshot: job.companySnapshot,
      recruiter: job.recruiter,
      status: job.status,
      applicationCount: job.applicationCount,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      summary: {
        salaryLabel,
        experienceLabel,
        jobTags: [
          job.jobType,
          job.employmentMode,
          experienceLabel,
        ],
        matchedSkillsCount: matchedSkills.length,
      },
    };
  });

  return res.status(200).json(
    ApiResponse.success(
      {
        jobs: formattedJobs,
        pagination: {
          currentPage: pageNumber,
          totalPages,
          totalJobs,
          limit: limitNumber,
          hasNextPage: pageNumber < totalPages,
          hasPrevPage: pageNumber > 1,
        },
        userSkills: normalizedUserSkills, // Include user's skills in response
        matchedSkillsCount: normalizedUserSkills.length,
      },
      `Found ${totalJobs} suggested job${totalJobs !== 1 ? "s" : ""} based on your skills`
    )
  );
});

