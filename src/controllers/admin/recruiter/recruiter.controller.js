import { Recruiter } from "../../../models/recruiter/recruiter.model.js";
import { RecruiterJob } from "../../../models/recruiter/jobPost/jobPost.model.js";
import { Application } from "../../../models/jobSeeker/application.model.js";
import ApiResponse from "../../../utils/ApiResponse.js";
import { asyncHandler } from "../../../utils/asyncHandler.js";

/**
 * Helper: Parse date range from query params
 */
const parseDateRange = (query) => {
    const { startDate, endDate } = query;

    let start = null;
    let end = null;

    if (startDate) {
        start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
    }

    if (endDate) {
        end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
    }

    return { startDate: start, endDate: end };
};

/**
 * Helper: Build date filter for MongoDB queries
 */
const buildDateFilter = (startDate, endDate, field = "createdAt") => {
    if (!startDate && !endDate) return {};

    const filter = {};
    if (startDate && endDate) {
        filter[field] = { $gte: startDate, $lte: endDate };
    } else if (startDate) {
        filter[field] = { $gte: startDate };
    } else if (endDate) {
        filter[field] = { $lte: endDate };
    }

    return filter;
};

/**
 * Get Recruiter Performance Stats
 * Returns Active Recruiters, Open Positions, Interviews Conducted, Hires Confirmed
 * 
 * Query params:
 * - startDate: ISO date string
 * - endDate: ISO date string
 */
export const getRecruiterStats = asyncHandler(async (req, res) => {
    const { startDate, endDate } = parseDateRange(req.query);
    const dateFilter = buildDateFilter(startDate, endDate);

    // Calculate timestamps for growth metrics
    const now = new Date();
    const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // Get all stats in parallel
    const [
        activeRecruiters,
        recruitersThisMonth,
        openPositions,
        companiesWithOpenPositions,
        shortlistedApplications,      // Using "Shortlisted" as interview indicator
        shortlistedLastWeek,
        hiresConfirmed,               // Applications that progressed to final stages
        totalApplications
    ] = await Promise.all([
        // All Recruiters (count all regardless of status for admin dashboard)
        Recruiter.countDocuments({
            ...dateFilter
        }),

        // Recruiters onboarded this month
        Recruiter.countDocuments({
            createdAt: { $gte: oneMonthAgo },
            ...dateFilter
        }),

        // Open Positions
        RecruiterJob.countDocuments({
            status: "Open",
            ...dateFilter
        }),

        // Distinct companies with open positions
        RecruiterJob.aggregate([
            { $match: { status: "Open", ...dateFilter } },
            { $group: { _id: "$recruiter" } },
            { $count: "total" }
        ]),

        // Interviews Conducted (Shortlisted applications)
        Application.countDocuments({
            status: "Shortlisted",
            ...dateFilter
        }),

        // Shortlisted last week (for growth calculation)
        Application.countDocuments({
            status: "Shortlisted",
            updatedAt: { $gte: twoWeeksAgo, $lt: oneWeekAgo },
            ...dateFilter
        }),

        // Hires Confirmed (we'll track based on application progression)
        Application.countDocuments({
            status: "Shortlisted",
            ...dateFilter
        }),

        // Total applications (for placement success rate)
        Application.countDocuments(dateFilter)
    ]);

    const companyCount = companiesWithOpenPositions[0]?.total || 0;

    // Calculate week-over-week growth for interviews
    const interviewGrowth = shortlistedLastWeek > 0
        ? Math.round(((shortlistedApplications - shortlistedLastWeek) / shortlistedLastWeek) * 100)
        : 0;

    // Calculate placement success rate
    const placementRate = totalApplications > 0
        ? Math.round((hiresConfirmed / totalApplications) * 100)
        : 0;

    return res.status(200).json(
        ApiResponse.success(
            {
                stats: {
                    activeRecruiters: {
                        count: activeRecruiters,
                        growth: recruitersThisMonth,
                        growthLabel: `+${recruitersThisMonth} onboarded this month`,
                    },
                    openPositions: {
                        count: openPositions,
                        subLabel: `Across ${companyCount} companies`,
                    },
                    interviewsConducted: {
                        count: shortlistedApplications,
                        growth: interviewGrowth,
                        growthLabel: interviewGrowth >= 0 ? `+${interviewGrowth}% week-over-week` : `${interviewGrowth}% week-over-week`,
                    },
                    hiresConfirmed: {
                        count: hiresConfirmed,
                        growth: placementRate,
                        growthLabel: `Placement success rate ${placementRate}%`,
                    },
                },
                dateRange: startDate && endDate ? { startDate, endDate } : null,
            },
            "Recruiter stats fetched successfully"
        )
    );
});

