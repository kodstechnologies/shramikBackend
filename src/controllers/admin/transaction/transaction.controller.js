import { CoinTransaction } from "../../../models/coin/coinTransaction.model.js";
import ApiResponse from "../../../utils/ApiResponse.js";
import { asyncHandler } from "../../../utils/asyncHandler.js";

/**
 * Get All Transactions (Admin)
 */
export const getAllTransactions = asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const { transactionType, status, startDate, endDate, search } = req.query;

    const query = {};

    if (transactionType && transactionType !== "all") {
        query.transactionType = transactionType;
    }

    if (status && status !== "all") {
        query.status = status;
    }

    if (startDate && endDate) {
        query.createdAt = {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
        };
    } else if (startDate) {
        query.createdAt = { $gte: new Date(startDate) };
    } else if (endDate) {
        query.createdAt = { $lte: new Date(endDate) };
    }

    // Search by user name or company name requires lookup, but for simple MVP 
    // we can skip complex aggregation search unless needed. 
    // Assuming 'search' is not critical for first pass or implemented later if requested.

    const totalTransactions = await CoinTransaction.countDocuments(query);
    const totalPages = Math.ceil(totalTransactions / limit);

    const transactions = await CoinTransaction.find(query)
        .populate("userId", "name companyName email profilePhoto role")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

    const formattedTransactions = transactions.map(txn => ({
        _id: txn._id,
        user: {
            name: txn.userId?.name || txn.userId?.companyName || "Unknown",
            email: txn.userId?.email,
            profilePhoto: txn.userId?.profilePhoto,
            role: txn.userId?.role
        },
        type: txn.transactionType,
        description: txn.description,
        amount: txn.price ? `₹${txn.price}` : "-",
        coins: txn.amount,
        status: txn.status,
        date: txn.createdAt,
    }));

    return res.status(200).json(
        ApiResponse.success(
            {
                transactions: formattedTransactions,
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalTransactions,
                    limit,
                    hasNextPage: page < totalPages,
                    hasPrevPage: page > 1,
                }
            },
            "Transactions fetched successfully"
        )
    );
});
