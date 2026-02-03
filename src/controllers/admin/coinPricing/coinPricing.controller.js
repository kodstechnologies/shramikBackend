import { CoinPackage, CoinRule } from "../../../models/admin/coinPricing/coinPricing.model.js";
import { CoinTransaction } from "../../../models/coin/coinTransaction.model.js";
import ApiError from "../../../utils/ApiError.js";
import ApiResponse from "../../../utils/ApiResponse.js";
import { asyncHandler } from "../../../utils/asyncHandler.js";

const toDTO = (coinPackage) => ({
  id: coinPackage._id.toString(),
  name: coinPackage.name,
  coins: coinPackage.coins,
  price: {
    amount: coinPackage.price.amount,
    currency: coinPackage.price.currency,
  },
  isVisible: coinPackage.isVisible,
  createdAt: coinPackage.createdAt,
  updatedAt: coinPackage.updatedAt,
});

const mapRule = (rule) => ({
  baseAmount: rule?.baseAmount ?? 100,
  baseCoins: rule?.baseCoins ?? 100,
  coinCostPerApplication: rule?.coinCostPerApplication ?? 0,
  coinPerEmployeeCount: rule?.coinPerEmployeeCount ?? 0,
  coinCostPerJobPost: rule?.coinCostPerJobPost ?? 0,
  // Category-wise coin cost for job posting
  coinCostPerJobPostByCategory: {
    "Non-Degree Holder": rule?.coinCostPerJobPostByCategory?.["Non-Degree Holder"] ?? 0,
    "Diploma Holder": rule?.coinCostPerJobPostByCategory?.["Diploma Holder"] ?? 0,
    "ITI Holder": rule?.coinCostPerJobPostByCategory?.["ITI Holder"] ?? 0,
  },
  referralSettings: {
    isEnabled: rule?.referralSettings?.isEnabled ?? true,
    referrerCoins: rule?.referralSettings?.referrerCoins ?? 50,
    refereeRewardEnabled: rule?.referralSettings?.refereeRewardEnabled ?? true,
    refereeCoins: rule?.referralSettings?.refereeCoins ?? 20,
    maxReferralsPerUser: rule?.referralSettings?.maxReferralsPerUser ?? 0,
  },
});

const buildRuleUpdate = (body = {}) => {
  const update = {};
  if (body.baseAmount !== undefined) {
    update.baseAmount = body.baseAmount;
  }
  if (body.baseCoins !== undefined) {
    update.baseCoins = body.baseCoins;
  }
  if (body.coinCostPerApplication !== undefined) {
    update.coinCostPerApplication = body.coinCostPerApplication;
  }
  if (body.coinPerEmployeeCount !== undefined) {
    update.coinPerEmployeeCount = body.coinPerEmployeeCount;
  }
  if (body.coinCostPerJobPost !== undefined) {
    update.coinCostPerJobPost = body.coinCostPerJobPost;
  }
  // Handle referral settings
  if (body.referralSettings !== undefined) {
    update.referralSettings = {};
    if (body.referralSettings.isEnabled !== undefined) {
      update["referralSettings.isEnabled"] = body.referralSettings.isEnabled;
    }
    if (body.referralSettings.referrerCoins !== undefined) {
      update["referralSettings.referrerCoins"] = body.referralSettings.referrerCoins;
    }
    if (body.referralSettings.refereeCoins !== undefined) {
      update["referralSettings.refereeCoins"] = body.referralSettings.refereeCoins;
    }
    if (body.referralSettings.maxReferralsPerUser !== undefined) {
      update["referralSettings.maxReferralsPerUser"] = body.referralSettings.maxReferralsPerUser;
    }
    delete update.referralSettings; // Remove empty object, we use dot notation
  }
  return update;
};

export const getCoinPricing = asyncHandler(async (req, res) => {
  const { category } = req.params;

  const [packages, rule] = await Promise.all([
    CoinPackage.find({ category }).sort({ coins: 1 }),
    CoinRule.findOne({ category }),
  ]);

  res.status(200).json(
    ApiResponse.success({
      packages: packages.map(toDTO),
      rules: mapRule(rule),
    })
  );
});