/**
 * Get Recruiter Activity Snapshot
 * Returns most engaged recruiters with their activity summary
 * 
 * Query params:
 * - startDate: ISO date string
 * - endDate: ISO date string
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 10)
 */
export const getRecruiterActivity = asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const { search } = req.query;
    const { startDate, endDate } = parseDateRange(req.query);

    // Build query - include all recruiters, not just those with complete registration
    const query = {}; // Show all recruiters for admin view

    // Add search filter (search by name, company name, phone, or email)
    if (search && search.trim()) {
        const searchRegex = new RegExp(search.trim(), "i");
        query.$or = [
            { name: searchRegex },
            { companyName: searchRegex },
            { phone: searchRegex },
            { email: searchRegex }
        ];
    }

    if (startDate && endDate) {
        query.createdAt = { $gte: startDate, $lte: endDate };
    } else if (startDate) {
        query.createdAt = { $gte: startDate };
    } else if (endDate) {
        query.createdAt = { $lte: endDate };
    }

    // Get total count
    const totalCount = await Recruiter.countDocuments(query);
    const totalPages = Math.ceil(totalCount / limit);

    // Get recruiters
    const recruiters = await Recruiter.find(query)
        .select("companyName name companyLogo businessType updatedAt status")
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

    // Get job and application stats for each recruiter
    const recruiterIds = recruiters.map(r => r._id);

    // Get jobs for each recruiter
    const recruiterJobs = await RecruiterJob.aggregate([
        { $match: { recruiter: { $in: recruiterIds }, status: "Open" } },
        {
            $lookup: {
                from: "specializations",
                localField: "specialization",
                foreignField: "_id",
                as: "specializationDetails"
            }
        },
        {
            $group: {
                _id: "$recruiter",
                jobCount: { $sum: 1 },
                focusAreas: { $addToSet: { $arrayElemAt: ["$specializationDetails.name", 0] } },
                jobIds: { $push: "$_id" }
            }
        }
    ]);

    // Map job data
    const jobDataMap = {};
    recruiterJobs.forEach(item => {
        jobDataMap[item._id.toString()] = {
            jobCount: item.jobCount,
            focusAreas: item.focusAreas.filter(Boolean).slice(0, 2),
            jobIds: item.jobIds
        };
    });

    // Get interview counts (shortlisted applications) for each recruiter's jobs
    const allJobIds = recruiterJobs.flatMap(item => item.jobIds);
    const applicationStats = await Application.aggregate([
        { $match: { job: { $in: allJobIds }, status: "Shortlisted" } },
        {
            $lookup: {
                from: "recruiterjobs",
                localField: "job",
                foreignField: "_id",
                as: "jobDetails"
            }
        },
        { $unwind: "$jobDetails" },
        {
            $group: {
                _id: "$jobDetails.recruiter",
                interviewCount: { $sum: 1 }
            }
        }
    ]);

    // Map interview data
    const interviewMap = {};
    applicationStats.forEach(item => {
        interviewMap[item._id.toString()] = item.interviewCount;
    });

    // Determine status based on activity
    const getRecruiterStatus = (recruiterId, interviewCount, jobCount) => {
        if (interviewCount >= 20) return "Hiring Frenzy";
        if (interviewCount >= 10) return "Active Shortlisting";
        if (interviewCount >= 5) return "Interviewing";
        if (jobCount >= 3) return "New Openings";
        return "Shortlisting";
    };

    // Format response
    const formattedRecruiters = recruiters.map(r => {
        const ridStr = r._id.toString();
        const jobData = jobDataMap[ridStr] || { jobCount: 0, focusAreas: [] };
        const interviewCount = interviewMap[ridStr] || 0;

        return {
            _id: r._id,
            company: r.companyName || "Unknown Company",
            recruiter: r.name || "Unknown",
            companyLogo: r.companyLogo,
            focusArea: jobData.focusAreas.join(" & ") || r.businessType || "General",
            interviews: interviewCount,
            lastUpdated: r.updatedAt,
            status: getRecruiterStatus(ridStr, interviewCount, jobData.jobCount),
        };
    });

    return res.status(200).json(
        ApiResponse.success(
            { recruiters: formattedRecruiters },
            "Recruiter activity fetched successfully",
            {
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalCount,
                    limit,
                    hasNextPage: page < totalPages,
                    hasPrevPage: page > 1,
                },
                dateRange: startDate && endDate ? { startDate, endDate } : null,
            }
        )
    );
});

