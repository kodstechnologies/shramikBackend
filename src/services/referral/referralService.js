import { Referral } from "../../models/referral/referral.model.js";
import { CoinRule } from "../../models/admin/coinPricing/coinPricing.model.js";
import { JobSeeker } from "../../models/jobSeeker/jobSeeker.model.js";
import { Recruiter } from "../../models/recruiter/recruiter.model.js";
import { addCoins } from "../coin/coinService.js";

/**
 * Process referral reward when a referred user takes their first action
 * - For JobSeeker: First job application
 * - For Recruiter: First job post
 * 
 * @param {ObjectId} userId - The user who took the action (referee)
 * @param {string} userType - "JobSeeker" or "Recruiter"
 * @param {string} actionType - "job_application" or "job_post"
 * @returns {Object|null} - Referral info if coins were awarded, null otherwise
 */
export const processReferralReward = async (userId, userType, actionType) => {
    try {
        console.log("🎁 ═══════════════════════════════════════════════════");
        console.log(`🎁 REFERRAL REWARD CHECK - ${actionType}`);
        console.log("🎁 ═══════════════════════════════════════════════════");
        console.log("🎁 User ID:", userId);
        console.log("🎁 User Type:", userType);

        // Find pending referral for this user
        const pendingReferral = await Referral.findOne({
            referee: userId,
            refereeType: userType,
            status: "pending"
        });

        if (!pendingReferral) {
            console.log("🎁 No pending referral found for this user");
            console.log("🎁 ═══════════════════════════════════════════════════");
            return null;
        }

        console.log("🎁 Found pending referral:", pendingReferral._id);
        console.log("🎁 Referrer:", pendingReferral.referrer, `(${pendingReferral.referrerType})`);

        // Get referral settings based on referee type
        const category = userType === "Recruiter" ? "recruiter" : "jobSeeker";
        console.log("🎁 Looking for CoinRule with category:", category);
        const coinRule = await CoinRule.findOne({ category });
        console.log("🎁 CoinRule found:", coinRule ? "YES" : "NO");
        console.log("🎁 CoinRule referralSettings:", JSON.stringify(coinRule?.referralSettings, null, 2));

        const referralSettings = coinRule?.referralSettings || {};
        const isReferralEnabled = referralSettings.isEnabled !== false;
        const referrerCoins = referralSettings.referrerCoins || 50;
        // Referee coins: use configured value, or default to 50% of referrer coins
        const refereeRewardEnabled = referralSettings.refereeRewardEnabled !== false;
        const refereeCoins = referralSettings.refereeCoins ?? Math.floor(referrerCoins / 2);
        const maxReferrals = referralSettings.maxReferralsPerUser || 0;

        console.log("🎁 isReferralEnabled:", isReferralEnabled);
        console.log("🎁 referrerCoins:", referrerCoins);
        console.log("🎁 refereeRewardEnabled:", refereeRewardEnabled);
        console.log("🎁 refereeCoins:", refereeCoins);

        if (!isReferralEnabled) {
            console.log("🎁 ⚠️ Referral system is disabled");
            console.log("🎁 ═══════════════════════════════════════════════════");
            return null;
        }

        // Check referrer's current referral count
        const referrerModel = pendingReferral.referrerType === "Recruiter" ? Recruiter : JobSeeker;
        const referrerDoc = await referrerModel.findById(pendingReferral.referrer);

        if (!referrerDoc) {
            console.log("🎁 ❌ Referrer not found");
            pendingReferral.status = "failed";
            pendingReferral.note = "Referrer account not found";
            await pendingReferral.save();
            console.log("🎁 ═══════════════════════════════════════════════════");
            return null;
        }

        const currentReferrals = referrerDoc.totalReferrals || 0;
        const canReward = maxReferrals === 0 || currentReferrals < maxReferrals;

        console.log("🎁 Referrer Phone:", referrerDoc.phone);
        console.log("🎁 Coins to Award:", referrerCoins);
        console.log("🎁 Referee Reward Enabled:", refereeRewardEnabled);
        console.log("🎁 Referee Coins:", refereeCoins);
        console.log("🎁 Current Referrals:", currentReferrals, "| Max:", maxReferrals === 0 ? "Unlimited" : maxReferrals);
        console.log("🎁 Can Reward:", canReward);

        if (!canReward) {
            console.log("🎁 ⚠️ Referral limit reached, no coins awarded");
            pendingReferral.status = "failed";
            pendingReferral.note = "Referrer has reached maximum referral limit";
            await pendingReferral.save();
            console.log("🎁 ═══════════════════════════════════════════════════");
            return null;
        }

        // Award coins to referrer
        const userTypeForCoins = pendingReferral.referrerType === "Recruiter" ? "recruiter" : "job-seeker";
        console.log("🎁 Calling addCoins with userType:", userTypeForCoins);

        const coinResult = await addCoins(
            pendingReferral.referrer,
            userTypeForCoins,
            referrerCoins,
            `Referral reward: Your referred user completed their first ${actionType === "job_application" ? "job application" : "job post"}`,
            0,
            "referral"
        );
        console.log("🎁 addCoins result for referrer:", JSON.stringify(coinResult, null, 2));

        // Award coins to referee (the new user who signed up with referral code)
        // Only award if referee reward is enabled
        let actualRefereeCoins = 0;
        if (refereeRewardEnabled && refereeCoins > 0) {
            actualRefereeCoins = refereeCoins;
            const refereeUserType = userType === "Recruiter" ? "recruiter" : "job-seeker";
            console.log("🎁 Awarding", refereeCoins, "coins to referee (new user)");
            const refereeCoinResult = await addCoins(
                userId,
                refereeUserType,
                refereeCoins,
                "Welcome bonus: Reward for signing up with a referral code",
                0,
                "referral"
            );
            console.log("🎁 addCoins result for referee:", JSON.stringify(refereeCoinResult, null, 2));
        } else if (!refereeRewardEnabled) {
            console.log("🎁 ⚠️ Referee reward is disabled, skipping referee coins");
        }

        // Update referrer's total referrals count
        await referrerModel.findByIdAndUpdate(pendingReferral.referrer, {
            $inc: { totalReferrals: 1 }
        });
        console.log("🎁 Updated totalReferrals for referrer");

        // Update referral status to rewarded
        pendingReferral.status = "rewarded";
        pendingReferral.referrerCoinsAwarded = referrerCoins;
        pendingReferral.refereeCoinsAwarded = actualRefereeCoins;
        pendingReferral.note = `Coins awarded on ${actionType}`;
        await pendingReferral.save();
        console.log("🎁 Updated referral status to 'rewarded'");

        console.log("🎁 ✅ REFERRAL SUCCESS! Referrer awarded:", referrerCoins, "| Referee awarded:", actualRefereeCoins);
        console.log("🎁 ═══════════════════════════════════════════════════");

        return {
            referredBy: pendingReferral.referrer,
            referrerType: pendingReferral.referrerType,
            referrerCoinsAwarded: referrerCoins,
            refereeCoinsAwarded: actualRefereeCoins,
            actionType
        };
    } catch (error) {
        console.error("❌ REFERRAL REWARD ERROR:", error.message);
        console.error("❌ Stack:", error.stack);
        return null;
    }
};

