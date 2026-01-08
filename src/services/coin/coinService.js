import mongoose from "mongoose";
import { JobSeeker } from "../../models/jobSeeker/jobSeeker.model.js";
import { Recruiter } from "../../models/recruiter/recruiter.model.js";
import { CoinTransaction } from "../../models/coin/coinTransaction.model.js";
import ApiError from "../../utils/ApiError.js";

/**
 * Get user model based on user type
 */
const getUserModel = (userType) => {
  if (userType === "job-seeker") {
    return JobSeeker;
  } else if (userType === "recruiter") {
    return Recruiter;
  }
  throw new ApiError(400, "Invalid user type");
};

/**
 * Get user type model name for refPath
 */
const getUserTypeModel = (userType) => {
  if (userType === "job-seeker") {
    return "JobSeeker";
  } else if (userType === "recruiter") {
    return "Recruiter";
  }
  throw new ApiError(400, "Invalid user type");
};

/**
 * Get current coin balance for a user
 */
export const getCoinBalance = async (userId, userType) => {
  const UserModel = getUserModel(userType);
  const user = await UserModel.findById(userId).select("coinBalance");

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  return user.coinBalance || 0;
};

/**
 * Check if user has sufficient coin balance
 */
export const checkCoinBalance = async (userId, userType, requiredAmount) => {
  const currentBalance = await getCoinBalance(userId, userType);

  return {
    hasSufficientBalance: currentBalance >= requiredAmount,
    currentBalance,
    requiredAmount,
    shortage: Math.max(0, requiredAmount - currentBalance),
  };
};

/**
 * Deduct coins from user balance
 * Creates a transaction record and updates user balance atomically
 */
export const deductCoins = async (
  userId,
  userType,
  amount,
  description,
  relatedEntityId = null,
  relatedEntityType = null
) => {
  if (amount <= 0) {
    throw new ApiError(400, "Deduction amount must be greater than 0");
  }

  const UserModel = getUserModel(userType);
  const userTypeModel = getUserTypeModel(userType);

  // Use MongoDB session for transaction
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Get user with current balance
    const user = await UserModel.findById(userId).session(session);
    if (!user) {
      throw new ApiError(404, "User not found");
    }

    const currentBalance = user.coinBalance || 0;

    if (currentBalance < amount) {
      throw new ApiError(400, `Insufficient coin balance. Required: ${amount}, Available: ${currentBalance}`);
    }

    const newBalance = currentBalance - amount;

    // Update user balance
    user.coinBalance = newBalance;
    await user.save({ session });

    // Create transaction record
    const transaction = await CoinTransaction.create(
      [
        {
          userId,
          userType,
          userTypeModel,
          transactionType: "deduction",
          amount: -amount, // Negative for deduction
          price: 0,
          status: "success",
          description,
          relatedEntityId,
          relatedEntityType,
          balanceAfter: newBalance,
        },
      ],
      { session }
    );

    await session.commitTransaction();

    return {
      success: true,
      transaction: transaction[0],
      balanceBefore: currentBalance,
      balanceAfter: newBalance,
      amountDeducted: amount,
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * Add coins to user balance (for purchases or refunds)
 * Creates a transaction record and updates user balance atomically
 */
export const addCoins = async (
  userId,
  userType,
  amount,
  description,
  price = 0,
  transactionType = "purchase",
  razorpayOrderId = null,
  razorpayPaymentId = null,
  razorpaySignature = null,
  status = "success"
) => {
  if (amount <= 0) {
    throw new ApiError(400, "Amount must be greater than 0");
  }

  const UserModel = getUserModel(userType);
  const userTypeModel = getUserTypeModel(userType);

  // Use MongoDB session for transaction
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Get user with current balance
    const user = await UserModel.findById(userId).session(session);
    if (!user) {
      throw new ApiError(404, "User not found");
    }

    const currentBalance = user.coinBalance || 0;
    const newBalance = currentBalance + amount;

    // Update user balance
    user.coinBalance = newBalance;
    await user.save({ session });

    // Create transaction record
    const transaction = await CoinTransaction.create(
      [
        {
          userId,
          userType,
          userTypeModel,
          transactionType,
          amount, // Positive for purchase/refund
          price,
          razorpayOrderId,
          razorpayPaymentId,
          razorpaySignature,
          status,
          description,
          balanceAfter: newBalance,
        },
      ],
      { session }
    );

    await session.commitTransaction();

    return {
      success: true,
      transaction: transaction[0],
      balanceBefore: currentBalance,
      balanceAfter: newBalance,
      amountAdded: amount,
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * Refund coins (reverse a deduction)
 */
export const refundCoins = async (
  userId,
  userType,
  amount,
  description,
  originalTransactionId = null
) => {
  return addCoins(
    userId,
    userType,
    amount,
    description || `Refund: ${description}`,
    0,
    "refund",
    null,
    null,
    null,
    "success"
  );
};

/**
 * Get transaction history for a user
 */
export const getTransactionHistory = async (
  userId,
  userType,
  { page = 1, limit = 10, transactionType = null, status = null } = {}
) => {
  const pageNumber = Math.max(1, parseInt(page));
  const limitNumber = Math.min(100, Math.max(1, parseInt(limit)));
  const skip = (pageNumber - 1) * limitNumber;

  const filter = {
    userId,
    userType,
  };

  if (transactionType) {
    filter.transactionType = transactionType;
  }

  if (status) {
    filter.status = status;
  }

  const [transactions, total] = await Promise.all([
    CoinTransaction.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNumber)
      .lean(),
    CoinTransaction.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(total / limitNumber);

  // Format transactions with IST timezone
  const formattedTransactions = transactions.map(txn => {
    const createdAt = new Date(txn.createdAt);
    const updatedAt = new Date(txn.updatedAt);

    // Convert to IST (UTC+5:30)
    const istOptions = {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    };

    const dateOnlyOptions = {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    };

    const timeOnlyOptions = {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    };

    // Get today's date in IST
    const now = new Date();
    const todayIST = now.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
    const txnDateIST = createdAt.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });

    // Determine if transaction is from today
    const isToday = todayIST === txnDateIST;

    // Format the display string
    const timeStr = createdAt.toLocaleTimeString('en-IN', timeOnlyOptions);
    const dateStr = createdAt.toLocaleDateString('en-IN', dateOnlyOptions);
    const formattedDate = isToday ? `Today, ${timeStr}` : `${dateStr}, ${timeStr}`;

    return {
      ...txn,
      createdAt: formattedDate, // Override with IST formatted date for display
      updatedAt: updatedAt.toLocaleString('en-IN', istOptions),
      createdAtUTC: txn.createdAt, // Keep original UTC for reference
      updatedAtUTC: txn.updatedAt, // Keep original UTC for reference
      createdAtIST: createdAt.toLocaleString('en-IN', istOptions),
      updatedAtIST: updatedAt.toLocaleString('en-IN', istOptions),
      formattedDate, // "Today, 12:30 PM" or "Jan 8, 2026, 12:30 PM"
      isToday
    };
  });

  return {
    transactions: formattedTransactions,
    pagination: {
      currentPage: pageNumber,
      totalPages,
      totalTransactions: total,
      limit: limitNumber,
      hasNextPage: pageNumber < totalPages,
      hasPrevPage: pageNumber > 1,
    },
  };
};