export const createCoinPackage = asyncHandler(async (req, res) => {
  const { category } = req.params;
  const { name, coins, price, isVisible = true } = req.body;

  const existing = await CoinPackage.findOne({ category, name: name.trim() });
  if (existing) {
    throw new ApiError(409, "A package with this name already exists in the selected category");
  }

  const coinPackage = await CoinPackage.create({
    category,
    name: name.trim(),
    coins,
    price: { amount: price, currency: "INR" },
    isVisible,
  });

  res
    .status(201)
    .json(ApiResponse.success({ package: toDTO(coinPackage) }, "Coin package created successfully"));
});

export const updateCoinPackage = asyncHandler(async (req, res) => {
  const { category, packageId } = req.params;
  const { name, coins, price, isVisible } = req.body;

  const coinPackage = await CoinPackage.findOne({ _id: packageId, category });
  if (!coinPackage) {
    throw new ApiError(404, "Coin package not found");
  }

  if (name && name.trim() !== coinPackage.name) {
    const duplicate = await CoinPackage.findOne({ category, name: name.trim(), _id: { $ne: packageId } });
    if (duplicate) {
      throw new ApiError(409, "Another package with this name already exists");
    }
    coinPackage.name = name.trim();
  }

  if (coins !== undefined) {
    coinPackage.coins = coins;
  }

  if (price !== undefined) {
    coinPackage.price.amount = price;
  }

  if (isVisible !== undefined) {
    coinPackage.isVisible = isVisible;
  }

  await coinPackage.save();

  res
    .status(200)
    .json(ApiResponse.success({ package: toDTO(coinPackage) }, "Coin package updated successfully"));
});

export const deleteCoinPackage = asyncHandler(async (req, res) => {
  const { category, packageId } = req.params;

  const coinPackage = await CoinPackage.findOneAndDelete({ _id: packageId, category });
  if (!coinPackage) {
    throw new ApiError(404, "Coin package not found");
  }

  res.status(200).json(ApiResponse.success(null, "Coin package deleted successfully"));
});

export const updateCoinRules = asyncHandler(async (req, res) => {
  const { category } = req.params;
  const { baseAmount, baseCoins, coinCostPerApplication, coinPerEmployeeCount, coinCostPerJobPost, coinCostPerJobPostByCategory, referralSettings } = req.body;

  console.log(`[COIN_RULES_UPDATE] Category: ${category}`);
  console.log(`[COIN_RULES_UPDATE] Request Body:`, req.body);

  // Find or create the rule
  let rule = await CoinRule.findOne({ category });

  if (!rule) {
    // Create new rule if it doesn't exist
    rule = new CoinRule({ category });
    console.log(`[COIN_RULES_UPDATE] Creating new rule for category: ${category}`);
  }

  // Update fields explicitly
  if (baseAmount !== undefined) rule.baseAmount = baseAmount;
  if (baseCoins !== undefined) rule.baseCoins = baseCoins;
  if (coinCostPerApplication !== undefined) rule.coinCostPerApplication = coinCostPerApplication;
  if (coinPerEmployeeCount !== undefined) rule.coinPerEmployeeCount = coinPerEmployeeCount;
  if (coinCostPerJobPost !== undefined) rule.coinCostPerJobPost = coinCostPerJobPost;

  // Update category-wise coin cost for job posting
  if (coinCostPerJobPostByCategory !== undefined) {
    if (!rule.coinCostPerJobPostByCategory) {
      rule.coinCostPerJobPostByCategory = {};
    }
    if (coinCostPerJobPostByCategory["Non-Degree Holder"] !== undefined) {
      rule.coinCostPerJobPostByCategory["Non-Degree Holder"] = coinCostPerJobPostByCategory["Non-Degree Holder"];
    }
    if (coinCostPerJobPostByCategory["Diploma Holder"] !== undefined) {
      rule.coinCostPerJobPostByCategory["Diploma Holder"] = coinCostPerJobPostByCategory["Diploma Holder"];
    }
    if (coinCostPerJobPostByCategory["ITI Holder"] !== undefined) {
      rule.coinCostPerJobPostByCategory["ITI Holder"] = coinCostPerJobPostByCategory["ITI Holder"];
    }
  }

  // Update referral settings
  if (referralSettings !== undefined) {
    if (!rule.referralSettings) {
      rule.referralSettings = {};
    }
    if (referralSettings.isEnabled !== undefined) {
      rule.referralSettings.isEnabled = referralSettings.isEnabled;
    }
    if (referralSettings.referrerCoins !== undefined) {
      rule.referralSettings.referrerCoins = referralSettings.referrerCoins;
    }
    if (referralSettings.refereeRewardEnabled !== undefined) {
      rule.referralSettings.refereeRewardEnabled = referralSettings.refereeRewardEnabled;
    }
    if (referralSettings.refereeCoins !== undefined) {
      rule.referralSettings.refereeCoins = referralSettings.refereeCoins;
    }
    if (referralSettings.maxReferralsPerUser !== undefined) {
      rule.referralSettings.maxReferralsPerUser = referralSettings.maxReferralsPerUser;
    }
  }

  // Save the rule
  await rule.save();

  console.log(`[COIN_RULES_UPDATE] Saved Rule:`, rule.toObject());

  res
    .status(200)
    .json(ApiResponse.success({ rules: mapRule(rule) }, "Coin rules updated successfully"));
});

