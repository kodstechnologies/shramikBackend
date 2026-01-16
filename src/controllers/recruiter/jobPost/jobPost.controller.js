import ApiResponse from "../../../utils/ApiResponse.js";
import ApiError from "../../../utils/ApiError.js";
import { asyncHandler } from "../../../utils/asyncHandler.js";
import mongoose from "mongoose";
import { RecruiterJob } from "../../../models/recruiter/jobPost/jobPost.model.js";
import { City } from "../../../models/location/city.model.js";
import { State } from "../../../models/location/state.model.js";
import { Recruiter } from "../../../models/recruiter/recruiter.model.js";
import { Specialization } from "../../../models/admin/specialization/specialization.model.js";
import { CoinRule } from "../../../models/admin/coinPricing/coinPricing.model.js";
import { deductCoins, checkCoinBalance } from "../../../services/coin/coinService.js";
import { JobSeeker } from "../../../models/jobSeeker/jobSeeker.model.js";
import { fcmService } from "../../../firebase/fcm.service.js";
import Notification from "../../../firebase/notification.model.js";
import { Category } from "../../../models/category/category.model.js";
import { processReferralReward } from "../../../services/referral/referralService.js";
import { Application } from "../../../models/jobSeeker/application.model.js";

const normalizeArray = (value) => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

/**
 * Get all available skills from specializations
 * Same logic as /api/skills endpoint
 * Returns array of unique skill strings
 */
const getAllAvailableSkills = async () => {
  const specializations = await Specialization.find({ status: "Active" })
    .select("skills")
    .lean();

  // Collect all skills from all specializations
  const allSkills = [];
  specializations.forEach((spec) => {
    if (spec.skills && Array.isArray(spec.skills)) {
      allSkills.push(...spec.skills);
    }
  });

  // Remove duplicates and trim
  const uniqueSkills = [...new Set(allSkills)]
    .filter((skill) => skill && skill.trim()) // Remove empty strings
    .map((skill) => skill.trim()); // Trim whitespace

  return uniqueSkills;
};

/**
 * Parse salary from search term
 * Handles formats like: "50k", "5 lakhs", "50000", "50,000", "5L", etc.
 * Returns salary in monthly format (converts annual to monthly if needed)
 */
const parseSalaryFromSearch = (searchTerm) => {
  // Remove common words and extract numbers
  const cleaned = searchTerm.toLowerCase()
    .replace(/[,\s]/g, '') // Remove commas and spaces
    .replace(/lakhs?/gi, '00000') // Convert "lakhs" to 00000
    .replace(/l/gi, '00000') // Convert "L" or "l" to 00000
    .replace(/k/gi, '000') // Convert "k" to 000
    .replace(/thousand/gi, '000'); // Convert "thousand" to 000

  // Extract number from string
  const numberMatch = cleaned.match(/\d+/);
  if (!numberMatch) return null;

  let salary = parseFloat(numberMatch[0]);

  // If the original search term contains "lakh" or "LPA" or "per annum", it's likely annual
  const isAnnual = /lakh|lpa|per\s*annum|annual|yearly/gi.test(searchTerm);

  // Convert annual to monthly if needed (divide by 12)
  if (isAnnual && salary > 10000) {
    salary = Math.round(salary / 12);
  }

  return salary;
};

const buildCompanySnapshot = (recruiter, payload = {}) => {
  const snapshot = {
    name: payload.name || recruiter.companyName || "",
    industry: payload.industry || "",
    employeeCount: payload.employeesCount || payload.employeeCount || "",
    location:
      payload.location ||
      [recruiter.city, recruiter.state].filter(Boolean).join(", ") ||
      "",
    description: payload.description || "",
    logo: recruiter.companyLogo || recruiter.profilePhoto || "",
  };

  Object.keys(snapshot).forEach((key) => {
    if (snapshot[key] === undefined) {
      snapshot[key] = "";
    }
  });

  return snapshot;
};

