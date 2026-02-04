import ApiResponse from "../../utils/ApiResponse.js";
import ApiError from "../../utils/ApiError.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { RecruiterJob } from "../../models/recruiter/jobPost/jobPost.model.js";
import { Application } from "../../models/jobSeeker/application.model.js";
import { CoinRule } from "../../models/admin/coinPricing/coinPricing.model.js";

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

  // Get coin cost per application from CoinRule
  const coinRule = await CoinRule.findOne({ category: "jobSeeker" }).lean();
  const coinCostPerApplication = coinRule?.coinCostPerApplication || 0;

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

  // Use aggregation pipeline to filter by recruiter blocked status
  const pipeline = [
    // 1. Initial match for open jobs and category
    {
      $match: {
        ...filter,
        // Exclude skills filtering here if empty (though logic prevents this case)
      }
    },
    // 2. Lookup recruiter to check blocked status
    {
      $lookup: {
        from: "recruiters",
        localField: "recruiter",
        foreignField: "_id",
        as: "recruiterDetails"
      }
    },
    // 3. Unwind recruiter details (preserveNullAndEmptyArrays not needed as job MUST have recruiter)
    {
      $unwind: "$recruiterDetails"
    },
    // 4. Filter out jobs where recruiter is blocked
    {
      $match: {
        "recruiterDetails.isBlocked": { $ne: true },  // Keep if not blocked or isBlocked field missing
        "recruiterDetails.status": { $ne: "Inactive" } // Also filter inactive recruiters
      }
    },
    // 5. Sort based on criteria
    {
      $sort: sortOptions
    },
    // 6. Pagination
    {
      $skip: skip
    },
    {
      $limit: limitNumber
    },
    // 7. Project fields needed (and map recruiterDetails back to recruiter)
    {
      $project: {
        ...Object.keys(RecruiterJob.schema.paths).reduce((acc, key) => {
          acc[key] = 1;
          return acc;
        }, {}),
        recruiter: {
          _id: "$recruiterDetails._id",
          companyName: "$recruiterDetails.companyName",
          companyLogo: "$recruiterDetails.companyLogo",
          city: "$recruiterDetails.city",
          state: "$recruiterDetails.state",
          email: "$recruiterDetails.email",
          phone: "$recruiterDetails.phone"
        }
      }
    }
  ];

  // Execute aggregation
  const jobs = await RecruiterJob.aggregate(pipeline);

  // Get total count (separate query for pagination metadata)
  // We need to replicate the filter logic for count
  const countPipeline = [
    { $match: filter },
    {
      $lookup: {
        from: "recruiters",
        localField: "recruiter",
        foreignField: "_id",
        as: "recruiterDetails"
      }
    },
    { $unwind: "$recruiterDetails" },
    {
      $match: {
        "recruiterDetails.isBlocked": { $ne: true },
        "recruiterDetails.status": { $ne: "Inactive" }
      }
    },
    { $count: "total" }
  ];

  const countResult = await RecruiterJob.aggregate(countPipeline);
  const totalJobs = countResult.length > 0 ? countResult[0].total : 0;

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
      coinCostPerApplication, // Coin cost to apply for this job
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
        coinCostPerApplication, // Coin cost to apply for a job
      },
      `Found ${totalJobs} suggested job${totalJobs !== 1 ? "s" : ""} based on your skills`
    )
  );
});