/**
 * Get package popularity statistics
 * Aggregates coin transactions to determine which package is most popular
 */
export const getPackagePopularity = asyncHandler(async (req, res) => {
  const { category } = req.params;

  // Map category to userType for transaction query
  const userType = category === "jobSeeker" ? "job-seeker" : "recruiter";

  console.log(`[POPULARITY] Fetching popularity for category: ${category}, userType: ${userType}`);

  // Aggregate purchase transactions to count by description
  const packageStats = await CoinTransaction.aggregate([
    {
      $match: {
        transactionType: "purchase",
        status: "success",
        userType: userType,
        $or: [
          { description: { $regex: "^Coin Purchase: " } },
          { description: { $regex: "^Purchased " } }
        ]
      }
    },
    {
      $group: {
        _id: "$description",
        purchaseCount: { $sum: 1 }
      }
    },
    { $sort: { purchaseCount: -1 } }
  ]);

  console.log(`[POPULARITY] Raw aggregation results:`, packageStats);

  // Extract package name from description
  const extractPackageName = (description) => {
    if (!description) return null;
    // "Coin Purchase: gold" -> "gold"
    if (description.startsWith("Coin Purchase: ")) {
      return description.replace("Coin Purchase: ", "").trim();
    }
    // "Purchased gold (100 coins)" -> "gold"
    if (description.startsWith("Purchased ")) {
      return description
        .replace("Purchased ", "")
        .replace(/\s*\(\d+\s*coins?\)$/i, "")
        .trim();
    }
    return description;
  };

  // Create a lookup for purchase counts by package name (case-insensitive)
  const purchaseCountByName = {};
  for (const stat of packageStats) {
    const packageName = extractPackageName(stat._id);
    if (packageName) {
      const lowerName = packageName.toLowerCase();
      // Sum up counts for the same package name (from different description formats)
      purchaseCountByName[lowerName] = (purchaseCountByName[lowerName] || 0) + stat.purchaseCount;
    }
  }

  console.log(`[POPULARITY] Purchase count by name:`, purchaseCountByName);

  // Find the most popular package
  let mostPopularPackage = null;
  let maxCount = 0;
  for (const [name, count] of Object.entries(purchaseCountByName)) {
    if (count > maxCount) {
      maxCount = count;
      mostPopularPackage = { name, purchaseCount: count };
    }
  }

  console.log(`[POPULARITY] Most popular package:`, mostPopularPackage);

  // Get all packages for this category
  const packages = await CoinPackage.find({ category }).lean();

  // Build response with purchase counts
  const packagesWithStats = packages.map(pkg => ({
    id: pkg._id.toString(),
    name: pkg.name,
    purchaseCount: purchaseCountByName[pkg.name.toLowerCase()] || 0,
    isPopular: mostPopularPackage
      ? pkg.name.toLowerCase() === mostPopularPackage.name.toLowerCase()
      : false
  }));

  console.log(`[POPULARITY] Final packages with stats:`, packagesWithStats);

  res.status(200).json(
    ApiResponse.success({
      mostPopularPackage: mostPopularPackage ? mostPopularPackage.name : null,
      packages: packagesWithStats,
      totalPurchases: Object.values(purchaseCountByName).reduce((sum, count) => sum + count, 0)
    }, "Package popularity retrieved successfully")
  );
});