export const createRecruiterJob = asyncHandler(async (req, res) => {
  const recruiter = req.recruiter;

  // Temporarily disabled - allow job posting without verification
  // if (!recruiter?.phoneVerified) {
  //   throw new ApiError(400, "Please complete recruiter verification first.");
  // }

  const {
    jobTitle,
    jobDescription,
    city,
    cityId,
    state,
    stateId,
    address,
    expectedSalaryMin,
    expectedSalaryMax,
    salaryCurrency = "INR",
    salaryPayPeriod = "monthly",
    employeeCount,
    vacancyCount,
    jobType,
    employmentMode,
    jobSeekerCategoryId,
    categories,
    tags,
    skills,
    benefits = {},
    experienceMinYears = 0,
    experienceMaxYears,
    preferredAgeMin,
    preferredAgeMax,
    qualifications = [],
    responsibilities = [],
    aboutCompany = {},
  } = req.body;

  // Resolve city name from cityId if provided
  let resolvedCity = city;
  if (cityId && !city) {
    const cityDoc = await City.findById(cityId).lean();
    if (cityDoc) {
      resolvedCity = cityDoc.name;
    }
  }

  // Debug: Log received state values
  console.log("📍 createRecruiterJob - Received state:", state, "stateId:", stateId, "address:", address);

  // Resolve state name from stateId if provided
  // Also handle empty string case (Flutter may send state: "" with stateId)
  let resolvedState = state && state.trim() ? state.trim() : null;
  if (stateId && !resolvedState) {
    const stateDoc = await State.findById(stateId).lean();
    if (stateDoc) {
      resolvedState = stateDoc.name;
      console.log("📍 Resolved state from stateId:", resolvedState);
    } else {
      console.log("⚠️ stateId provided but state not found in DB:", stateId);
    }
  }

  // Validate required fields: state and address
  if (!resolvedState) {
    throw new ApiError(400, "State is required. Provide either 'state' (name) or 'stateId' (ID).");
  }
  if (!address || !address.trim()) {
    throw new ApiError(400, "Address is required.");
  }

  // Look up jobSeekerCategory by ID
  if (!jobSeekerCategoryId) {
    throw new ApiError(400, "jobSeekerCategoryId is required");
  }

  const category = await Category.findById(jobSeekerCategoryId).lean();
  if (!category) {
    throw new ApiError(404, "Job Seeker Category not found");
  }

  // Use the category name for the jobSeekerCategory field
  const jobSeekerCategory = category.name;

  // Validate that the category name matches the allowed enum values
  const validCategories = ["Non-Degree Holder", "Diploma Holder", "ITI Holder"];
  if (!validCategories.includes(jobSeekerCategory)) {
    throw new ApiError(400, `Invalid job seeker category. Must be one of: ${validCategories.join(", ")}`);
  }

  const normalizedCategories = normalizeArray(categories);
  const normalizedTags = normalizeArray(tags);
  const normalizedSkills = normalizeArray(skills);
  const normalizedQualifications = normalizeArray(qualifications);
  const normalizedResponsibilities = normalizeArray(responsibilities);

  // Validate skills if provided - ensure they exist in /api/skills
  if (normalizedSkills.length > 0) {
    // Trim all skills before validation
    const trimmedSkills = normalizedSkills.map((skill) => skill.trim()).filter((skill) => skill);

    if (trimmedSkills.length === 0) {
      throw new ApiError(400, "Skills cannot be empty. Please provide valid skills from /api/skills endpoint.");
    }

    const availableSkills = await getAllAvailableSkills();

    // Check if all provided skills exist in available skills
    const invalidSkills = trimmedSkills.filter(
      (skill) => !availableSkills.includes(skill)
    );

    if (invalidSkills.length > 0) {
      throw new ApiError(
        400,
        `Invalid skills: ${invalidSkills.join(", ")}. Please use skills from /api/skills endpoint.`
      );
    }

    // Use trimmed skills for saving
    normalizedSkills.length = 0;
    normalizedSkills.push(...trimmedSkills);
  }

  // Fetch coin cost for job posting (per vacancy)
  const coinRule = await CoinRule.findOne({ category: "recruiter" });
  const coinCostPerJobPost = coinRule?.coinCostPerJobPost || 0;

  // Calculate total coin cost based on vacancy count
  const totalCoinCost = coinCostPerJobPost * (vacancyCount || 1);

  // Check coin balance if coin cost is set
  if (totalCoinCost > 0) {
    const balanceCheck = await checkCoinBalance(
      recruiter._id,
      "recruiter",
      totalCoinCost
    );

    if (!balanceCheck.hasSufficientBalance) {
      // Send low balance notification
      try {
        const { fcmService } = await import("../../../firebase/fcm.service.js");
        const Notification = (await import("../../../firebase/notification.model.js")).default;

        await fcmService.sendToUser(recruiter._id, "Recruiter", {
          title: "⚠️ Low Coin Balance",
          body: `You need ${totalCoinCost} coins to post this job (${coinCostPerJobPost} × ${vacancyCount} vacancies). Current balance: ${balanceCheck.currentBalance} coins. Purchase more coins!`,
          data: { type: "low_coin_balance", requiredCoins: String(totalCoinCost), currentBalance: String(balanceCheck.currentBalance) }
        });

        // Save notification to database
        await Notification.create({
          title: "⚠️ Low Coin Balance",
          body: `You need ${totalCoinCost} coins to post this job (${coinCostPerJobPost} × ${vacancyCount} vacancies). Current balance: ${balanceCheck.currentBalance} coins. Purchase more coins!`,
          recipientType: "specific",
          recipients: [{ userId: recruiter._id, userType: "Recruiter", status: "sent", sentAt: new Date() }],
          data: { type: "low_coin_balance", requiredCoins: String(totalCoinCost), currentBalance: String(balanceCheck.currentBalance) },
          status: "sent",
          sentAt: new Date()
        });
      } catch (err) {
        console.error("Failed to send low balance notification:", err.message);
      }

      throw new ApiError(
        400,
        `Insufficient coin balance. Required: ${totalCoinCost} coins (${coinCostPerJobPost} × ${vacancyCount} vacancies), Available: ${balanceCheck.currentBalance} coins. Please purchase more coins.`
      );
    }
  }

  // Create job
  const job = await RecruiterJob.create({
    recruiter: recruiter._id,
    jobTitle,
    jobDescription,
    city: resolvedCity,
    state: resolvedState,
    address: address || null,
    expectedSalary: {
      min: expectedSalaryMin,
      max: expectedSalaryMax,
      currency: salaryCurrency,
      payPeriod: salaryPayPeriod,
    },
    employeeCount,
    vacancyCount,
    jobType,
    employmentMode,
    jobSeekerCategory,
    categories: normalizedCategories,
    tags: normalizedTags,
    skills: normalizedSkills,
    benefits: {
      foodProvided: benefits.foodProvided ?? false,
      accommodationProvided: benefits.accommodationProvided ?? false,
      travelFacility: benefits.travelFacility ?? false,
    },
    experienceRange: {
      minYears: experienceMinYears,
      maxYears: experienceMaxYears ?? null,
    },
    preferredAgeRange: preferredAgeMin || preferredAgeMax
      ? {
        minAge: preferredAgeMin ?? null,
        maxAge: preferredAgeMax ?? null,
      }
      : {},
    qualifications: normalizedQualifications,
    responsibilities: normalizedResponsibilities,
    companySnapshot: buildCompanySnapshot(recruiter, aboutCompany),
  });

  // Deduct coins after successful job creation
  let coinTransaction = null;
  let balanceAfter = null;
  if (totalCoinCost > 0) {
    try {
      const deductionResult = await deductCoins(
        recruiter._id,
        "recruiter",
        totalCoinCost,
        `Job Post: ${jobTitle} (${vacancyCount} vacancies × ${coinCostPerJobPost} coins)`,
        job._id,
        "job"
      );
      coinTransaction = deductionResult.transaction;
      balanceAfter = deductionResult.balanceAfter;
    } catch (error) {
      // If coin deduction fails, delete the job and throw error
      await RecruiterJob.findByIdAndDelete(job._id);
      throw error;
    }
  }

  const responsePayload = {
    job: {
      ...job.toObject(),
      jobId: job._id, // Add jobId alias for clarity
    },
    summary: {
      salaryLabel: `₹${Math.round(expectedSalaryMin).toLocaleString("en-IN")} - ₹${Math.round(
        expectedSalaryMax
      ).toLocaleString("en-IN")}/${salaryPayPeriod === "monthly" ? "month" : "year"}`,
      experienceLabel: experienceMaxYears
        ? `${experienceMinYears}-${experienceMaxYears} YoE`
        : `${experienceMinYears}+ YoE`,
      jobTags: [
        jobType,
        employmentMode,
        experienceMaxYears
          ? `${experienceMinYears}-${experienceMaxYears} YoE`
          : `${experienceMinYears}+ YoE`,
      ],
    },
    coinTransaction: coinTransaction
      ? {
        totalAmount: totalCoinCost,
        coinPerVacancy: coinCostPerJobPost,
        vacancyCount: vacancyCount,
        balanceAfter,
        description: coinTransaction.description,
      }
      : null,
  };

  // Notify job seekers with matching skills (background, don't block response)
  notifyMatchingJobSeekers(job._id, normalizedSkills, jobTitle);

  // Process referral reward if this is the recruiter's first job post
  // This awards coins to the referrer (if any) when the referred recruiter posts their first job
  try {
    // Check if this is the first job post
    const jobCount = await RecruiterJob.countDocuments({
      recruiter: recruiter._id
    });

    if (jobCount === 1) {
      // This is the first job post - process referral reward in background
      processReferralReward(
        recruiter._id,
        "Recruiter",
        "job_post"
      ).catch(err => console.error("❌ Error processing referral reward:", err.message));
    }
  } catch (refErr) {
    console.error("❌ Error checking referral reward:", refErr.message);
  }

  // Build dynamic success message
  let successMessage = "Job posted successfully";
  if (totalCoinCost > 0 && balanceAfter !== null) {
    successMessage = `Job posted successfully! ${totalCoinCost} coins deducted. Remaining balance: ${balanceAfter} coins.`;
  }

  return res
    .status(201)
    .json(ApiResponse.success(responsePayload, successMessage));
});

/**
 * Notify job seekers whose skills match the new job posting
 * Runs asynchronously in the background
 */