/**
 * Create a pending referral record during registration
 * Coins will be awarded later when the user takes an action
 * 
 * @param {Object} params
 * @param {ObjectId} params.referrerId - The referrer's user ID
 * @param {string} params.referrerType - "JobSeeker" or "Recruiter"
 * @param {ObjectId} params.refereeId - The new user's ID
 * @param {string} params.refereeType - "JobSeeker" or "Recruiter"
 * @param {string} params.referralCode - The referral code used
 * @returns {Object|null} - Referral record if created, null otherwise
 */
export const createPendingReferral = async ({
    referrerId,
    referrerType,
    refereeId,
    refereeType,
    referralCode
}) => {
    try {
        console.log("🎁 ═══════════════════════════════════════════════════");
        console.log("🎁 CREATING PENDING REFERRAL");
        console.log("🎁 ═══════════════════════════════════════════════════");
        console.log("🎁 Referrer:", referrerId, `(${referrerType})`);
        console.log("🎁 Referee:", refereeId, `(${refereeType})`);
        console.log("🎁 Referral Code:", referralCode);

        // Check if referral already exists
        const existingReferral = await Referral.findOne({
            referee: refereeId,
            refereeType: refereeType
        });

        if (existingReferral) {
            console.log("🎁 ⚠️ Referral already exists for this user");
            console.log("🎁 ═══════════════════════════════════════════════════");
            return null;
        }

        // Create pending referral (coins will be awarded on first action)
        const referral = await Referral.create({
            referrer: referrerId,
            referrerType: referrerType,
            referee: refereeId,
            refereeType: refereeType,
            referralCode: referralCode.toUpperCase(),
            status: "pending", // Will become "rewarded" when user takes action
            referrerCoinsAwarded: 0, // Will be filled when rewarded
            refereeCoinsAwarded: 0,
            note: "Awaiting first action (job application or job post)"
        });

        console.log("🎁 Pending referral created:", referral._id);
        console.log("🎁 Coins will be awarded when user applies for a job or posts a job");
        console.log("🎁 ═══════════════════════════════════════════════════");

        return referral;
    } catch (error) {
        console.error("❌ CREATE PENDING REFERRAL ERROR:", error.message);
        console.error("❌ Stack:", error.stack);
        return null;
    }
};
