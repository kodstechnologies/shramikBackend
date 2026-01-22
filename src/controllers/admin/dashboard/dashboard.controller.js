import { JobSeeker } from "../../../models/jobSeeker/jobSeeker.model.js";
import { Recruiter } from "../../../models/recruiter/recruiter.model.js";
import { RecruiterJob } from "../../../models/recruiter/jobPost/jobPost.model.js";
import { Application } from "../../../models/jobSeeker/application.model.js";
import ApiResponse from "../../../utils/ApiResponse.js";
import { asyncHandler } from "../../../utils/asyncHandler.js";

/**
 * Helper: Parse date range from query params
 * Returns { startDate, endDate } as Date objects or null
 */
const parseDateRange = (query) => {
    const { startDate, endDate } = query;

    let start = null;
    let end = null;

    if (startDate) {
        start = new Date(startDate);
        start.setHours(0, 0, 0, 0); // Start of day
    }

    if (endDate) {
        end = new Date(endDate);
        end.setHours(23, 59, 59, 999); // End of day
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
 * Get Admin Dashboard Stats
 * Returns total users, total recruiters, and total active jobs
 * 
 * Query params:
 * - startDate: ISO date string (e.g., "2025-12-01")
 * - endDate: ISO date string (e.g., "2025-12-17")
 */
export const getDashboardStats = asyncHandler(async (req, res) => {
    const { startDate, endDate } = parseDateRange(req.query);
    const dateFilter = buildDateFilter(startDate, endDate);

    // Build queries with date filter
    const userQuery = { status: "Active", ...dateFilter };
    const recruiterQuery = { ...dateFilter };
    const jobQuery = { status: "Open", ...dateFilter };

    // Get counts in parallel for better performance
    const [totalUsers, totalRecruiters, activeJobs] = await Promise.all([
        JobSeeker.countDocuments(userQuery),
        Recruiter.countDocuments(recruiterQuery),
        RecruiterJob.countDocuments(jobQuery),
    ]);

    // Get growth metrics (comparing to previous period of same length)
    let userGrowth = 0;
    let recruiterGrowth = 0;
    let jobsChange = 0;
    let growthPeriodLabel = "from last month";

    if (startDate && endDate) {
        // Calculate previous period of same length
        const periodLength = endDate.getTime() - startDate.getTime();
        const prevEndDate = new Date(startDate.getTime() - 1);
        const prevStartDate = new Date(prevEndDate.getTime() - periodLength);

        const prevDateFilter = buildDateFilter(prevStartDate, prevEndDate);

        const [prevUsers, prevRecruiters, prevJobs] = await Promise.all([
            JobSeeker.countDocuments({ status: "Active", ...prevDateFilter }),
            Recruiter.countDocuments({ ...prevDateFilter }),
            RecruiterJob.countDocuments({ status: "Open", ...prevDateFilter }),
        ]);

        userGrowth = prevUsers > 0 ? Math.round(((totalUsers - prevUsers) / prevUsers) * 100) : 0;
        recruiterGrowth = prevRecruiters > 0 ? Math.round(((totalRecruiters - prevRecruiters) / prevRecruiters) * 100) : 0;
        jobsChange = prevJobs > 0 ? Math.round(((activeJobs - prevJobs) / prevJobs) * 100) : 0;
        growthPeriodLabel = "from previous period";
    } else {
        // Default: compare to last month/week
        const now = new Date();
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        const [usersLastMonth, recruitersLastMonth, jobsLastWeek] = await Promise.all([
            JobSeeker.countDocuments({ status: "Active", createdAt: { $lt: lastMonth } }),
            Recruiter.countDocuments({ createdAt: { $lt: lastMonth } }),
            RecruiterJob.countDocuments({ status: "Open", createdAt: { $lt: lastWeek } }),
        ]);

        userGrowth = usersLastMonth > 0 ? Math.round(((totalUsers - usersLastMonth) / usersLastMonth) * 100) : 0;
        recruiterGrowth = recruitersLastMonth > 0 ? Math.round(((totalRecruiters - recruitersLastMonth) / recruitersLastMonth) * 100) : 0;
        jobsChange = jobsLastWeek > 0 ? Math.round(((activeJobs - jobsLastWeek) / jobsLastWeek) * 100) : 0;
    }

    return res.status(200).json(
        ApiResponse.success(
            {
                stats: {
                    totalUsers: {
                        count: totalUsers,
                        growth: userGrowth,
                        growthLabel: userGrowth >= 0 ? `+${userGrowth}% ${growthPeriodLabel}` : `${userGrowth}% ${growthPeriodLabel}`,
                    },
                    totalRecruiters: {
                        count: totalRecruiters,
                        growth: recruiterGrowth,
                        growthLabel: recruiterGrowth >= 0 ? `+${recruiterGrowth}% ${growthPeriodLabel}` : `${recruiterGrowth}% ${growthPeriodLabel}`,
                    },
                    activeJobs: {
                        count: activeJobs,
                        growth: jobsChange,
                        growthLabel: jobsChange === 0 ? "Stable" : (jobsChange >= 0 ? `+${jobsChange}% ${growthPeriodLabel}` : `${jobsChange}% ${growthPeriodLabel}`),
                    },
                },
                dateRange: startDate && endDate ? { startDate, endDate } : null,
            },
            "Dashboard stats fetched successfully"
        )
    );
});

/**
 * Get User Distribution by Category
 * Returns breakdown of users by education level (for pie chart)
 * 
 * Query params:
 * - startDate: ISO date string
 * - endDate: ISO date string
 */
export const getUserDistribution = asyncHandler(async (req, res) => {
    const { startDate, endDate } = parseDateRange(req.query);

    // Build match query with date filter
    const matchQuery = { status: "Active" };
    if (startDate && endDate) {
        matchQuery.createdAt = { $gte: startDate, $lte: endDate };
    } else if (startDate) {
        matchQuery.createdAt = { $gte: startDate };
    } else if (endDate) {
        matchQuery.createdAt = { $lte: endDate };
    }

    const distribution = await JobSeeker.aggregate([
        { $match: matchQuery },
        {
            $group: {
                _id: "$category",
                count: { $sum: 1 },
            },
        },
        { $sort: { count: -1 } },
    ]);

    // Format for frontend
    const userMix = distribution.map((item) => ({
        category: item._id || "Unknown",
        count: item.count,
        label: item._id === "Non-Degree Holder" ? "ND (Non-Degree)"
            : item._id === "ITI Holder" ? "ITI (Industrial Training Institute)"
                : item._id === "Diploma Holder" ? "Diploma"
                    : item._id || "Unknown",
    }));

    return res.status(200).json(
        ApiResponse.success(
            {
                userMix,
                dateRange: startDate && endDate ? { startDate, endDate } : null,
            },
            "User distribution fetched successfully"
        )
    );
});

/**
 * Get Recent Coin Transactions
 * Returns latest coin purchases for dashboard table
 * 
 * Query params:
 * - startDate: ISO date string
 * - endDate: ISO date string
 * - page: page number (default: 1)
 * - limit: number of transactions per page (default: 10)
 */
export const getRecentTransactions = asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const { startDate, endDate } = parseDateRange(req.query);

    // Import CoinTransaction model dynamically to avoid circular deps
    const { CoinTransaction } = await import("../../../models/coin/coinTransaction.model.js");

    // Build query with date filter
    const query = { transactionType: "purchase" };
    if (startDate && endDate) {
        query.createdAt = { $gte: startDate, $lte: endDate };
    } else if (startDate) {
        query.createdAt = { $gte: startDate };
    } else if (endDate) {
        query.createdAt = { $lte: endDate };
    }

    // Get total count for pagination
    const totalTransactions = await CoinTransaction.countDocuments(query);
    const totalPages = Math.ceil(totalTransactions / limit);

    const transactions = await CoinTransaction.find(query)
        .populate("userId", "companyName companyLogo name profilePhoto")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

    const formattedTransactions = transactions.map((txn) => ({
        _id: txn._id,
        user: txn.userId?.companyName || txn.userId?.name || "Unknown",
        package: txn.description || "Coin Purchase",
        amount: `₹ ${txn.price || 0}`,
        coins: txn.amount,
        date: txn.createdAt,
        status: txn.status === "success" ? "Completed"
            : txn.status === "pending" ? "Processing"
                : txn.status === "failed" ? "Failed"
                    : txn.status,
    }));

    return res.status(200).json(
        ApiResponse.success(
            { transactions: formattedTransactions },
            "Recent transactions fetched successfully",
            {
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalTransactions,
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
 * Get Dashboard Analytics Data
 * Returns aggregated data for graphs (Users, Jobs, Coins)
 * 
 * Query params:
 * - startDate: ISO date string
 * - endDate: ISO date string
 */
export const getDashboardAnalytics = asyncHandler(async (req, res) => {
    const { startDate, endDate } = parseDateRange(req.query);

    // Default to last 30 days if no date range
    const effectiveEndDate = endDate || new Date();
    effectiveEndDate.setHours(23, 59, 59, 999);

    // If no start date, go back 30 days from effectiveEndDate
    const effectiveStartDate = startDate ? new Date(startDate) : new Date(effectiveEndDate);
    if (!startDate) {
        effectiveStartDate.setDate(effectiveStartDate.getDate() - 30);
    }
    effectiveStartDate.setHours(0, 0, 0, 0);

    // Helper for aggregation
    const getDailyCounts = async (Model, matchQuery, dateField = 'createdAt') => {
        const pipeline = [
            {
                $match: {
                    ...matchQuery,
                    [dateField]: { $gte: effectiveStartDate, $lte: effectiveEndDate }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: `$${dateField}` } },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ];
        return await Model.aggregate(pipeline);
    };

    // Import CoinTransaction dynamically
    const { CoinTransaction } = await import("../../../models/coin/coinTransaction.model.js");

    // 1. User Metrics (JobSeekers)
    // - New Users: Created in range
    // - Active Users (proxy): Created in range AND status is Active AND not blocked
    // - Inactive Users (proxy): Created in range AND (status != Active OR isBlocked = true)
    const [newUsers, activeUsersCreated, inactiveUsersCreated] = await Promise.all([
        getDailyCounts(JobSeeker, {}),
        getDailyCounts(JobSeeker, { status: "Active", isBlocked: { $ne: true } }),
        getDailyCounts(JobSeeker, { $or: [{ status: { $ne: "Active" } }, { isBlocked: true }] })
    ]);

    // 2. Job Metrics
    // - Posts: Created in range
    // - Applications: All applications created in range
    // - Shortlisted (Selected): Applications with status 'Shortlisted'
    // - Rejected: Applications with status 'Rejected'
    const [jobPosts, jobApplications, shortlistedApps, rejectedApps] = await Promise.all([
        getDailyCounts(RecruiterJob, {}),
        getDailyCounts(Application, {}),
        getDailyCounts(Application, { status: "Shortlisted" }),
        getDailyCounts(Application, { status: "Rejected" })
    ]);

    // 3. Coin Metrics (transactionTypes: purchase, deduction, refund, referral)
    // Helper to get daily coin sums (sum of amount field = coins)
    const getDailyCoinSums = async (transactionType) => {
        const pipeline = [
            {
                $match: {
                    transactionType,
                    createdAt: { $gte: effectiveStartDate, $lte: effectiveEndDate }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    count: { $sum: "$amount" }  // Sum of coins, not transaction count
                }
            },
            { $sort: { _id: 1 } }
        ];
        return await CoinTransaction.aggregate(pipeline);
    };

    // Helper to get daily purchase amounts (sum of price = currency)
    const getDailyPurchaseAmounts = async () => {
        const pipeline = [
            {
                $match: {
                    transactionType: "purchase",
                    createdAt: { $gte: effectiveStartDate, $lte: effectiveEndDate }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    amount: { $sum: "$price" }  // Sum of currency
                }
            },
            { $sort: { _id: 1 } }
        ];
        return await CoinTransaction.aggregate(pipeline);
    };

    const [coinPurchases, coinDeductions, coinReferrals, purchaseAmounts] = await Promise.all([
        getDailyCoinSums("purchase"),
        getDailyCoinSums("deduction"),
        getDailyCoinSums("referral"),
        getDailyPurchaseAmounts()
    ]);

    // Generate full date range keys
    const dateMap = new Map();
    const dates = [];
    const current = new Date(effectiveStartDate);

    while (current <= effectiveEndDate) {
        // Use local date components to generate YYYY-MM-DD string
        // This prevents the date from shifting back by one day due to UTC conversion (e.g. 00:00 IST -> Previous Day UTC)
        const year = current.getFullYear();
        const month = String(current.getMonth() + 1).padStart(2, '0');
        const day = String(current.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;

        dates.push(dateStr);
        dateMap.set(dateStr, 0); // Initialize with 0
        current.setDate(current.getDate() + 1);
    }

    // Helper to fill data (for counts)
    const fillDates = (dataArray) => {
        const resultMap = new Map(dateMap); // Copy initialized map
        dataArray.forEach(item => {
            if (resultMap.has(item._id)) {
                resultMap.set(item._id, item.count);
            }
        });
        return Array.from(resultMap.values()); // Return counts in date order
    };

    // Helper to fill data with absolute values (for deductions - make positive)
    const fillDatesAbsolute = (dataArray) => {
        const resultMap = new Map(dateMap); // Copy initialized map
        dataArray.forEach(item => {
            if (resultMap.has(item._id)) {
                resultMap.set(item._id, Math.abs(item.count || 0));
            }
        });
        return Array.from(resultMap.values()); // Return absolute counts in date order
    };

    // Helper to fill data (for amounts)
    const fillDatesAmount = (dataArray) => {
        const resultMap = new Map(dateMap); // Copy initialized map
        dataArray.forEach(item => {
            if (resultMap.has(item._id)) {
                resultMap.set(item._id, item.amount || 0);
            }
        });
        return Array.from(resultMap.values()); // Return amounts in date order
    };

    return res.status(200).json(
        ApiResponse.success({
            dates,
            users: {
                new: fillDates(newUsers),
                active: fillDates(activeUsersCreated),
                inactive: fillDates(inactiveUsersCreated)
            },
            jobs: {
                posted: fillDates(jobPosts),
                applied: fillDates(jobApplications),
                selected: fillDates(shortlistedApps),
                rejected: fillDates(rejectedApps)
            },
            coins: {
                purchase: fillDates(coinPurchases),
                purchaseAmount: fillDatesAmount(purchaseAmounts),
                deduction: fillDatesAbsolute(coinDeductions),
                referral: fillDates(coinReferrals)
            }
        }, "Dashboard analytics fetched successfully")
    );
});