async function notifyMatchingJobSeekers(jobId, jobSkills, jobTitle) {
  try {
    if (!jobSkills || jobSkills.length === 0) return;

    // Find job seekers with matching skills who have FCM tokens
    const matchingJobSeekers = await JobSeeker.find({
      selectedSkills: { $in: jobSkills },
      fcmTokens: { $exists: true, $ne: [] }
    }).select("_id fcmTokens");

    console.log(`📢 Found ${matchingJobSeekers.length} job seekers with matching skills for job: ${jobTitle}`);

    // Send notifications to matching job seekers
    for (const jobSeeker of matchingJobSeekers) {
      try {
        await fcmService.sendToUser(jobSeeker._id, "JobSeeker", {
          title: "🔔 New Job Matches Your Skills!",
          body: `A new job "${jobTitle}" matches your profile. Apply now!`,
          data: {
            type: "new_job_match",
            jobId: jobId.toString()
          }
        });

        // Save notification to database
        await Notification.create({
          title: "🔔 New Job Matches Your Skills!",
          body: `A new job "${jobTitle}" matches your profile. Apply now!`,
          recipientType: "specific",
          recipients: [{
            userId: jobSeeker._id,
            userType: "JobSeeker",
            status: "sent",
            sentAt: new Date()
          }],
          data: {
            type: "new_job_match",
            jobId: jobId.toString()
          },
          status: "sent",
          sentAt: new Date()
        });
      } catch (err) {
        console.error(`Failed to notify job seeker ${jobSeeker._id}:`, err.message);
      }
    }
  } catch (error) {
    console.error("Error notifying matching job seekers:", error.message);
  }
}

/**
 * Get All Job Posts (Public endpoint)
 * Returns all active job posts with optional filtering and pagination
 * Used by job seekers to browse available jobs
 */
