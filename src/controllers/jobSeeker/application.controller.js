import ApiResponse from "../../utils/ApiResponse.js";
import ApiError from "../../utils/ApiError.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import mongoose from "mongoose";
import { Application } from "../../models/jobSeeker/application.model.js";
import { RecruiterJob } from "../../models/recruiter/jobPost/jobPost.model.js";
import { JobSeeker } from "../../models/jobSeeker/jobSeeker.model.js";
import { CoinRule } from "../../models/admin/coinPricing/coinPricing.model.js";
import { deductCoins, checkCoinBalance } from "../../services/coin/coinService.js";
import { processReferralReward } from "../../services/referral/referralService.js";

/**
 * Apply for a Job (Job Seeker)
 * Allows authenticated job seekers to apply for job posts
 */
export const applyForJob = asyncHandler(async (req, res) => {
  const jobSeeker = req.jobSeeker; // From auth middleware
  const { jobId, coverLetter, notes } = req.body;

  // Validate job ID
  if (!jobId) {
    throw new ApiError(400, "Job ID is required");
  }

  if (!mongoose.Types.ObjectId.isValid(jobId)) {
    throw new ApiError(400, "Invalid job ID format");
  }

  // Check if job exists and is open
  // Populate recruiter to check blocked status
  const job = await RecruiterJob.findById(jobId).populate("recruiter", "isBlocked");

  if (!job) {
    throw new ApiError(404, "Job not found");
  }

  // Check if recruiter is blocked
  if (job.recruiter && job.recruiter.isBlocked) {
    throw new ApiError(400, "Cannot apply for this job. The recruiter account has been blocked.");
  }

  if (job.status !== "Open") {
    throw new ApiError(400, `Cannot apply for this job. Job status is: ${job.status}`);
  }

  // Registration check removed - allowing all authenticated users to apply

  // Fetch coin cost for job application
  const coinRule = await CoinRule.findOne({ category: "jobSeeker" });
  const coinCostPerApplication = coinRule?.coinCostPerApplication || 0;

  // Check coin balance if coin cost is set (only for new applications)
  let coinTransaction = null;
  let balanceAfter = null;
  if (coinCostPerApplication > 0) {
    const balanceCheck = await checkCoinBalance(
      jobSeeker._id,
      "job-seeker",
      coinCostPerApplication
    );

    if (!balanceCheck.hasSufficientBalance) {
      // Send low balance notification
      try {
        const { fcmService } = await import("../../firebase/fcm.service.js");
        const Notification = (await import("../../firebase/notification.model.js")).default;

        await fcmService.sendToUser(jobSeeker._id, "JobSeeker", {
          title: "⚠️ Low Coin Balance",
          body: `You need ${coinCostPerApplication} coins to apply. Current balance: ${balanceCheck.currentBalance} coins. Purchase more coins!`,
          data: { type: "low_coin_balance", requiredCoins: String(coinCostPerApplication), currentBalance: String(balanceCheck.currentBalance) }
        });

        // Save notification to database
        await Notification.create({
          title: "⚠️ Low Coin Balance",
          body: `You need ${coinCostPerApplication} coins to apply. Current balance: ${balanceCheck.currentBalance} coins. Purchase more coins!`,
          recipientType: "specific",
          recipients: [{ userId: jobSeeker._id, userType: "JobSeeker", status: "sent", sentAt: new Date() }],
          data: { type: "low_coin_balance", requiredCoins: String(coinCostPerApplication), currentBalance: String(balanceCheck.currentBalance) },
          status: "sent",
          sentAt: new Date()
        });
      } catch (err) {
        console.error("Failed to send low balance notification:", err.message);
      }

      throw new ApiError(
        400,
        `Insufficient coin balance. Required: ${coinCostPerApplication} coins, Available: ${balanceCheck.currentBalance} coins. Please purchase more coins.`
      );
    }
  }

  // Check if already applied
  const existingApplication = await Application.findOne({
    job: jobId,
    jobSeeker: jobSeeker._id,
  });

  if (existingApplication) {
    if (existingApplication.status === "Withdrawn") {
      // Allow re-applying if previously withdrawn
      existingApplication.status = "Pending"; // Set to Pending - waiting for recruiter action
      // Update coverLetter and notes only if provided
      if (coverLetter !== undefined) {
        existingApplication.coverLetter = coverLetter?.trim() || "";
      }
      if (notes !== undefined) {
        existingApplication.notes = notes?.trim() || "";
      }
      await existingApplication.save();

      // Increment application count if it was withdrawn before
      const updatedJob = await RecruiterJob.findByIdAndUpdate(
        jobId,
        {
          $inc: { applicationCount: 1 },
        },
        { new: true }
      );

      // Auto-deactivate job if application count reaches or exceeds vacancy count
      if (updatedJob && updatedJob.vacancyCount && updatedJob.applicationCount >= updatedJob.vacancyCount) {
        if (updatedJob.status === "Open") {
          updatedJob.status = "Closed";
          await updatedJob.save();
        }
      }

      // Note: No coin deduction for re-applying to previously withdrawn applications

      return res.status(200).json(
        ApiResponse.success(
          {
            application: existingApplication,
            coinTransaction: null, // No coin deduction for re-application
          },
          "Application submitted successfully"
        )
      );
    } else {
      throw new ApiError(400, "You have already applied for this job");
    }
  }

  // Create new application
  // coverLetter and notes are optional - use empty string if not provided
  const application = await Application.create({
    job: jobId,
    jobSeeker: jobSeeker._id,
    coverLetter: coverLetter?.trim() || "",
    notes: notes?.trim() || "",
    status: "Pending", // Start as "Pending" - waiting for recruiter action
  });

  // Deduct coins after successful application creation
  if (coinCostPerApplication > 0) {
    try {
      const deductionResult = await deductCoins(
        jobSeeker._id,
        "job-seeker",
        coinCostPerApplication,
        `Job Application: ${job.jobTitle} (${coinCostPerApplication} coins)`,
        application._id,
        "application"
      );
      coinTransaction = deductionResult.transaction;
      balanceAfter = deductionResult.balanceAfter;
    } catch (error) {
      // If coin deduction fails, delete the application and throw error
      await Application.findByIdAndDelete(application._id);
      throw error;
    }
  }

  // Increment application count on job and check if vacancy is filled
  const updatedJob = await RecruiterJob.findByIdAndUpdate(
    jobId,
    {
      $inc: { applicationCount: 1 },
    },
    { new: true }
  );

  // Auto-deactivate job if application count reaches or exceeds vacancy count
  if (updatedJob && updatedJob.vacancyCount && updatedJob.applicationCount >= updatedJob.vacancyCount) {
    if (updatedJob.status === "Open") {
      updatedJob.status = "Closed";
      await updatedJob.save();
    }
  }

  // Process referral reward if this is the job seeker's first application
  // This awards coins to the referrer (if any) when the referred user applies for a job
  let referralRewardInfo = null;
  try {
    // Check if this is the first application (excluding withdrawn)
    const applicationCount = await Application.countDocuments({
      jobSeeker: jobSeeker._id,
      status: { $ne: "Withdrawn" }
    });

    console.log("🎁 ═══════════════════════════════════════════════════");
    console.log("🎁 REFERRAL CHECK IN applyForJob");
    console.log("🎁 Job Seeker ID:", jobSeeker._id);
    console.log("🎁 Application Count (excluding withdrawn):", applicationCount);
    console.log("🎁 Is First Application:", applicationCount === 1);

    if (applicationCount === 1) {
      // This is the first application - process referral reward
      console.log("🎁 Calling processReferralReward...");
      referralRewardInfo = await processReferralReward(
        jobSeeker._id,
        "JobSeeker",
        "job_application"
      );
      console.log("🎁 processReferralReward result:", referralRewardInfo);
    } else {
      console.log("🎁 Not first application, skipping referral reward");
    }
    console.log("🎁 ═══════════════════════════════════════════════════");
  } catch (refErr) {
    console.error("❌ Error processing referral reward:", refErr.message);
    console.error("❌ Stack:", refErr.stack);
  }

  // Populate job and job seeker details for response
  await application.populate([
    {
      path: "job",
      select: "jobTitle city expectedSalary jobType employmentMode status",
    },
    {
      path: "jobSeeker",
      select: "firstName lastName phone email",
    },
  ]);

  return res.status(201).json(
    ApiResponse.success(
      {
        application,
        coinTransaction: coinTransaction
          ? {
            amount: coinCostPerApplication,
            balanceAfter,
            description: coinTransaction.description,
          }
          : null,
      },
      "Application submitted successfully"
    )
  );
});

