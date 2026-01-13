import ApiResponse from "../../utils/ApiResponse.js";
import ApiError from "../../utils/ApiError.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import {
  getCoinBalance,
  checkCoinBalance,
  addCoins,
  getTransactionHistory,
} from "../../services/coin/coinService.js";
import { CoinPackage, CoinRule } from "../../models/admin/coinPricing/coinPricing.model.js";
import { Recruiter } from "../../models/recruiter/recruiter.model.js";
import { Referral } from "../../models/referral/referral.model.js";
import { ensureReferralCode } from "../../utils/referralCode.js";
import { CoinTransaction } from "../../models/coin/coinTransaction.model.js";

/**
 * Get current coin balance
 */
export const getBalance = asyncHandler(async (req, res) => {
  const recruiter = req.recruiter;
  const balance = await getCoinBalance(recruiter._id, "recruiter");

  // Check if balance is low (threshold: 10 coins)
  const lowBalanceThreshold = 10;
  const hasLowBalance = balance < lowBalanceThreshold;

  return res.status(200).json(
    ApiResponse.success(
      {
        coinBalance: balance,
        hasLowBalance,
        lowBalanceThreshold,
        message: hasLowBalance
          ? "Low coin balance. Please purchase more coins to continue."
          : null,
      },
      "Coin balance retrieved successfully"
    )
  );
});

/**
 * Get transaction history
 */
export const getTransactions = asyncHandler(async (req, res) => {
  const recruiter = req.recruiter;
  const { page = 1, limit = 10, transactionType, status } = req.query;

  const result = await getTransactionHistory(recruiter._id, "recruiter", {
    page,
    limit,
    transactionType,
    status,
  });

  return res.status(200).json(
    ApiResponse.success(
      {
        transactions: result.transactions,
        pagination: result.pagination,
      },
      "Transaction history retrieved successfully"
    )
  );
});

/**
 * Get available coin packages for purchase
 */
export const getCoinPackages = asyncHandler(async (req, res) => {
  const packages = await CoinPackage.find({
    category: "recruiter",
    isVisible: true,
  })
    .sort({ coins: 1 })
    .lean();

  // Helper to get popular package name
  const getPopularPackageName = async (category) => {
    // Defines standard description prefix used in purchases
    const descriptionPrefix = "Coin Purchase: ";

    // Aggregate purchases to find most common description
    const popularStats = await CoinTransaction.aggregate([
      {
        $match: {
          transactionType: "purchase",
          status: "success",
          userType: "recruiter", // Ensure we only count recruiter purchases
          description: { $regex: `^${descriptionPrefix}` }
        }
      },
      { $group: { _id: "$description", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 1 }
    ]);

    if (popularStats.length > 0) {
      // Extract package name from description "Coin Purchase: PackageName"
      return popularStats[0]._id.replace(descriptionPrefix, "");
    }
    return null;
  };

  const formattedPackagesPromise = Promise.all(packages.map(async (pkg) => {
    return {
      id: pkg._id.toString(),
      name: pkg.name,
      coins: pkg.coins,
      price: {
        amount: pkg.price.amount,
        currency: pkg.price.currency,
      },
    };
  }));

  const [formattedPackages, popularPackageName] = await Promise.all([
    formattedPackagesPromise,
    getPopularPackageName("recruiter")
  ]);

  const finalPackages = formattedPackages.map(pkg => ({
    ...pkg,
    isPopular: popularPackageName ? pkg.name === popularPackageName : false,
    tag: (popularPackageName && pkg.name === popularPackageName)
      ? "Most bought by users"
      : null
  }));

  return res.status(200).json(
    ApiResponse.success(
      {
        packages: finalPackages,
      },
      "Coin packages retrieved successfully"
    )
  );
});

/**
 * Get a single coin package by ID
 */
export const getCoinPackageById = asyncHandler(async (req, res) => {
  const { packageId } = req.params;

  if (!packageId) {
    throw new ApiError(400, "Package ID is required");
  }

  const coinPackage = await CoinPackage.findOne({
    _id: packageId,
    category: "recruiter",
    isVisible: true,
  }).lean();

  if (!coinPackage) {
    throw new ApiError(404, "Coin package not found or not available");
  }

  const formattedPackage = {
    id: coinPackage._id.toString(),
    name: coinPackage.name,
    coins: coinPackage.coins,
    price: {
      amount: coinPackage.price.amount,
      currency: coinPackage.price.currency,
    },
  };

  return res.status(200).json(
    ApiResponse.success(
      {
        package: formattedPackage,
      },
      "Coin package retrieved successfully"
    )
  );
});

/**
 * Initiate coin purchase (MOCK - for now)
 * In future, this will create Razorpay order
 */
export const purchaseCoins = asyncHandler(async (req, res) => {
  const recruiter = req.recruiter;
  const { packageId } = req.body;

  if (!packageId) {
    throw new ApiError(400, "Package ID is required");
  }

  // Find the coin package
  const coinPackage = await CoinPackage.findOne({
    _id: packageId,
    category: "recruiter",
    isVisible: true,
  });

  if (!coinPackage) {
    throw new ApiError(404, "Coin package not found or not available");
  }

  // MOCK: For now, directly add coins without payment verification
  // In future, this will create Razorpay order and return order details
  const result = await addCoins(
    recruiter._id,
    "recruiter",
    coinPackage.coins,
    `Coin Purchase: ${coinPackage.name}`,
    coinPackage.price.amount,
    "purchase",
    `MOCK_ORDER_${Date.now()}`, // Mock order ID
    `MOCK_PAYMENT_${Date.now()}`, // Mock payment ID
    null,
    "success"
  );

  return res.status(200).json(
    ApiResponse.success(
      {
        transaction: result.transaction,
        balanceBefore: result.balanceBefore,
        balanceAfter: result.balanceAfter,
        coinsAdded: coinPackage.coins,
        package: {
          id: coinPackage._id.toString(),
          name: coinPackage.name,
          coins: coinPackage.coins,
          price: coinPackage.price,
        },
        // MOCK: In future, this will return Razorpay order details
        paymentDetails: {
          orderId: result.transaction.razorpayOrderId,
          status: "success",
          message: "Payment successful (MOCK MODE)",
        },
      },
      "Coins purchased successfully"
    )
  );
});

/**
 * Verify payment and complete purchase (MOCK - for now)
 * In future, this will verify Razorpay payment signature
 */
export const verifyPayment = asyncHandler(async (req, res) => {
  const recruiter = req.recruiter;
  const { orderId, paymentId, signature } = req.body;

  // MOCK: For now, just return success
  // In future, this will verify Razorpay payment signature
  // and update transaction status

  return res.status(200).json(
    ApiResponse.success(
      {
        orderId,
        paymentId,
        status: "success",
        message: "Payment verified successfully (MOCK MODE)",
      },
      "Payment verified successfully"
    )
  );
});

/**
 * Calculate coins for a custom amount
 * Returns how many coins user will get for a given INR amount
 */
export const calculateCoinsForAmount = asyncHandler(async (req, res) => {
  const { amount } = req.query;

  if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
    throw new ApiError(400, "Valid amount is required");
  }

  const amountInRupees = parseFloat(amount);

  // Get coin rules for recruiter
  const rule = await CoinRule.findOne({ category: "recruiter" });

  const baseAmount = rule?.baseAmount ?? 100;
  const baseCoins = rule?.baseCoins ?? 100;

  // Calculate coins based on ratio: (amount / baseAmount) * baseCoins
  const coinsToReceive = Math.floor((amountInRupees / baseAmount) * baseCoins);

  return res.status(200).json(
    ApiResponse.success(
      {
        amount: amountInRupees,
        currency: "INR",
        baseAmount,
        baseCoins,
        coinsToReceive,
      },
      "Coins calculated successfully"
    )
  );
});