export const getAllJobPosts = asyncHandler(async (req, res) => {
  const {
    status = "Open", // Default to "Open" jobs only
    city, // City name (string) - for backward compatibility
    cityId, // Single city ID (string)
    cityIds, // Multiple city IDs (comma-separated string or array)
    jobType,
    employmentMode,
    category,
    minSalary,
    maxSalary,
    experienceMin,
    experienceMax,
    search, // Global search query - searches across multiple fields
    q, // Alternative search parameter (same as search)
    page = 1,
    limit = 10,
    sortBy = "createdAt", // createdAt, salary, experience, relevance
    sortOrder = "desc", // asc, desc
  } = req.query;

  // Build filter object
  const filter = {};

  // Filter by job seeker category if authenticated job seeker
  // If job seeker is authenticated, only show jobs matching their category
  if (req.jobSeeker && req.jobSeeker.category) {
    filter.jobSeekerCategory = req.jobSeeker.category;
  }

  // If job seeker is authenticated, exclude jobs they've already applied for
  if (req.jobSeeker) {
    console.log("🔍 Debug getAllJobPosts - Job Seeker authenticated:");
    console.log("  - Job Seeker ID:", req.jobSeeker._id);

    const appliedApplications = await Application.find(
      { jobSeeker: req.jobSeeker._id },
      { job: 1 }
    ).lean();
    const appliedJobIds = appliedApplications.map((app) => app.job);

    console.log("  - Applied Applications Found:", appliedApplications.length);
    console.log("  - Applied Job IDs:", appliedJobIds);

    if (appliedJobIds.length > 0) {
      filter._id = { $nin: appliedJobIds };
      console.log("  - Filter applied: Excluding", appliedJobIds.length, "jobs");
    }
  } else {
    console.log("🔍 Debug getAllJobPosts - No job seeker authenticated (req.jobSeeker is undefined)");
  }

  // Global search - searches across job title, description, city, company name, categories, tags, qualifications
  const searchTerm = search || q;
  let searchFilter = null;
  let recruiterIdsForSearch = [];

  if (searchTerm && searchTerm.trim()) {
    const trimmedSearch = searchTerm.trim();
    const searchRegex = new RegExp(trimmedSearch, "i"); // Case-insensitive

    // Parse salary from search term
    const parsedSalary = parseSalaryFromSearch(trimmedSearch);

    // Check if search is purely a salary number (no other text)
    const isPureSalarySearch = /^[\d,\s]+(k|l|L|lakhs?|lpa|per\s*annum|annual|yearly)?$/i.test(trimmedSearch) && parsedSalary && parsedSalary > 0;

    // Search in recruiter company names
    const matchingRecruiters = await Recruiter.find({
      companyName: { $regex: searchRegex }
    }).select("_id").lean();

    recruiterIdsForSearch = matchingRecruiters.map(r => r._id);

    // Build comprehensive search filter using $or
    const searchConditions = [];

    // If it's a pure salary search, prioritize salary matching and be strict
    if (isPureSalarySearch && parsedSalary) {
      // For pure salary searches, only match jobs where:
      // 1. Searched salary falls within job's salary range, OR
      // 2. Job's salary range significantly overlaps with searched salary range (±15% tolerance)
      // This ensures we don't match jobs that are too far off (like 50k-80k when searching 100k)

      // Condition 1: Searched salary falls within job's range
      searchConditions.push({
        $and: [
          { "expectedSalary.min": { $lte: parsedSalary } },
          { "expectedSalary.max": { $gte: parsedSalary } }
        ]
      });

      // Condition 2: Job's salary range significantly overlaps with searched salary
      // Use ±15% tolerance - job's range should overlap with [85k, 115k] when searching 100k
      const tolerance = parsedSalary * 0.15; // 15% tolerance (stricter)
      const minSalary = Math.max(0, parsedSalary - tolerance);
      const maxSalary = parsedSalary + tolerance;

      // Match if job's salary range overlaps with the tolerance range
      // Job range overlaps if: job.min <= tolerance.max AND job.max >= tolerance.min
      searchConditions.push({
        $and: [
          { "expectedSalary.min": { $lte: maxSalary } },
          { "expectedSalary.max": { $gte: minSalary } }
        ]
      });
    } else {
      // Regular text search - search in all fields
      searchConditions.push(
        // Job title search
        { jobTitle: { $regex: searchRegex } },
        // Job description search
        { jobDescription: { $regex: searchRegex } },
        // City search
        { city: { $regex: searchRegex } },
        // Categories search (array field - regex matches any element)
        { categories: searchRegex },
        // Tags search (array field - regex matches any element)
        { tags: searchRegex },
        // Qualifications search (array field - regex matches any element)
        { qualifications: searchRegex },
        // Responsibilities search (array field - regex matches any element)
        { responsibilities: searchRegex },
        // Company name from companySnapshot
        { "companySnapshot.name": { $regex: searchRegex } },
        // Company name from recruiter (if recruiter IDs found)
        ...(recruiterIdsForSearch.length > 0 ? [{ recruiter: { $in: recruiterIdsForSearch } }] : [])
      );

      // Add salary search if a valid salary number is found in search term (for mixed searches)
      if (parsedSalary && parsedSalary > 0) {
        // For mixed searches, be more lenient - match if searched salary is within range or close
        searchConditions.push({
          $or: [
            // Search salary falls within job's salary range
            {
              $and: [
                { "expectedSalary.min": { $lte: parsedSalary } },
                { "expectedSalary.max": { $gte: parsedSalary } }
              ]
            },
            // Job's salary range overlaps with searched salary (within 30% tolerance)
            {
              $or: [
                {
                  "expectedSalary.min": {
                    $gte: Math.max(0, parsedSalary * 0.7),
                    $lte: parsedSalary * 1.3
                  }
                },
                {
                  "expectedSalary.max": {
                    $gte: Math.max(0, parsedSalary * 0.7),
                    $lte: parsedSalary * 1.3
                  }
                }
              ]
            }
          ]
        });
      }
    }

    searchFilter = {
      $or: searchConditions
    };
  }

  // Status filter (default to "Open" jobs)
  if (status) {
    if (status === "all") {
      // If "all" is specified, don't filter by status
    } else {
      filter.status = status;
    }
  } else {
    filter.status = "Open"; // Default to open jobs
  }

  // City filter - supports both city ID(s) and city name(s)
  let cityNames = [];

  // Priority 1: If cityIds (multiple) is provided
  if (cityIds) {
    const cityIdArray = Array.isArray(cityIds)
      ? cityIds
      : typeof cityIds === "string"
        ? cityIds.split(",").map(id => id.trim()).filter(Boolean)
        : [];

    if (cityIdArray.length > 0) {
      const cities = await City.find({
        _id: { $in: cityIdArray },
        status: "Active"
      }).select("name").lean();

      cityNames = cities.map(c => c.name);
    }
  }
  // Priority 2: If cityId (single) is provided
  else if (cityId) {
    const city = await City.findById(cityId).select("name").lean();
    if (city) {
      cityNames = [city.name];
    }
  }
  // Priority 3: If city (name) is provided (backward compatibility)
  else if (city) {
    // Support comma-separated city names or single city name
    if (typeof city === "string" && city.includes(",")) {
      cityNames = city.split(",").map(c => c.trim()).filter(Boolean);
    } else {
      cityNames = [city];
    }
  }

  // Apply city filter
  let cityFilter = null;
  if (cityNames.length > 0) {
    if (cityNames.length === 1) {
      // Single city - use regex for partial matching
      filter.city = { $regex: new RegExp(cityNames[0], "i") };
    } else {
      // Multiple cities - create $or filter
      cityFilter = {
        $or: cityNames.map(cityName => ({
          city: { $regex: new RegExp(cityName, "i") }
        }))
      };
    }
  }

  // Job Type filter
  if (jobType) {
    filter.jobType = jobType;
  }

  // Employment Mode filter
  if (employmentMode) {
    filter.employmentMode = employmentMode;
  }

  // Category filter
  if (category) {
    filter.categories = { $in: [category] };
  }

  // Salary range filter
  if (minSalary || maxSalary) {
    filter["expectedSalary.min"] = {};
    if (minSalary) {
      filter["expectedSalary.min"].$gte = Number(minSalary);
    }
    if (maxSalary) {
      filter["expectedSalary.max"] = {};
      filter["expectedSalary.max"].$lte = Number(maxSalary);
    }
  }

  // Experience range filter
  let experienceFilter = null;
  if (experienceMin !== undefined || experienceMax !== undefined) {
    if (experienceMin !== undefined && experienceMax !== undefined) {
      // Find jobs where experience range overlaps with requested range
      experienceFilter = {
        $or: [
          {
            $and: [
              { "experienceRange.minYears": { $lte: Number(experienceMax) } },
              { "experienceRange.maxYears": { $gte: Number(experienceMin) } },
            ]
          },
          {
            $and: [
              { "experienceRange.minYears": { $gte: Number(experienceMin), $lte: Number(experienceMax) } },
              { "experienceRange.maxYears": null },
            ]
          }
        ]
      };
    } else if (experienceMin !== undefined) {
      filter["experienceRange.minYears"] = { $lte: Number(experienceMin) };
    } else if (experienceMax !== undefined) {
      experienceFilter = {
        $or: [
          { "experienceRange.maxYears": { $gte: Number(experienceMax) } },
          {
            $and: [
              { "experienceRange.maxYears": null },
              { "experienceRange.minYears": { $lte: Number(experienceMax) } }
            ]
          },
        ]
      };
    }
  }

  // Combine all filters
  const filtersToCombine = [];

  // Add search filter if exists
  if (searchFilter) {
    filtersToCombine.push(searchFilter);
  }

  // Add city filter if exists
  if (cityFilter) {
    filtersToCombine.push(cityFilter);
  }

  // Add experience filter if exists
  if (experienceFilter) {
    filtersToCombine.push(experienceFilter);
  }

  // Combine filters using $and if multiple $or filters exist
  if (filtersToCombine.length > 0) {
    if (filtersToCombine.length === 1) {
      // Single filter - merge directly
      Object.assign(filter, filtersToCombine[0]);
    } else {
      // Multiple filters - use $and
      filter.$and = [
        ...filtersToCombine,
        ...(filter.$and || [])
      ];
    }
  }

  // Pagination
  const pageNumber = Math.max(1, parseInt(page));
  const limitNumber = Math.min(100, Math.max(1, parseInt(limit))); // Max 100 per page
  const skip = (pageNumber - 1) * limitNumber;

  // Sort options
  const sortOptions = {};
  if (sortBy === "salary") {
    sortOptions["expectedSalary.min"] = sortOrder === "asc" ? 1 : -1;
  } else if (sortBy === "experience") {
    sortOptions["experienceRange.minYears"] = sortOrder === "asc" ? 1 : -1;
  } else if (sortBy === "relevance" && searchTerm) {
    // For relevance sorting, we'll sort by createdAt as a fallback
    // In a production system, you might want to use MongoDB text search score
    sortOptions["createdAt"] = -1; // Most recent first when searching
  } else {
    sortOptions[sortBy] = sortOrder === "asc" ? 1 : -1;
  }

  // Fetch coin cost for job application
  const coinRule = await CoinRule.findOne({ category: "jobSeeker" });
  const coinCostPerApplication = coinRule?.coinCostPerApplication || 0;

  // Fetch jobs with pagination
  const jobs = await RecruiterJob.find(filter)
    .populate("recruiter", "companyName companyLogo city state email phone")
    .sort(sortOptions)
    .skip(skip)
    .limit(limitNumber)
    .lean();

  // Get total count for pagination
  const totalJobs = await RecruiterJob.countDocuments(filter);
  const totalPages = Math.ceil(totalJobs / limitNumber);

  // Format jobs with summary
  const formattedJobs = jobs.map((job) => {
    const salaryLabel = `₹${Math.round(job.expectedSalary.min).toLocaleString("en-IN")} - ₹${Math.round(
      job.expectedSalary.max
    ).toLocaleString("en-IN")}/${job.expectedSalary.payPeriod === "monthly" ? "month" : "year"}`;

    const experienceLabel = job.experienceRange.maxYears
      ? `${job.experienceRange.minYears}-${job.experienceRange.maxYears} YoE`
      : `${job.experienceRange.minYears}+ YoE`;

    const preferredAgeLabel = job.preferredAgeRange
      ? job.preferredAgeRange.maxAge
        ? `${job.preferredAgeRange.minAge}-${job.preferredAgeRange.maxAge} years`
        : job.preferredAgeRange.minAge
          ? `${job.preferredAgeRange.minAge}+ years`
          : null
      : null;

    return {
      _id: job._id,
      jobTitle: job.jobTitle,
      jobDescription: job.jobDescription,
      city: job.city,
      state: job.state || null,
      address: job.address || null,
      expectedSalary: job.expectedSalary,
      salaryLabel,
      employeeCount: job.employeeCount,
      vacancyCount: job.vacancyCount,
      jobType: job.jobType,
      employmentMode: job.employmentMode,
      categories: job.categories,
      tags: job.tags,
      benefits: job.benefits,
      experienceRange: job.experienceRange,
      experienceLabel,
      preferredAgeRange: job.preferredAgeRange || null,
      preferredAgeLabel,
      qualifications: job.qualifications,
      responsibilities: job.responsibilities,
      companySnapshot: job.companySnapshot,
      recruiter: job.recruiter,
      status: job.status,
      applicationCount: job.applicationCount,
      coinCostPerApplication,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      summary: {
        salaryLabel,
        experienceLabel,
        preferredAgeLabel,
        jobTags: [
          job.jobType,
          job.employmentMode,
          experienceLabel,
        ],
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
        filters: {
          status: status === "all" ? "all" : filter.status,
          city: cityNames.length > 0 ? (cityNames.length === 1 ? cityNames[0] : cityNames) : null,
          cityId: cityId || null,
          cityIds: cityIds ? (Array.isArray(cityIds) ? cityIds : cityIds.split(",").map(id => id.trim())) : null,
          jobType: jobType || null,
          employmentMode: employmentMode || null,
          category: category || null,
        },
        search: {
          query: searchTerm || null,
          hasSearch: !!searchTerm,
          totalResults: totalJobs,
        },
      },
      searchTerm
        ? `Found ${totalJobs} job${totalJobs !== 1 ? "s" : ""} for "${searchTerm}"`
        : "Jobs fetched successfully"
    )
  );
});

/**
 * Get Job Post by ID (Public endpoint)
 * Returns detailed information about a specific job post
 * Used by job seekers to view full job details
 */
export const getJobPostById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!id) {
    throw new ApiError(400, "Job ID is required");
  }

  // Validate MongoDB ObjectId format
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid job ID format");
  }

  // Find job by ID and populate recruiter details
  const job = await RecruiterJob.findById(id)
    .populate("recruiter", "companyName companyLogo city state email phone")
    .lean();

  if (!job) {
    throw new ApiError(404, "Job not found");
  }

  // Fetch coin cost for job applications
  const coinRule = await CoinRule.findOne({ category: "jobSeeker" });
  const coinCostPerApplication = coinRule?.coinCostPerApplication || 0;

  // Format salary label
  const salaryLabel = `₹${Math.round(job.expectedSalary.min).toLocaleString("en-IN")} - ₹${Math.round(
    job.expectedSalary.max
  ).toLocaleString("en-IN")}/${job.expectedSalary.payPeriod === "monthly" ? "month" : "year"}`;

  // Format experience label
  const experienceLabel = job.experienceRange.maxYears
    ? `${job.experienceRange.minYears}-${job.experienceRange.maxYears} YoE`
    : `${job.experienceRange.minYears}+ YoE`;

  // Format preferred age label
  const preferredAgeLabel = job.preferredAgeRange
    ? job.preferredAgeRange.maxAge
      ? `${job.preferredAgeRange.minAge}-${job.preferredAgeRange.maxAge} years`
      : job.preferredAgeRange.minAge
        ? `${job.preferredAgeRange.minAge}+ years`
        : null
    : null;

  // Format response with all job details
  const formattedJob = {
    _id: job._id,
    jobTitle: job.jobTitle,
    jobDescription: job.jobDescription,
    city: job.city,
    state: job.state || null,
    address: job.address || null,
    expectedSalary: job.expectedSalary,
    salaryLabel,
    employeeCount: job.employeeCount,
    vacancyCount: job.vacancyCount,
    jobType: job.jobType,
    employmentMode: job.employmentMode,
    categories: job.categories,
    tags: job.tags,
    skills: job.skills || [],
    benefits: job.benefits,
    experienceRange: job.experienceRange,
    experienceLabel,
    preferredAgeRange: job.preferredAgeRange || null,
    preferredAgeLabel,
    qualifications: job.qualifications,
    responsibilities: job.responsibilities,
    aboutCompany: job.aboutCompany,
    companySnapshot: job.companySnapshot,
    recruiter: job.recruiter,
    status: job.status,
    applicationCount: job.applicationCount,
    coinCostPerApplication,
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
    },
  };

  return res.status(200).json(
    ApiResponse.success(
      { job: formattedJob },
      "Job details fetched successfully"
    )
  );
});

