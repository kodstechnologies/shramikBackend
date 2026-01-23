import ApiResponse from "../../../utils/ApiResponse.js";
import ApiError from "../../../utils/ApiError.js";
import { asyncHandler } from "../../../utils/asyncHandler.js";
import mongoose from "mongoose";
import { Application } from "../../../models/jobSeeker/application.model.js";
import { RecruiterJob } from "../../../models/recruiter/jobPost/jobPost.model.js";
import { JobSeeker } from "../../../models/jobSeeker/jobSeeker.model.js";
import { fcmService } from "../../../firebase/fcm.service.js";
import Notification from "../../../firebase/notification.model.js";

/**
 * Get All Applications (Recruiter)
 * Returns all applications from job seekers for jobs created by the authenticated recruiter
 * This is a flat list of all applications across all jobs
 * Requires: Recruiter authentication (JWT token)
 */
export const getJobsWithApplications = asyncHandler(async (req, res) => {
  const recruiter = req.recruiter; // From auth middleware
  const {
    jobStatus,
    applicationStatus,
    page = 1,
    limit = 10,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = req.query;

  // Get all job IDs for this recruiter
  const jobFilter = { recruiter: recruiter._id };

  // Optional job status filter
  if (jobStatus) {
    jobFilter.status = jobStatus;
  }

  const allJobIds = await RecruiterJob.find(jobFilter).select("_id").lean();
  const jobIds = allJobIds.map((job) => job._id);

  if (jobIds.length === 0) {
    return res.status(200).json(
      ApiResponse.success(
        {
          applications: [],
          pagination: {
            currentPage: 1,
            totalPages: 0,
            totalApplications: 0,
            limit: parseInt(limit),
            hasNextPage: false,
            hasPrevPage: false,
          },
        },
        "No jobs found"
      )
    );
  }

  // Build filter for applications
  const applicationFilter = { job: { $in: jobIds } };

  // Optional application status filter
  if (applicationStatus) {
    applicationFilter.status = applicationStatus;
  } else {
    // By default, exclude withdrawn, shortlisted, and rejected applications
    applicationFilter.status = { $nin: ["Withdrawn", "Shortlisted", "Rejected"] };
  }

  // Pagination
  const pageNumber = Math.max(1, parseInt(page));
  const limitNumber = Math.min(100, Math.max(1, parseInt(limit)));
  const skip = (pageNumber - 1) * limitNumber;

  // Sort options
  const sortOptions = {};
  if (sortBy === "status") {
    sortOptions.status = sortOrder === "asc" ? 1 : -1;
  } else if (sortBy === "jobTitle") {
    // For job title sorting, we'll need to populate first
    sortOptions.createdAt = sortOrder === "asc" ? 1 : -1;
  } else {
    sortOptions[sortBy] = sortOrder === "asc" ? 1 : -1;
  }

  // Fetch applications with job and job seeker details
  let applications = await Application.find(applicationFilter)
    .populate({
      path: "job",
      select: "jobTitle jobDescription city expectedSalary jobType employmentMode status skills vacancyCount applicationCount createdAt",
    })
    .populate({
      path: "jobSeeker",
      select:
        "name email phone gender dateOfBirth category state city specializationId selectedSkills skills profilePhoto resume education experienceStatus aadhaarCard status",
      populate: {
        path: "specializationId",
        select: "name skills",
      },
    })
    .sort(sortOptions)
    .skip(skip)
    .limit(limitNumber)
    .lean();

  // If sorting by jobTitle, sort after population
  if (sortBy === "jobTitle") {
    applications.sort((a, b) => {
      const aTitle = a.job?.jobTitle || "";
      const bTitle = b.job?.jobTitle || "";
      return sortOrder === "asc"
        ? aTitle.localeCompare(bTitle)
        : bTitle.localeCompare(aTitle);
    });
  }

  // Format applications
  const formattedApplications = applications.map((application) => {
    const job = application.job;
    const jobSeeker = application.jobSeeker;

    return {
      _id: application._id,
      status: application.status,
      coverLetter: application.coverLetter || "",
      notes: application.notes || "",
      appliedAt: application.createdAt,
      updatedAt: application.updatedAt,
      job: {
        _id: job?._id,
        jobTitle: job?.jobTitle,
        jobDescription: job?.jobDescription,
        city: job?.city,
        expectedSalary: job?.expectedSalary,
        jobType: job?.jobType,
        employmentMode: job?.employmentMode,
        status: job?.status,
        skills: job?.skills || [],
        vacancyCount: job?.vacancyCount,
        applicationCount: job?.applicationCount,
        createdAt: job?.createdAt,
      },
      jobSeeker: {
        _id: jobSeeker?._id,
        name: jobSeeker?.name,
        email: jobSeeker?.email,
        phone: jobSeeker?.phone,
        gender: jobSeeker?.gender,
        dateOfBirth: jobSeeker?.dateOfBirth,
        category: jobSeeker?.category,
        state: jobSeeker?.state,
        city: jobSeeker?.city,
        profilePhoto: jobSeeker?.profilePhoto,
        resume: jobSeeker?.resume,
        aadhaarCard: jobSeeker?.aadhaarCard,
        skills: jobSeeker?.selectedSkills || jobSeeker?.skills || [],
        specialization: jobSeeker?.specializationId
          ? {
            _id: jobSeeker.specializationId._id,
            name: jobSeeker.specializationId.name,
            skills: jobSeeker.specializationId.skills || [],
          }
          : null,
        education: jobSeeker?.education || null,
        experienceStatus: jobSeeker?.experienceStatus,
        status: jobSeeker?.status,
      },
    };
  });

  // Get total count
  const totalApplications = await Application.countDocuments(applicationFilter);
  const totalPages = Math.ceil(totalApplications / limitNumber);

  // Get overall statistics
  const stats = {
    total: await Application.countDocuments({
      job: { $in: jobIds },
      status: { $ne: "Withdrawn" },
    }),
    applied: await Application.countDocuments({
      job: { $in: jobIds },
      status: { $in: ["Applied", "Pending"] },
    }),
    shortlisted: await Application.countDocuments({
      job: { $in: jobIds },
      status: "Shortlisted",
    }),
    rejected: await Application.countDocuments({
      job: { $in: jobIds },
      status: "Rejected",
    }),
    withdrawn: await Application.countDocuments({
      job: { $in: jobIds },
      status: "Withdrawn",
    }),
  };

  return res.status(200).json(
    ApiResponse.success(
      {
        applications: formattedApplications,
        statistics: stats,
        pagination: {
          currentPage: pageNumber,
          totalPages,
          totalApplications,
          limit: limitNumber,
          hasNextPage: pageNumber < totalPages,
          hasPrevPage: pageNumber > 1,
        },
      },
      "Applications fetched successfully"
    )
  );
});

/**
 * Helper function to format date to IST (Indian Standard Time)
 */
const formatToIST = (date) => {
  if (!date) return null;
  const dateObj = new Date(date);
  const istOptions = {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  };
  return dateObj.toLocaleString('en-IN', istOptions);
};

/**
 * Get All Applicants for a Job (Recruiter)
 * Returns all applicants for a specific job post
 * Requires: Recruiter authentication (JWT token)
 */
export const getJobApplicants = asyncHandler(async (req, res) => {
  const recruiter = req.recruiter; // From auth middleware
  const { jobId } = req.params;
  const {
    status,
    page = 1,
    limit = 10,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = req.query;

  // Validate job ID
  if (!mongoose.Types.ObjectId.isValid(jobId)) {
    throw new ApiError(400, "Invalid job ID format");
  }

  // Verify job exists and belongs to this recruiter
  const job = await RecruiterJob.findById(jobId);
  if (!job) {
    throw new ApiError(404, "Job not found");
  }

  if (job.recruiter.toString() !== recruiter._id.toString()) {
    throw new ApiError(403, "You are not authorized to view applicants for this job");
  }

  // Build filter
  const filter = { job: jobId };
  if (status) {
    filter.status = status;
  } else {
    // By default, exclude withdrawn applications
    filter.status = { $ne: "Withdrawn" };
  }

  // Pagination
  const pageNumber = Math.max(1, parseInt(page));
  const limitNumber = Math.min(100, Math.max(1, parseInt(limit)));
  const skip = (pageNumber - 1) * limitNumber;

  // Sort options
  const sortOptions = {};
  if (sortBy === "status") {
    sortOptions.status = sortOrder === "asc" ? 1 : -1;
  } else {
    sortOptions[sortBy] = sortOrder === "asc" ? 1 : -1;
  }

  // Fetch applications with job seeker details
  const applications = await Application.find(filter)
    .populate({
      path: "jobSeeker",
      select:
        "name email phone gender dateOfBirth category state city specializationId selectedSkills skills profilePhoto resume education experienceStatus aadhaarCard status experienceCertificate",
      populate: {
        path: "specializationId",
        select: "name skills",
      },
    })
    .sort(sortOptions)
    .skip(skip)
    .limit(limitNumber)
    .lean();

  // Format applications with job seeker details (filter out applications with deleted job seekers)
  const formattedApplications = applications
    .filter((application) => application.jobSeeker !== null)
    .map((application) => {
      const jobSeeker = application.jobSeeker;
      return {
        _id: application._id,
        status: application.status,
        coverLetter: application.coverLetter || "",
        notes: application.notes || "",
        appliedAt: formatToIST(application.createdAt),
        updatedAt: formatToIST(application.updatedAt),
        jobSeeker: {
          _id: jobSeeker._id,
          name: jobSeeker.name,
          email: jobSeeker.email,
          phone: jobSeeker.phone,
          gender: jobSeeker.gender,
          dateOfBirth: jobSeeker.dateOfBirth,
          category: jobSeeker.category,
          state: jobSeeker.state,
          city: jobSeeker.city,
          profilePhoto: jobSeeker.profilePhoto,
          resume: jobSeeker.resume,
          aadhaarCard: jobSeeker.aadhaarCard,
          skills: jobSeeker.selectedSkills || jobSeeker.skills || [],
          specialization: jobSeeker.specializationId
            ? {
              _id: jobSeeker.specializationId._id,
              name: jobSeeker.specializationId.name,
              skills: jobSeeker.specializationId.skills || [],
            }
            : null,
          education: jobSeeker.education || null,
          experienceStatus: jobSeeker.experienceStatus,
          experienceCertificate: jobSeeker.experienceCertificate || null,
          status: jobSeeker.status,
        },
      };
    });

  // Get total count
  const totalApplications = await Application.countDocuments(filter);
  const totalPages = Math.ceil(totalApplications / limitNumber);

  // Get application statistics
  const stats = {
    total: await Application.countDocuments({ job: jobId, status: { $ne: "Withdrawn" } }),
    applied: await Application.countDocuments({ job: jobId, status: "Applied" }),
    shortlisted: await Application.countDocuments({ job: jobId, status: "Shortlisted" }),
    rejected: await Application.countDocuments({ job: jobId, status: "Rejected" }),
    withdrawn: await Application.countDocuments({ job: jobId, status: "Withdrawn" }),
  };

  return res.status(200).json(
    ApiResponse.success(
      {
        job: {
          _id: job._id,
          jobTitle: job.jobTitle,
          jobDescription: job.jobDescription,
          city: job.city,
          status: job.status,
        },
        applications: formattedApplications,
        statistics: stats,
        pagination: {
          currentPage: pageNumber,
          totalPages,
          totalApplications,
          limit: limitNumber,
          hasNextPage: pageNumber < totalPages,
          hasPrevPage: pageNumber > 1,
        },
      },
      "Job applicants fetched successfully"
    )
  );
});

/**
 * Get Dynamic Filter Options for Job Applicants (Recruiter)
 * Returns only the filter values that exist among applicants for a specific job
 * This helps the frontend show only relevant filter options
 * Requires: Recruiter authentication (JWT token)
 */
export const getApplicantFilterOptions = asyncHandler(async (req, res) => {
  const recruiter = req.recruiter;
  const { jobId } = req.params;

  // Validate job ID
  if (!mongoose.Types.ObjectId.isValid(jobId)) {
    throw new ApiError(400, "Invalid job ID format");
  }

  // Verify job exists and belongs to this recruiter
  const job = await RecruiterJob.findById(jobId);
  if (!job) {
    throw new ApiError(404, "Job not found");
  }

  if (job.recruiter.toString() !== recruiter._id.toString()) {
    throw new ApiError(403, "You are not authorized to view this job");
  }

  // Get all applications for this job (excluding withdrawn)
  const applications = await Application.find({
    job: jobId,
    status: { $ne: "Withdrawn" }
  })
    .populate({
      path: "jobSeeker",
      select: "city state gender dateOfBirth experienceStatus yearOfExperience"
    })
    .lean();

  // Extract unique values from applicants
  const cities = new Set();
  const states = new Set();
  const genders = new Set();
  const experienceLevels = new Set();
  const ageRanges = new Set();

  // Helper function to calculate age
  const calculateAge = (dateOfBirth) => {
    if (!dateOfBirth) return null;
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  // Helper function to get age range label
  const getAgeRange = (age) => {
    if (age === null) return null;
    if (age < 18) return null; // Skip invalid ages
    if (age <= 25) return "18-25";
    if (age <= 35) return "26-35";
    if (age <= 45) return "36-45";
    return "46+";
  };

  // Helper function to get experience range label
  const getExperienceRange = (years) => {
    if (years === null || years === undefined || years === "") return "Fresher";
    const y = parseFloat(years);
    if (isNaN(y) || y === 0) return "Fresher";
    if (y <= 1) return "0-1 Years";
    if (y <= 3) return "1-3 Years";
    if (y <= 5) return "3-5 Years";
    if (y <= 8) return "5-8 Years";
    if (y <= 12) return "8-12 Years";
    return "12+ Years";
  };

  // Process each application
  applications.forEach((app) => {
    const jobSeeker = app.jobSeeker;
    if (!jobSeeker) return;

    // City
    if (jobSeeker.city) {
      cities.add(jobSeeker.city);
    }

    // State
    if (jobSeeker.state) {
      states.add(jobSeeker.state);
    }

    // Gender
    if (jobSeeker.gender) {
      genders.add(jobSeeker.gender);
    }

    // Experience (Ranges)
    if (jobSeeker.experienceStatus) {
      const expRange = getExperienceRange(jobSeeker.yearOfExperience);
      if (expRange) experienceLevels.add(expRange);
    } else {
      experienceLevels.add("Fresher");
    }

    // Age Range
    const age = calculateAge(jobSeeker.dateOfBirth);
    const ageRange = getAgeRange(age);
    if (ageRange) {
      ageRanges.add(ageRange);
    }
  });

  // Sort and format the arrays
  const sortedCities = Array.from(cities).sort();
  const sortedStates = Array.from(states).sort();
  const sortedGenders = Array.from(genders).sort();

  // Sort experience levels (ranges)
  const expRangeOrder = ["Fresher", "0-1 Years", "1-3 Years", "3-5 Years", "5-8 Years", "8-12 Years", "12+ Years"];
  const sortedExperience = Array.from(experienceLevels).sort((a, b) => {
    return expRangeOrder.indexOf(a) - expRangeOrder.indexOf(b);
  });

  // Sort age ranges in logical order
  const ageOrder = ["18-25", "26-35", "36-45", "46+"];
  const sortedAgeRanges = Array.from(ageRanges).sort((a, b) => {
    return ageOrder.indexOf(a) - ageOrder.indexOf(b);
  });

  return res.status(200).json(
    ApiResponse.success(
      {
        totalApplicants: applications.length,
        filters: {
          cities: sortedCities,
          states: sortedStates,
          genders: sortedGenders,
          experience: sortedExperience,
          ageRanges: sortedAgeRanges
        }
      },
      "Filter options fetched successfully"
    )
  );
});

/**
 * Shortlist an Applicant (Recruiter)
 * Updates the application status to "Shortlisted"
 * Requires: Recruiter authentication (JWT token)
 */
export const shortlistApplicant = asyncHandler(async (req, res) => {
  const recruiter = req.recruiter; // From auth middleware
  const { applicationId } = req.params;
  const { notes } = req.body;

  // Validate application ID
  if (!mongoose.Types.ObjectId.isValid(applicationId)) {
    throw new ApiError(400, "Invalid application ID format");
  }

  // Find the application
  const application = await Application.findById(applicationId).populate({
    path: "job",
    select: "recruiter jobTitle",
  });

  if (!application) {
    throw new ApiError(404, "Application not found");
  }

  // Verify the job belongs to this recruiter
  if (application.job.recruiter.toString() !== recruiter._id.toString()) {
    throw new ApiError(403, "You are not authorized to update this application");
  }

  // Check if already shortlisted
  if (application.status === "Shortlisted") {
    throw new ApiError(400, "Application is already shortlisted");
  }

  // Check if withdrawn (cannot shortlist withdrawn applications)
  if (application.status === "Withdrawn") {
    throw new ApiError(400, "Cannot shortlist a withdrawn application");
  }

  // Update application status
  application.status = "Shortlisted";
  if (notes !== undefined) {
    application.notes = notes || "";
  }
  await application.save();

  // Populate job seeker details for response
  await application.populate({
    path: "jobSeeker",
    select:
      "name email phone gender dateOfBirth category state city specializationId selectedSkills skills profilePhoto resume education experienceStatus aadhaarCard status",
    populate: {
      path: "specializationId",
      select: "name skills",
    },
  });

  // Send push notification to job seeker (async, don't block response)
  try {
    await fcmService.sendToUser(application.jobSeeker._id, "JobSeeker", {
      title: "🎉 Congratulations! You're Shortlisted",
      body: `Your application for "${application.job.jobTitle}" has been shortlisted!`,
      data: {
        type: "application_shortlisted",
        applicationId: application._id.toString(),
        jobId: application.job._id.toString()
      }
    });

    // Save notification to database
    await Notification.create({
      title: "🎉 Congratulations! You're Shortlisted",
      body: `Your application for "${application.job.jobTitle}" has been shortlisted!`,
      recipientType: "specific",
      recipients: [{
        userId: application.jobSeeker._id,
        userType: "JobSeeker",
        status: "sent",
        sentAt: new Date()
      }],
      data: {
        type: "application_shortlisted",
        applicationId: application._id.toString(),
        jobId: application.job._id.toString()
      },
      status: "sent",
      sentAt: new Date()
    });
  } catch (err) {
    console.error("Failed to send shortlist notification:", err.message);
  }

  return res.status(200).json(
    ApiResponse.success(
      {
        application: {
          _id: application._id,
          status: application.status,
          coverLetter: application.coverLetter || "",
          notes: application.notes || "",
          appliedAt: application.createdAt,
          updatedAt: application.updatedAt,
          job: {
            _id: application.job._id,
            jobTitle: application.job.jobTitle,
          },
          jobSeeker: {
            _id: application.jobSeeker._id,
            name: application.jobSeeker.name,
            email: application.jobSeeker.email,
            phone: application.jobSeeker.phone,
            profilePhoto: application.jobSeeker.profilePhoto,
          },
        },
      },
      "Applicant shortlisted successfully"
    )
  );
});

/**
 * Reject an Applicant (Recruiter)
 * Updates the application status to "Rejected"
 * Requires: Recruiter authentication (JWT token)
 */
export const rejectApplicant = asyncHandler(async (req, res) => {
  const recruiter = req.recruiter; // From auth middleware
  const { applicationId } = req.params;
  const { notes } = req.body;

  // Validate application ID
  if (!mongoose.Types.ObjectId.isValid(applicationId)) {
    throw new ApiError(400, "Invalid application ID format");
  }

  // Find the application
  const application = await Application.findById(applicationId).populate({
    path: "job",
    select: "recruiter jobTitle",
  });

  if (!application) {
    throw new ApiError(404, "Application not found");
  }

  // Verify the job belongs to this recruiter
  if (application.job.recruiter.toString() !== recruiter._id.toString()) {
    throw new ApiError(403, "You are not authorized to update this application");
  }

  // Check if already rejected
  if (application.status === "Rejected") {
    throw new ApiError(400, "Application is already rejected");
  }

  // Check if withdrawn (cannot reject withdrawn applications)
  if (application.status === "Withdrawn") {
    throw new ApiError(400, "Cannot reject a withdrawn application");
  }

  // Update application status
  application.status = "Rejected";
  if (notes !== undefined) {
    application.notes = notes || "";
  }
  await application.save();

  // Populate job seeker details for response
  await application.populate({
    path: "jobSeeker",
    select:
      "name email phone gender dateOfBirth category state city specializationId selectedSkills skills profilePhoto resume education experienceStatus aadhaarCard status",
    populate: {
      path: "specializationId",
      select: "name skills",
    },
  });

  // Send push notification to job seeker (async, don't block response)
  try {
    await fcmService.sendToUser(application.jobSeeker._id, "JobSeeker", {
      title: "Application Update",
      body: `Your application for "${application.job.jobTitle}" was not selected this time.`,
      data: {
        type: "application_rejected",
        applicationId: application._id.toString(),
        jobId: application.job._id.toString()
      }
    });

    // Save notification to database
    await Notification.create({
      title: "Application Update",
      body: `Your application for "${application.job.jobTitle}" was not selected this time.`,
      recipientType: "specific",
      recipients: [{
        userId: application.jobSeeker._id,
        userType: "JobSeeker",
        status: "sent",
        sentAt: new Date()
      }],
      data: {
        type: "application_rejected",
        applicationId: application._id.toString(),
        jobId: application.job._id.toString()
      },
      status: "sent",
      sentAt: new Date()
    });
  } catch (err) {
    console.error("Failed to send rejection notification:", err.message);
  }

  return res.status(200).json(
    ApiResponse.success(
      {
        application: {
          _id: application._id,
          status: application.status,
          coverLetter: application.coverLetter || "",
          notes: application.notes || "",
          appliedAt: application.createdAt,
          updatedAt: application.updatedAt,
          job: {
            _id: application.job._id,
            jobTitle: application.job.jobTitle,
          },
          jobSeeker: {
            _id: application.jobSeeker._id,
            name: application.jobSeeker.name,
            email: application.jobSeeker.email,
            phone: application.jobSeeker.phone,
            profilePhoto: application.jobSeeker.profilePhoto,
          },
        },
      },
      "Applicant rejected successfully"
    )
  );
});

export const getAllShortlistedCandidates = asyncHandler(async (req, res) => {
  const recruiter = req.recruiter;

  console.log("🔵 Logged-in Recruiter ID:", recruiter._id.toString());

  // 1. Get all job IDs
  const jobs = await RecruiterJob.find({ recruiter: recruiter._id }).select("_id recruiter");

  // Debug: Print job recruiter IDs
  console.log("🟡 Jobs found for this recruiter:");
  jobs.forEach(j => {
    console.log("   ➤ Job ID:", j._id.toString(), "| Recruiter in job:", j.recruiter.toString());
  });

  if (!jobs.length) {
    return res.status(200).json(
      ApiResponse.success(
        { total: 0, shortlisted: [] },
        "No jobs found for this recruiter"
      )
    );
  }

  // 2. Convert job IDs → ObjectId
  const jobIds = jobs.map((job) => new mongoose.Types.ObjectId(job._id));

  // 3. Fetch shortlisted applications
  const shortlistedApplications = await Application.find({
    status: "Shortlisted",
    job: { $in: jobIds }
  })
    .populate("job", "jobTitle city jobType employmentMode")
    .populate("jobSeeker", "name phone email profilePhoto selectedSkills resume gender")
    .sort({ updatedAt: -1 });

  return res.status(200).json(
    ApiResponse.success(
      {
        total: shortlistedApplications.length,
        shortlisted: shortlistedApplications
      },
      "All shortlisted candidates fetched successfully"
    )
  );
});







// Get jobs that have shortlisted candidates
export const getJobsWithShortlistedCandidates = asyncHandler(async (req, res) => {
  const recruiter = req.recruiter; // From auth middleware

  // Step 1: Get all jobs created by recruiter
  const jobs = await RecruiterJob.find({ recruiter: recruiter._id })
    .select("jobTitle status city jobType employmentMode createdAt applicationCount vacancyCount companySnapshot")
    .lean();

  const jobIds = jobs.map((job) => job._id);

  // Step 2: Get shortlist counts for these jobs
  const shortlistedCounts = await Application.aggregate([
    {
      $match: {
        job: { $in: jobIds },
        status: "Shortlisted"
      }
    },
    {
      $group: {
        _id: "$job",
        shortlistedCount: { $sum: 1 }
      }
    }
  ]);

  // Convert to map for quick lookup
  const shortlistedMap = {};
  shortlistedCounts.forEach((x) => {
    shortlistedMap[x._id] = x.shortlistedCount;
  });

  // Step 3: Filter jobs that have shortlisted applicants
  const filteredJobs = jobs
    .map((job) => ({
      ...job,
      shortlistedCount: shortlistedMap[job._id] || 0,
    }))
    .filter((job) => job.shortlistedCount > 0);

  return res.status(200).json(
    ApiResponse.success(
      {
        jobs: filteredJobs,
      },
      "Jobs with shortlisted applicants fetched successfully"
    )
  );
});


// Get shortlisted applicants for a specific job
export const getShortlistedApplicantsForJob = asyncHandler(async (req, res) => {
  const recruiter = req.recruiter;
  const { jobId } = req.params;

  // Validate job ID
  if (!mongoose.Types.ObjectId.isValid(jobId)) {
    throw new ApiError(400, "Invalid job ID format");
  }

  // FIX: Fetch job again
  const job = await RecruiterJob.findById(jobId).lean();
  if (!job) {
    throw new ApiError(404, "Job not found");
  }

  // Validate job ownership
  if (job.recruiter.toString() !== recruiter._id.toString()) {
    throw new ApiError(403, "You are not authorized to view applicants for this job");
  }

  // Fetch shortlisted applicants for this job
  const applications = await Application.find({
    job: jobId,
    status: "Shortlisted",
  })
    .populate({
      path: "jobSeeker",
      select:
        "name email phone gender city state profilePhoto resume specializationId selectedSkills aadhaarCard experienceCertificate documents education experienceStatus",
      populate: {
        path: "specializationId",
        select: "name skills",
      },
    })
    .sort({ updatedAt: -1 }) // Most recent shortlist first
    .lean();

  return res.status(200).json(
    ApiResponse.success(
      {
        job: {
          _id: job._id,
          jobTitle: job.jobTitle,
          city: job.city,
          jobType: job.jobType,
          employmentMode: job.employmentMode,
        },
        shortlistedApplicants: applications,
      },
      "Shortlisted applicants fetched successfully"
    )
  );
});