/**
 * Get Job Seeker's Applications
 * Returns all applications made by the authenticated job seeker
 */
export const getMyApplications = asyncHandler(async (req, res) => {
  const jobSeeker = req.jobSeeker; // From auth middleware
  const { status, page = 1, limit = 10 } = req.query;

  // Build filter
  const filter = { jobSeeker: jobSeeker._id };
  if (status) {
    // Map "Accepted" (job seeker view) to "Shortlisted" (database status)
    if (status === "Accepted") {
      filter.status = "Shortlisted";
    } else {
      filter.status = status;
    }
  }

  // Pagination
  const pageNumber = Math.max(1, parseInt(page));
  const limitNumber = Math.min(100, Math.max(1, parseInt(limit)));
  const skip = (pageNumber - 1) * limitNumber;

  // Fetch coin cost for job application
  const coinRule = await CoinRule.findOne({ category: "jobSeeker" });
  const coinCostPerApplication = coinRule?.coinCostPerApplication || 0;

  // Fetch applications with pagination
  const applications = await Application.find(filter)
    .populate({
      path: "job",
      select: "jobTitle jobDescription city expectedSalary jobType employmentMode categories tags status applicationCount companySnapshot recruiter",
      populate: {
        path: "recruiter",
        select: "companyName companyLogo city state isBlocked",
      },
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limitNumber)
    .lean();

  // Map status for job seeker view and add coin cost
  // Filter out applications where job has been deleted
  const applicationsWithCoinCost = applications
    .filter((application) => application.job !== null)
    .map((application) => {
      // Map "Shortlisted" to "Accepted" for job seeker view
      // Keep "Applied" and "Pending" as separate statuses
      let displayStatus = application.status;

      // Check if recruiter is blocked - override status to Closed
      const isRecruiterBlocked = application.job?.recruiter?.isBlocked;

      if (isRecruiterBlocked) {
        displayStatus = "Recruiter Blocked - Job Closed";
      } else if (application.status === "Shortlisted") {
        displayStatus = "Accepted";
      }
      // Keep "Applied" and "Pending" as is - both are valid statuses

      // Determine progress steps for UI progress tracker
      // Applied: always true once application is created
      // Pending: true if status is Applied, Pending, or beyond
      // Accepted: true if status is Shortlisted/Accepted
      // Rejected: true if status is Rejected
      const progressSteps = {
        applied: true, // Always true - application was submitted
        pending: application.status === "Applied" || application.status === "Pending" || application.status === "Shortlisted" || application.status === "Rejected" || application.status === "Withdrawn",
        accepted: application.status === "Shortlisted",
        rejected: application.status === "Rejected",
      };

      // Format recruiter info (handle null cases)
      const recruiterInfo = application.job?.recruiter
        ? {
          _id: application.job.recruiter._id,
          companyName: application.job.recruiter.companyName || application.job.companySnapshot?.name || "Company",
          companyLogo: application.job.recruiter.companyLogo || application.job.companySnapshot?.logo || "",
          city: application.job.recruiter.city || application.job.city || "",
          state: application.job.recruiter.state || "",
          isBlocked: application.job.recruiter.isBlocked || false,
        }
        : {
          companyName: application.job?.companySnapshot?.name || "Company",
          companyLogo: application.job?.companySnapshot?.logo || "",
          city: application.job?.city || "",
          state: "",
          isBlocked: false,
        };

      return {
        _id: application._id,
        status: displayStatus,
        progressSteps, // Progress tracker information for UI
        coverLetter: application.coverLetter || "",
        notes: application.notes || "",
        coinCostPerApplication,
        createdAt: application.createdAt,
        updatedAt: application.updatedAt,
        job: {
          _id: application.job._id,
          jobTitle: application.job.jobTitle || "Job Removed",
          jobDescription: application.job.jobDescription || "",
          city: application.job.city || "",
          expectedSalary: application.job.expectedSalary || {},
          jobType: application.job.jobType || "",
          employmentMode: application.job.employmentMode || "",
          categories: application.job.categories || [],
          tags: application.job.tags || [],
          status: isRecruiterBlocked ? "Closed" : (application.job.status || "Closed"),
          applicationCount: application.job.applicationCount || 0,
          companySnapshot: application.job.companySnapshot || {},
          recruiter: recruiterInfo,
        },
      };
    });

  // Get total count
  const totalApplications = await Application.countDocuments(filter);
  const totalPages = Math.ceil(totalApplications / limitNumber);

  return res.status(200).json(
    ApiResponse.success(
      {
        applications: applicationsWithCoinCost,
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
 * Withdraw Application
 * Allows job seeker to withdraw their application
 */
export const withdrawApplication = asyncHandler(async (req, res) => {
  const jobSeeker = req.jobSeeker;
  const { applicationId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(applicationId)) {
    throw new ApiError(400, "Invalid application ID format");
  }

  const application = await Application.findById(applicationId);

  if (!application) {
    throw new ApiError(404, "Application not found");
  }

  // Check if application belongs to the job seeker
  if (application.jobSeeker.toString() !== jobSeeker._id.toString()) {
    throw new ApiError(403, "You are not authorized to withdraw this application");
  }

  // Check if already withdrawn
  if (application.status === "Withdrawn") {
    throw new ApiError(400, "Application is already withdrawn");
  }

  // Check if already processed (shortlisted/rejected)
  if (application.status === "Shortlisted" || application.status === "Rejected") {
    throw new ApiError(400, `Cannot withdraw application. Current status: ${application.status}`);
  }

  // Update status to withdrawn
  application.status = "Withdrawn";
  await application.save();

  // Decrement application count on job
  await RecruiterJob.findByIdAndUpdate(application.job, {
    $inc: { applicationCount: -1 },
  });

  return res.status(200).json(
    ApiResponse.success(
      { application },
      "Application withdrawn successfully"
    )
  );
});