/**
 * Update Vacancy Count (Recruiter)
 * Allows recruiter to update the vacancy count for their job post
 * If new vacancy count is greater than current application count, job can be reopened if it was closed
 * Requires: Recruiter authentication (JWT token)
 */
export const updateVacancyCount = asyncHandler(async (req, res) => {
  const recruiter = req.recruiter;
  const { jobId } = req.params;
  const { vacancyCount } = req.body;

  // Validate job ID
  if (!mongoose.Types.ObjectId.isValid(jobId)) {
    throw new ApiError(400, "Invalid job ID format");
  }

  // Validate vacancy count
  if (!vacancyCount || typeof vacancyCount !== "number" || vacancyCount < 1 || !Number.isInteger(vacancyCount)) {
    throw new ApiError(400, "Vacancy count must be a positive integer");
  }

  // Find the job
  const job = await RecruiterJob.findById(jobId);

  if (!job) {
    throw new ApiError(404, "Job not found");
  }

  // Verify the job belongs to this recruiter
  if (job.recruiter.toString() !== recruiter._id.toString()) {
    throw new ApiError(403, "You are not authorized to update this job");
  }

  // Update vacancy count
  job.vacancyCount = vacancyCount;

  // If job was closed and new vacancy count is greater than current applications, reopen it
  if (job.status === "Closed" && vacancyCount > job.applicationCount) {
    job.status = "Open";
  }

  // If new vacancy count is less than or equal to current applications, close the job
  if (job.status === "Open" && vacancyCount <= job.applicationCount) {
    job.status = "Closed";
  }

  await job.save();

  return res.status(200).json(
    ApiResponse.success(
      {
        job: {
          _id: job._id,
          jobTitle: job.jobTitle,
          vacancyCount: job.vacancyCount,
          applicationCount: job.applicationCount,
          status: job.status,
        },
      },
      "Vacancy count updated successfully"
    )
  );
});

/**
 * Manually Deactivate Job (Recruiter)
 * Allows recruiter to manually close/deactivate their job post
 * This works regardless of application count or vacancy count
 * Requires: Recruiter authentication (JWT token)
 */
export const deactivateJob = asyncHandler(async (req, res) => {
  const recruiter = req.recruiter;
  const { jobId } = req.params;

  // Validate job ID
  if (!mongoose.Types.ObjectId.isValid(jobId)) {
    throw new ApiError(400, "Invalid job ID format");
  }

  // Find the job
  const job = await RecruiterJob.findById(jobId);

  if (!job) {
    throw new ApiError(404, "Job not found");
  }

  // Verify the job belongs to this recruiter
  if (job.recruiter.toString() !== recruiter._id.toString()) {
    throw new ApiError(403, "You are not authorized to deactivate this job");
  }

  // Check if already closed
  if (job.status === "Closed") {
    throw new ApiError(400, "Job is already closed");
  }

  // Update status to Closed
  job.status = "Closed";
  await job.save();

  return res.status(200).json(
    ApiResponse.success(
      {
        job: {
          _id: job._id,
          jobTitle: job.jobTitle,
          status: job.status,
          vacancyCount: job.vacancyCount,
          applicationCount: job.applicationCount,
        },
      },
      "Job deactivated successfully"
    )
  );
});