/**
 * Get All Recruiters with comprehensive filters
 * 
 * Query params:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20)
 * - search: Search by company name, name, phone, email
 * - status: Filter by status (Active, Inactive, Pending, Rejected)
 * - isBlocked: Filter by blocked status (true, false)
 */
export const getAllRecruiters = asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const { search, status, isBlocked } = req.query;

    // Build query
    const query = {};

    // Search filter
    if (search) {
        query.$or = [
            { companyName: { $regex: search, $options: "i" } },
            { name: { $regex: search, $options: "i" } },
            { phone: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
        ];
    }

    // Status filter
    if (status && status !== "All") {
        query.status = status;
    }

    // Blocked filter
    if (isBlocked !== undefined && isBlocked !== "") {
        query.isBlocked = isBlocked === "true";
    }

    // Get total count
    const totalCount = await Recruiter.countDocuments(query);
    const totalPages = Math.ceil(totalCount / limit);

    // Get recruiters
    const recruiters = await Recruiter.find(query)
        .select("companyName name phone email businessType status isBlocked companyLogo createdAt updatedAt coinBalance")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

    // Format response
    const formattedRecruiters = recruiters.map(r => ({
        _id: r._id,
        companyName: r.companyName || "Unknown Company",
        name: r.name || "Unknown",
        phone: r.phone,
        email: r.email,
        businessType: r.businessType || "Not specified",
        status: r.status,
        isBlocked: r.isBlocked || false,
        companyLogo: r.companyLogo,
        coinBalance: r.coinBalance || 0,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
    }));

    return res.status(200).json(
        ApiResponse.success(
            {
                recruiters: formattedRecruiters,
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalCount,
                    limit,
                    hasNextPage: page < totalPages,
                    hasPrevPage: page > 1,
                },
            },
            "Recruiters fetched successfully"
        )
    );
});

/**
 * Get Recruiter Details with Jobs
 * Fetches complete recruiter profile and all their posted jobs
 */
export const getRecruiterDetails = asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Get recruiter details
    const recruiter = await Recruiter.findById(id)
        .select("-password -refreshToken -fcmTokens")
        .lean();

    if (!recruiter) {
        return res.status(404).json(
            ApiResponse.error("Recruiter not found")
        );
    }

    // Get all jobs by this recruiter
    const jobs = await RecruiterJob.find({ recruiter: id })
        .select("jobTitle jobType city status applicationCount vacancyCount expectedSalary isBlocked createdAt updatedAt")
        .sort({ createdAt: -1 })
        .lean();

    // Format jobs for response
    const formattedJobs = jobs.map(job => ({
        _id: job._id,
        jobTitle: job.jobTitle,
        jobType: job.jobType,
        city: job.city,
        status: job.status,
        applicationCount: job.applicationCount || 0,
        vacancyCount: job.vacancyCount || 1,
        isBlocked: job.isBlocked || false,
        salary: job.expectedSalary ? {
            min: job.expectedSalary.min,
            max: job.expectedSalary.max,
            currency: job.expectedSalary.currency || "INR",
        } : null,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
    }));

    // Format recruiter response
    const formattedRecruiter = {
        _id: recruiter._id,
        companyName: recruiter.companyName || "Unknown Company",
        name: recruiter.name || "Unknown",
        phone: recruiter.phone,
        email: recruiter.email,
        businessType: recruiter.businessType || "Not specified",
        status: recruiter.status,
        isBlocked: recruiter.isBlocked || false,
        companyLogo: recruiter.companyLogo,
        coinBalance: recruiter.coinBalance || 0,
        createdAt: recruiter.createdAt,
        updatedAt: recruiter.updatedAt,
    };

    return res.status(200).json(
        ApiResponse.success(
            {
                recruiter: formattedRecruiter,
                jobs: formattedJobs,
                totalJobs: formattedJobs.length,
            },
            "Recruiter details fetched successfully"
        )
    );
});