/**
 * Get coin rate
 * Returns the current conversion rate for the user category
 */
export const getCoinsPerRupeeRate = asyncHandler(async (req, res) => {
  const rule = await CoinRule.findOne({ category: "recruiter" });

  const baseAmount = rule?.baseAmount ?? 100;
  const baseCoins = rule?.baseCoins ?? 100;

  return res.status(200).json(
    ApiResponse.success(
      {
        baseAmount,
        baseCoins,
        currency: "INR",
      },
      "Rate retrieved successfully"
    )
  );
});

/**
 * Get my referral code
 * Returns the unique referral code for the authenticated recruiter
 */
export const getMyReferralCode = asyncHandler(async (req, res) => {
  const recruiter = await Recruiter.findById(req.recruiter._id);

  // Ensure user has a referral code
  const referralCode = await ensureReferralCode(recruiter, "Recruiter");

  return res.status(200).json(
    ApiResponse.success(
      {
        referralCode,
        shareMessage: `Join Shramik and get free coins! Use my referral code: ${referralCode}`,
      },
      "Referral code retrieved successfully"
    )
  );
});

/**
 * Get referral stats
 * Returns referral statistics for the authenticated recruiter
 */
export const getReferralStats = asyncHandler(async (req, res) => {
  const recruiter = await Recruiter.findById(req.recruiter._id);

  // Get all referrals made by this user
  const referrals = await Referral.find({
    referrer: recruiter._id,
    referrerType: "Recruiter",
  })
    .populate("referee", "companyName phone")
    .sort({ createdAt: -1 })
    .lean();

  // Calculate stats
  const totalReferrals = referrals.length;
  const rewardedReferrals = referrals.filter((r) => r.status === "rewarded").length;
  const totalCoinsEarned = referrals.reduce((sum, r) => sum + (r.referrerCoinsAwarded || 0), 0);

  // Get referral settings
  const coinRule = await CoinRule.findOne({ category: "recruiter" });
  const referralSettings = coinRule?.referralSettings || {};
  const coinsPerReferral = referralSettings.referrerCoins || 50;
  const maxReferrals = referralSettings.maxReferralsPerUser || 0;

  return res.status(200).json(
    ApiResponse.success(
      {
        referralCode: recruiter.referralCode,
        totalReferrals,
        rewardedReferrals,
        totalCoinsEarned,
        coinsPerReferral,
        maxReferrals: maxReferrals === 0 ? "Unlimited" : maxReferrals,
        referrals: referrals.map((r) => ({
          id: r._id,
          refereePhone: r.referee?.phone || "Unknown",
          coinsAwarded: r.referrerCoinsAwarded,
          status: r.status,
          createdAt: r.createdAt,
        })),
      },
      "Referral stats retrieved successfully"
    )
  );
});