/**
 * Update Job Post (Recruiter)
 * Allows recruiter to edit job details without reposting
 * Can edit all fields EXCEPT vacancyCount (use updateVacancyCount for that)
 * Requires: Recruiter authentication (JWT token)
 */
export const updateJobPost = asyncHandler(async (req, res) => {
  const recruiter = req.recruiter;
  const { jobId } = req.params;

  // Validate job ID
  if (!mongoose.Types.ObjectId.isValid(jobId)) {
    throw new ApiError(400, "Invalid job ID format");
  }

  // Find the job
  const job = await RecruiterJob.findById(jobId);

  if (!job) {
    throw new ApiError(404, "Job not found");
  }

  // Verify the job belongs to this recruiter
  if (job.recruiter.toString() !== recruiter._id.toString()) {
    throw new ApiError(403, "You are not authorized to edit this job");
  }

  // Extract editable fields from request body (excluding vacancyCount)
  const {
    jobTitle,
    jobDescription,
    city,
    cityId,
    state,
    stateId,
    address,
    expectedSalaryMin,
    expectedSalaryMax,
    salaryCurrency,
    salaryPayPeriod,
    employeeCount,
    // vacancyCount excluded - use updateVacancyCount API
    jobType,
    employmentMode,
    jobSeekerCategoryId,
    categories,
    tags,
    skills,
    benefits,
    experienceMinYears,
    experienceMaxYears,
    preferredAgeMin,
    preferredAgeMax,
    qualifications,
    responsibilities,
    aboutCompany,
  } = req.body;

  // Resolve city name from cityId if provided
  let resolvedCity = city;
  if (cityId && !city) {
    const cityDoc = await City.findById(cityId).lean();
    if (cityDoc) {
      resolvedCity = cityDoc.name;
    }
  }

  // Resolve state name from stateId if provided
  let resolvedState = state;
  if (stateId && !state) {
    const stateDoc = await State.findById(stateId).lean();
    if (stateDoc) {
      resolvedState = stateDoc.name;
    }
  }

  if (jobTitle !== undefined) {
    job.jobTitle = jobTitle;
  }
  if (jobDescription !== undefined) {
    job.jobDescription = jobDescription;
  }
  if (resolvedCity !== undefined) {
    job.city = resolvedCity;
  }
  if (resolvedState !== undefined) {
    job.state = resolvedState;
  }
  if (address !== undefined) {
    job.address = address;
  }

  // Update salary if any salary field is provided
  if (expectedSalaryMin !== undefined || expectedSalaryMax !== undefined || salaryCurrency !== undefined || salaryPayPeriod !== undefined) {
    job.expectedSalary = {
      min: expectedSalaryMin !== undefined ? expectedSalaryMin : job.expectedSalary?.min,
      max: expectedSalaryMax !== undefined ? expectedSalaryMax : job.expectedSalary?.max,
      currency: salaryCurrency !== undefined ? salaryCurrency : (job.expectedSalary?.currency || "INR"),
      payPeriod: salaryPayPeriod !== undefined ? salaryPayPeriod : (job.expectedSalary?.payPeriod || "monthly"),
    };
  }

  if (employeeCount !== undefined) {
    job.employeeCount = employeeCount;
  }
  if (jobType !== undefined) {
    job.jobType = jobType;
  }
  if (employmentMode !== undefined) {
    job.employmentMode = employmentMode;
  }

  // Update jobSeekerCategory if categoryId is provided
  if (jobSeekerCategoryId !== undefined) {
    const category = await Category.findById(jobSeekerCategoryId).lean();
    if (!category) {
      throw new ApiError(404, "Job Seeker Category not found");
    }
    const validCategories = ["Non-Degree Holder", "Diploma Holder", "ITI Holder"];
    if (!validCategories.includes(category.name)) {
      throw new ApiError(400, `Invalid job seeker category. Must be one of: ${validCategories.join(", ")}`);
    }
    job.jobSeekerCategory = category.name;
  }

  if (categories !== undefined) {
    job.categories = normalizeArray(categories);
  }
  if (tags !== undefined) {
    job.tags = normalizeArray(tags);
  }
  if (skills !== undefined) {
    job.skills = normalizeArray(skills);
  }
  if (benefits !== undefined) {
    job.benefits = benefits;
  }

  // Update experience range if provided
  if (experienceMinYears !== undefined || experienceMaxYears !== undefined) {
    job.experienceRange = {
      minYears: experienceMinYears !== undefined ? experienceMinYears : job.experienceRange?.minYears,
      maxYears: experienceMaxYears !== undefined ? experienceMaxYears : job.experienceRange?.maxYears,
    };
  }

  // Update preferred age range if provided
  if (preferredAgeMin !== undefined || preferredAgeMax !== undefined) {
    job.preferredAgeRange = {
      minAge: preferredAgeMin !== undefined ? preferredAgeMin : job.preferredAgeRange?.minAge,
      maxAge: preferredAgeMax !== undefined ? preferredAgeMax : job.preferredAgeRange?.maxAge,
    };
  }

  if (qualifications !== undefined) {
    job.qualifications = normalizeArray(qualifications);
  }
  if (responsibilities !== undefined) {
    job.responsibilities = normalizeArray(responsibilities);
  }
  if (aboutCompany !== undefined) {
    job.companySnapshot = aboutCompany;
  }

  // Save the updated job
  await job.save();

  // Format salary label
  const salaryLabel = `₹${Math.round(job.expectedSalary.min).toLocaleString("en-IN")} - ₹${Math.round(
    job.expectedSalary.max
  ).toLocaleString("en-IN")}/${job.expectedSalary.payPeriod === "monthly" ? "month" : "year"}`;

  // Format experience label
  const experienceLabel = job.experienceRange.maxYears
    ? `${job.experienceRange.minYears}-${job.experienceRange.maxYears} YoE`
    : `${job.experienceRange.minYears}+ YoE`;

  return res.status(200).json(
    ApiResponse.success(
      {
        job: {
          _id: job._id,
          jobTitle: job.jobTitle,
          jobDescription: job.jobDescription,
          city: job.city,
          state: job.state || null,
          address: job.address || null,
          expectedSalary: job.expectedSalary,
          salaryLabel,
          employeeCount: job.employeeCount,
          vacancyCount: job.vacancyCount,
          jobType: job.jobType,
          employmentMode: job.employmentMode,
          jobSeekerCategory: job.jobSeekerCategory,
          categories: job.categories,
          tags: job.tags,
          skills: job.skills,
          benefits: job.benefits,
          experienceRange: job.experienceRange,
          experienceLabel,
          preferredAgeRange: job.preferredAgeRange,
          qualifications: job.qualifications,
          responsibilities: job.responsibilities,
          companySnapshot: job.companySnapshot,
          status: job.status,
          applicationCount: job.applicationCount,
          createdAt: job.createdAt,
          updatedAt: job.updatedAt,
        },
      },
      "Job updated successfully"
    )
  );
});