/**
 * Block a Recruiter
 */
export const blockRecruiter = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;

    const recruiter = await Recruiter.findById(id);
    if (!recruiter) {
        return res.status(404).json(
            ApiResponse.error("Recruiter not found")
        );
    }

    if (recruiter.isBlocked) {
        return res.status(400).json(
            ApiResponse.error("Recruiter is already blocked")
        );
    }

    recruiter.isBlocked = true;
    recruiter.fcmTokens = []; // Clear FCM tokens to logout from all devices

    await recruiter.save();

    return res.status(200).json(
        ApiResponse.success(
            {
                recruiter: {
                    _id: recruiter._id,
                    name: recruiter.name,
                    companyName: recruiter.companyName,
                    phone: recruiter.phone,
                    isBlocked: recruiter.isBlocked,
                }
            },
            "Recruiter blocked successfully"
        )
    );
});

/**
 * Unblock a Recruiter
 */
export const unblockRecruiter = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const recruiter = await Recruiter.findById(id);
    if (!recruiter) {
        return res.status(404).json(
            ApiResponse.error("Recruiter not found")
        );
    }

    if (!recruiter.isBlocked) {
        return res.status(400).json(
            ApiResponse.error("Recruiter is not blocked")
        );
    }

    recruiter.isBlocked = false;

    await recruiter.save();

    return res.status(200).json(
        ApiResponse.success(
            {
                recruiter: {
                    _id: recruiter._id,
                    name: recruiter.name,
                    companyName: recruiter.companyName,
                    phone: recruiter.phone,
                    isBlocked: recruiter.isBlocked,
                }
            },
            "Recruiter unblocked successfully"
        )
    );
});

/**
 * Block a Job
 */
export const blockJob = asyncHandler(async (req, res) => {
    const { jobId } = req.params;

    const job = await RecruiterJob.findById(jobId);
    if (!job) {
        return res.status(404).json(
            ApiResponse.error("Job not found")
        );
    }

    if (job.isBlocked) {
        return res.status(400).json(
            ApiResponse.error("Job is already blocked")
        );
    }

    job.isBlocked = true;
    await job.save();

    return res.status(200).json(
        ApiResponse.success(
            {
                job: {
                    _id: job._id,
                    jobTitle: job.jobTitle,
                    isBlocked: job.isBlocked,
                }
            },
            "Job blocked successfully"
        )
    );
});

/**
 * Unblock a Job
 */
export const unblockJob = asyncHandler(async (req, res) => {
    const { jobId } = req.params;

    const job = await RecruiterJob.findById(jobId);
    if (!job) {
        return res.status(404).json(
            ApiResponse.error("Job not found")
        );
    }

    if (!job.isBlocked) {
        return res.status(400).json(
            ApiResponse.error("Job is not blocked")
        );
    }

    job.isBlocked = false;
    await job.save();

    return res.status(200).json(
        ApiResponse.success(
            {
                job: {
                    _id: job._id,
                    jobTitle: job.jobTitle,
                    isBlocked: job.isBlocked,
                }
            },
            "Job unblocked successfully"
        )
    );
});