/* Repost Job By Recruiter */
/**
 * Repost a closed job with optional modifications
 * - Deducts coins based on vacancyCount (same as createRecruiterJob)
 * - Allows editing all job details
 * - Creates a new job entry linked to the original
 */
export const repostJob = asyncHandler(async (req, res) => {
  const recruiter = req.recruiter;
  const { jobId } = req.params;

  const {
    jobTitle,
    jobDescription,
    city,
    cityId,
    state,
    stateId,
    address,
    expectedSalaryMin,
    expectedSalaryMax,
    salaryCurrency,
    salaryPayPeriod,
    employeeCount,
    vacancyCount,
    jobType,
    employmentMode,
    jobSeekerCategory,
    categories,
    tags,
    skills,
    benefits,
    experienceMinYears,
    experienceMaxYears,
    preferredAgeMin,
    preferredAgeMax,
    qualifications,
    responsibilities,
    aboutCompany,
  } = req.body;

  // Resolve city name from cityId if provided
  let resolvedCity = city;
  if (cityId && !city) {
    const cityDoc = await City.findById(cityId).lean();
    if (cityDoc) {
      resolvedCity = cityDoc.name;
    }
  }

  // Resolve state name from stateId if provided
  let resolvedState = state;
  if (stateId && !state) {
    const stateDoc = await State.findById(stateId).lean();
    if (stateDoc) {
      resolvedState = stateDoc.name;
    }
  }

  if (!mongoose.Types.ObjectId.isValid(jobId)) {
    throw new ApiError(400, "Invalid job ID format");
  }

  const oldJob = await RecruiterJob.findById(jobId);
  if (!oldJob) throw new ApiError(404, "Job not found");

  if (oldJob.recruiter.toString() !== recruiter._id.toString()) {
    throw new ApiError(403, "Not authorized to repost this job");
  }

  // ✅ Only CLOSED jobs can be reposted
  if (oldJob.status !== "Closed") {
    throw new ApiError(400, "Only closed jobs can be reposted");
  }

  // Determine final vacancy count (from body or original job)
  const finalVacancyCount = vacancyCount || oldJob.vacancyCount || 1;

  // Fetch coin cost for job posting (per vacancy)
  const coinRule = await CoinRule.findOne({ category: "recruiter" });
  const coinCostPerJobPost = coinRule?.coinCostPerJobPost || 0;

  // Calculate total coin cost based on vacancy count
  const totalCoinCost = coinCostPerJobPost * finalVacancyCount;

  // Check coin balance if coin cost is set
  if (totalCoinCost > 0) {
    const balanceCheck = await checkCoinBalance(
      recruiter._id,
      "recruiter",
      totalCoinCost
    );

    if (!balanceCheck.hasSufficientBalance) {
      // Send low balance notification
      try {
        await fcmService.sendToUser(recruiter._id, "Recruiter", {
          title: "⚠️ Low Coin Balance",
          body: `You need ${totalCoinCost} coins to repost this job (${coinCostPerJobPost} × ${finalVacancyCount} vacancies). Current balance: ${balanceCheck.currentBalance} coins. Purchase more coins!`,
          data: { type: "low_coin_balance", requiredCoins: String(totalCoinCost), currentBalance: String(balanceCheck.currentBalance) }
        });

        await Notification.create({
          title: "⚠️ Low Coin Balance",
          body: `You need ${totalCoinCost} coins to repost this job (${coinCostPerJobPost} × ${finalVacancyCount} vacancies). Current balance: ${balanceCheck.currentBalance} coins. Purchase more coins!`,
          recipientType: "specific",
          recipients: [{ userId: recruiter._id, userType: "Recruiter", status: "sent", sentAt: new Date() }],
          data: { type: "low_coin_balance", requiredCoins: String(totalCoinCost), currentBalance: String(balanceCheck.currentBalance) },
          status: "sent",
          sentAt: new Date()
        });
      } catch (err) {
        console.error("Failed to send low balance notification:", err.message);
      }

      throw new ApiError(
        400,
        `Insufficient coin balance. Required: ${totalCoinCost} coins (${coinCostPerJobPost} × ${finalVacancyCount} vacancies), Available: ${balanceCheck.currentBalance} coins. Please purchase more coins.`
      );
    }
  }

  // Build new job data from old job, overriding with new values if provided
  const normalizeArray = (value, fallback) => {
    if (value === undefined) return fallback || [];
    return Array.isArray(value) ? value : [value];
  };

  const newJobData = {
    recruiter: recruiter._id,
    repostedFrom: oldJob._id,
    status: "Open",
    applicationCount: 0,

    // Use new values if provided, otherwise use old values
    jobTitle: jobTitle || oldJob.jobTitle,
    jobDescription: jobDescription || oldJob.jobDescription,
    city: resolvedCity || oldJob.city,
    state: resolvedState || oldJob.state || null,
    address: address !== undefined ? address : (oldJob.address || null),
    expectedSalary: {
      min: expectedSalaryMin || oldJob.expectedSalary?.min,
      max: expectedSalaryMax || oldJob.expectedSalary?.max,
      currency: salaryCurrency || oldJob.expectedSalary?.currency || "INR",
      payPeriod: salaryPayPeriod || oldJob.expectedSalary?.payPeriod || "monthly",
    },
    employeeCount: employeeCount !== undefined ? employeeCount : oldJob.employeeCount,
    vacancyCount: finalVacancyCount,
    jobType: jobType || oldJob.jobType,
    employmentMode: employmentMode || oldJob.employmentMode,
    jobSeekerCategory: jobSeekerCategory || oldJob.jobSeekerCategory,
    categories: categories ? normalizeArray(categories) : oldJob.categories,
    tags: tags ? normalizeArray(tags) : oldJob.tags,
    skills: skills ? normalizeArray(skills) : oldJob.skills,
    benefits: benefits || oldJob.benefits,
    experienceRange: {
      minYears: experienceMinYears !== undefined ? experienceMinYears : oldJob.experienceRange?.minYears,
      maxYears: experienceMaxYears !== undefined ? experienceMaxYears : oldJob.experienceRange?.maxYears,
    },
    preferredAgeRange: (preferredAgeMin !== undefined || preferredAgeMax !== undefined)
      ? {
        minAge: preferredAgeMin !== undefined ? preferredAgeMin : oldJob.preferredAgeRange?.minAge,
        maxAge: preferredAgeMax !== undefined ? preferredAgeMax : oldJob.preferredAgeRange?.maxAge,
      }
      : oldJob.preferredAgeRange,
    qualifications: qualifications ? normalizeArray(qualifications) : oldJob.qualifications,
    responsibilities: responsibilities ? normalizeArray(responsibilities) : oldJob.responsibilities,
    companySnapshot: aboutCompany || oldJob.companySnapshot,
  };

  // Create the new job
  let newJob;
  try {
    newJob = await RecruiterJob.create(newJobData);
  } catch (err) {
    if (err.name === "ValidationError" || err.message?.toLowerCase().includes("validation failed")) {
      throw new ApiError(400, err.message);
    }
    throw err;
  }

  // Deduct coins after successful job creation
  let coinTransaction = null;
  let balanceAfter = null;
  if (totalCoinCost > 0) {
    try {
      const deductionResult = await deductCoins(
        recruiter._id,
        "recruiter",
        totalCoinCost,
        `Repost Job: ${newJob.jobTitle} (${finalVacancyCount} vacancies × ${coinCostPerJobPost} coins)`,
        newJob._id,
        "job"
      );
      coinTransaction = deductionResult.transaction;
      balanceAfter = deductionResult.balanceAfter;
    } catch (error) {
      // If coin deduction fails, delete the new job and throw error
      await RecruiterJob.findByIdAndDelete(newJob._id);
      throw error;
    }
  }

  // Notify matching job seekers (background)
  const jobSkills = newJob.skills || [];
  if (jobSkills.length > 0) {
    notifyMatchingJobSeekers(newJob._id, jobSkills, newJob.jobTitle);
  }

  // Build dynamic success message
  let successMessage = "Job reposted successfully";
  if (totalCoinCost > 0 && balanceAfter !== null) {
    successMessage = `Job reposted successfully! ${totalCoinCost} coins deducted. Remaining balance: ${balanceAfter} coins.`;
  }

  return res.status(201).json(
    ApiResponse.success(
      {
        oldJobId: oldJob._id,
        newJob: {
          ...newJob.toObject(),
          jobId: newJob._id,
        },
        coinTransaction: coinTransaction
          ? {
            totalAmount: totalCoinCost,
            coinPerVacancy: coinCostPerJobPost,
            vacancyCount: finalVacancyCount,
            balanceAfter,
            description: coinTransaction.description,
          }
          : null,
      },
      successMessage
    )
  );
});



/**
 * Get All Jobs for a Specific Recruiter
 * Returns all job posts posted by a specific recruiter
 * Supports filtering by status, pagination, and sorting
 * 
 * @route GET /api/recruiters/:recruiterId/jobs
 * @route GET /api/recruiters/jobs/my-jobs (when authenticated)
 * @param {string} recruiterId - Recruiter ID (optional if authenticated)
 * @query {string} status - Filter by job status (Open, Closed, Draft, Archived, all)
 * @query {number} page - Page number (default: 1)
 * @query {number} limit - Items per page (default: 10, max: 100)
 * @query {string} sortBy - Sort field (createdAt, updatedAt, applicationCount)
 * @query {string} sortOrder - Sort order (asc, desc)
 */
export const getRecruiterJobs = asyncHandler(async (req, res) => {
  const { recruiterId } = req.params;
  const {
    status,
    page = 1,
    limit = 10,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = req.query;

  // Determine which recruiter ID to use
  let targetRecruiterId;

  // If recruiterId is provided in params, use it
  if (recruiterId) {
    // Validate recruiter ID format
    if (!mongoose.Types.ObjectId.isValid(recruiterId)) {
      throw new ApiError(400, "Invalid recruiter ID format");
    }
    targetRecruiterId = recruiterId;
  }
  // If authenticated recruiter is making the request, use their ID
  else if (req.recruiter) {
    targetRecruiterId = req.recruiter._id.toString();
  }
  // Otherwise, throw error
  else {
    throw new ApiError(400, "Recruiter ID is required");
  }

  // Verify recruiter exists
  const recruiter = await Recruiter.findById(targetRecruiterId).select("companyName companyLogo city state email phone");
  if (!recruiter) {
    throw new ApiError(404, "Recruiter not found");
  }

  // Build filter object
  const filter = {
    recruiter: targetRecruiterId,
  };

  // Status filter
  if (status) {
    if (status === "all") {
      // If "all" is specified, don't filter by status
    } else {
      filter.status = status;
    }
  }

  // Pagination
  const pageNumber = Math.max(1, parseInt(page));
  const limitNumber = Math.min(100, Math.max(1, parseInt(limit))); // Max 100 per page
  const skip = (pageNumber - 1) * limitNumber;

  // Sort options
  const sortOptions = {};
  if (sortBy === "applicationCount") {
    sortOptions.applicationCount = sortOrder === "asc" ? 1 : -1;
  } else if (sortBy === "updatedAt") {
    sortOptions.updatedAt = sortOrder === "asc" ? 1 : -1;
  } else {
    // Default to createdAt
    sortOptions.createdAt = sortOrder === "asc" ? 1 : -1;
  }

  // Fetch jobs with pagination
  const jobs = await RecruiterJob.find(filter)
    .populate("recruiter", "companyName companyLogo city state email phone")
    .sort(sortOptions)
    .skip(skip)
    .limit(limitNumber)
    .lean();

  // Get total count for pagination
  const totalJobs = await RecruiterJob.countDocuments(filter);
  const totalPages = Math.ceil(totalJobs / limitNumber);

  // Format jobs with summary
  const formattedJobs = jobs.map((job) => {
    const salaryLabel = `₹${Math.round(job.expectedSalary.min).toLocaleString("en-IN")} - ₹${Math.round(
      job.expectedSalary.max
    ).toLocaleString("en-IN")}/${job.expectedSalary.payPeriod === "monthly" ? "month" : "year"}`;

    const experienceLabel = job.experienceRange.maxYears
      ? `${job.experienceRange.minYears}-${job.experienceRange.maxYears} YoE`
      : `${job.experienceRange.minYears}+ YoE`;

    const preferredAgeLabel = job.preferredAgeRange
      ? job.preferredAgeRange.maxAge
        ? `${job.preferredAgeRange.minAge}-${job.preferredAgeRange.maxAge} years`
        : job.preferredAgeRange.minAge
          ? `${job.preferredAgeRange.minAge}+ years`
          : null
      : null;

    return {
      _id: job._id,
      jobTitle: job.jobTitle,
      jobDescription: job.jobDescription,
      city: job.city,
      state: job.state || null,
      address: job.address || null,
      expectedSalary: job.expectedSalary,
      salaryLabel,
      employeeCount: job.employeeCount,
      vacancyCount: job.vacancyCount,
      jobType: job.jobType,
      employmentMode: job.employmentMode,
      jobSeekerCategory: job.jobSeekerCategory,
      categories: job.categories,
      tags: job.tags,
      skills: job.skills,
      benefits: job.benefits,
      experienceRange: job.experienceRange,
      experienceLabel,
      preferredAgeRange: job.preferredAgeRange || null,
      preferredAgeLabel,
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
        preferredAgeLabel,
        jobTags: [
          job.jobType,
          job.employmentMode,
          experienceLabel,
        ],
      },
    };
  });

  return res.status(200).json(
    ApiResponse.success(
      {
        recruiter: {
          _id: recruiter._id,
          companyName: recruiter.companyName,
          companyLogo: recruiter.companyLogo,
          city: recruiter.city,
          state: recruiter.state,
        },
        jobs: formattedJobs,
        pagination: {
          currentPage: pageNumber,
          totalPages,
          totalJobs,
          limit: limitNumber,
          hasNextPage: pageNumber < totalPages,
          hasPrevPage: pageNumber > 1,
        },
        filters: {
          status: status === "all" ? "all" : filter.status || "all",
        },
      },
      `Found ${totalJobs} job${totalJobs !== 1 ? "s" : ""} for this recruiter`
    )
  );
});

