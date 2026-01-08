import { Recruiter } from "../../models/recruiter/recruiter.model.js";
import { JobSeeker } from "../../models/jobSeeker/jobSeeker.model.js";
import { State } from "../../models/location/state.model.js";
import { City } from "../../models/location/city.model.js";
import ApiError from "../../utils/ApiError.js";
import ApiResponse from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { storeOTP, verifyOTP as verifyOTPFromService } from "../../utils/otpService.js";
import { getFileUrl } from "../../middlewares/fileUpload.js";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "../../utils/jwtToken.js";
import { generateUniqueReferralCode, validateReferralCode } from "../../utils/referralCode.js";
import { Referral } from "../../models/referral/referral.model.js";
import { CoinRule } from "../../models/admin/coinPricing/coinPricing.model.js";
import { addCoins } from "../../services/coin/coinService.js";
import { createPendingReferral } from "../../services/referral/referralService.js";

/**
 * Website Types - Supported URL protocols
 */
export const WEBSITE_TYPES = [
  "https://",
  "http://",
  "www.",
  "ftp://",
  "sftp://",
  "ssh://",
  "file://",
  "mailto:",
  "tel:",
  "sms:",
  "whatsapp://",
  "skype:",
  "linkedin://",
];

/**
 * Get All Website Types (Public endpoint - no auth required)
 */
export const getWebsiteTypes = asyncHandler(async (req, res) => {
  return res.status(200).json(
    ApiResponse.success(
      { websiteTypes: WEBSITE_TYPES },
      "Website types fetched successfully"
    )
  );
});

/**
 * Send OTP for mobile verification (Recruiter)
 */
export const sendOTP = asyncHandler(async (req, res) => {
  const { phone } = req.body;

  // Cross-table validation: Check if phone exists in JobSeeker table
  const existingJobSeeker = await JobSeeker.findOne({ phone });
  if (existingJobSeeker) {
    throw new ApiError(400, "Invalid number");
  }

  // Check if recruiter already exists
  const existingRecruiter = await Recruiter.findOne({ phone });

  // Determine OTP purpose
  const purpose = existingRecruiter ? "login" : "registration";

  // Generate and store OTP
  const otp = await storeOTP(phone, purpose);

  // In production, send OTP via SMS service here
  console.log(`OTP for ${phone} (${purpose}): ${otp}`);

  const shouldReturnOTP =
    process.env.NODE_ENV === "development" ||
    process.env.RETURN_OTP_IN_RESPONSE === "true" ||
    otp === "1234";

  return res
    .status(200)
    .json(
      ApiResponse.success(
        {
          otp: shouldReturnOTP ? otp : undefined,
          isExistingUser: !!existingRecruiter,
        },
        "OTP sent successfully"
      )
    );
});

/**
 * Verify OTP (Recruiter)
 * Note: Referral code processing happens in registerRecruiter API, not here
 */
export const verifyOTP = asyncHandler(async (req, res) => {
  const { phone, otp } = req.body;

  // Cross-table validation: Check if phone exists in JobSeeker table
  const existingJobSeeker = await JobSeeker.findOne({ phone });
  if (existingJobSeeker) {
    throw new ApiError(400, "Invalid number");
  }

  // Locate recruiter to determine purpose
  let recruiter = await Recruiter.findOne({ phone }).select("+refreshToken");
  const purpose = recruiter ? "login" : "registration";
  const isNewUser = !recruiter;

  const isValid = await verifyOTPFromService(phone, otp, purpose);
  if (!isValid) {
    throw new ApiError(400, "Invalid or expired OTP");
  }

  if (isNewUser) {
    // Check if a user with this phone already exists (double check for safety)
    const existingUser = await Recruiter.findOne({ phone });
    if (existingUser) {
      throw new ApiError(400, "This phone number is already registered. Please login instead.");
    }

    // Generate unique referral code for new user
    const newUserReferralCode = await generateUniqueReferralCode("Recruiter");

    recruiter = await Recruiter.create({
      phone,
      phoneVerified: true,
      registrationStep: 1,
      role: "recruiter",
      referralCode: newUserReferralCode,
    });
  } else {
    recruiter.phoneVerified = true;
    if (recruiter.registrationStep < 1) {
      recruiter.registrationStep = 1;
    }

    // Ensure existing users have a referral code
    if (!recruiter.referralCode) {
      recruiter.referralCode = await generateUniqueReferralCode("Recruiter");
    }

    await recruiter.save();
  }

  // Generate tokens
  const accessToken = generateAccessToken({
    id: recruiter._id.toString(),
    phone: recruiter.phone,
    role: recruiter.role || "recruiter",
  });

  const refreshToken = generateRefreshToken({
    id: recruiter._id.toString(),
    phone: recruiter.phone,
  });

  recruiter.refreshToken = refreshToken;
  await recruiter.save();

  // Re-fetch to get updated coin balance
  const updatedRecruiter = await Recruiter.findById(recruiter._id).lean();

  const safeRecruiter = {
    _id: updatedRecruiter._id,
    phone: updatedRecruiter.phone,
    phoneVerified: updatedRecruiter.phoneVerified,
    registrationStep: updatedRecruiter.registrationStep,
    isRegistrationComplete: updatedRecruiter.isRegistrationComplete,
    status: updatedRecruiter.status,
    companyName: updatedRecruiter.companyName,
    role: updatedRecruiter.role,
    referralCode: updatedRecruiter.referralCode,
    coinBalance: updatedRecruiter.coinBalance || 0,
  };

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
  res.cookie("recruiterRefreshToken", refreshToken, cookieOptions);

  return res.status(200).json(
    ApiResponse.success(
      {
        accessToken,
        refreshToken,
        recruiter: safeRecruiter,
        isExistingUser: purpose === "login",
      },
      purpose === "login" ? "Login successful" : "OTP verified successfully"
    )
  );
});

/**
 * Register Recruiter (Basic registration)
 * Also processes referral code if provided
 */
export const registerRecruiter = asyncHandler(async (req, res) => {
  const {
    phone,
    recruiterId,
    name,
    contactPersonName, // Flutter field name
    companyName,
    email,
    state,
    city,
    stateName, // Flutter field name
    cityName,  // Flutter field name
    stateId,
    cityId,
    website,
    businessType,
    establishedFrom,
    establishedYear, // Flutter field name
    aboutMe,
    description, // Flutter field name
    referralCode,
  } = req.body;

  // Debug logging
  console.log("📥 registerRecruiter - req.body:", JSON.stringify(req.body, null, 2));

  // Normalize field names (Flutter sends different names)
  const normalizedName = name || contactPersonName;
  const normalizedEstablishedFrom = establishedFrom || establishedYear;
  const normalizedAboutMe = aboutMe || description;
  const normalizedState = state || stateName;
  const normalizedCity = city || cityName;

  console.log("📥 registerRecruiter - normalized fields:", {
    name: normalizedName, companyName, email,
    state: normalizedState, city: normalizedCity,
    stateId, cityId, website, businessType,
    establishedFrom: normalizedEstablishedFrom,
    aboutMe: normalizedAboutMe
  });

  const identifier = recruiterId
    ? { _id: recruiterId }
    : { phone };

  // Find recruiter
  const recruiter = await Recruiter.findOne(identifier);
  if (!recruiter) {
    throw new ApiError(404, "Recruiter not found. Please verify OTP first.");
  }
  if (!recruiter.phoneVerified) {
    throw new ApiError(400, "Please verify your phone number first");
  }

  // Check if user is already fully registered - prevent re-registration
  if (recruiter.isRegistrationComplete) {
    throw new ApiError(400, "You are already registered. Please login instead or update your profile through the profile settings.");
  }

  // Cross-table validation: Check if phone exists in JobSeeker table
  const existingJobSeeker = await JobSeeker.findOne({ phone: recruiter.phone });
  if (existingJobSeeker) {
    throw new ApiError(
      400,
      "This phone number is already registered as a job seeker. Please use the job seeker login portal or use a different phone number."
    );
  }

  // Handle file uploads
  const companyLogo = req.files?.companyLogo?.[0]
    ? getFileUrl(req.files.companyLogo[0])
    : null;
  const documents = req.files?.documents
    ? req.files.documents.map((file) => getFileUrl(file))
    : [];

  // Update recruiter basic info - use normalized values
  if (normalizedName !== undefined) {
    recruiter.name = normalizedName?.trim() || null;
  }
  recruiter.companyName = companyName || recruiter.companyName;
  recruiter.email = email || recruiter.email;

  // Update location (support both names and IDs)
  if (stateId || cityId) {
    if (stateId) {
      const stateDoc = await State.findById(stateId);
      if (!stateDoc) {
        throw new ApiError(404, "State not found");
      }
      recruiter.state = stateDoc.name;
    }
    if (cityId) {
      const cityDoc = await City.findById(cityId);
      if (!cityDoc) {
        throw new ApiError(404, "City not found");
      }
      recruiter.city = cityDoc.name;

      // Verify city belongs to state if both are provided
      if (stateId && cityDoc.stateId.toString() !== stateId) {
        throw new ApiError(400, "City does not belong to the selected state");
      }
    }
  } else {
    // Fallback to plain names (use normalized values)
    recruiter.state = normalizedState || recruiter.state;
    recruiter.city = normalizedCity || recruiter.city;
  }

  // Update additional business info
  if (website !== undefined) {
    recruiter.website = website?.trim() || null;
  }
  if (businessType !== undefined) {
    recruiter.businessType = businessType?.trim() || null;
  }
  // Use normalized establishedFrom (supports both establishedFrom and establishedYear)
  if (normalizedEstablishedFrom !== undefined) {
    recruiter.establishedFrom = normalizedEstablishedFrom ? Number(normalizedEstablishedFrom) : null;
  }
  // Use normalized aboutMe (supports both aboutMe and description)
  if (normalizedAboutMe !== undefined) {
    recruiter.aboutMe = normalizedAboutMe?.trim() || null;
  }

  if (companyLogo) {
    recruiter.companyLogo = companyLogo;
    recruiter.profilePhoto = companyLogo;
  }
  if (documents.length > 0) {
    recruiter.documents = documents;
  }
  recruiter.registrationStep = 2;
  recruiter.isRegistrationComplete = true;
  recruiter.status = "Pending";

  await recruiter.save();

  // Process referral code if provided and not already referred
  // Creates a pending referral - coins will be awarded when recruiter posts a job
  let referralInfo = null;
  if (referralCode && !recruiter.referredBy) {
    try {
      const validation = await validateReferralCode(referralCode);
      if (validation.isValid) {
        const referrerUser = validation.referrer;
        const referrerType = validation.referrerType;

        // Create pending referral (coins awarded on first job post)
        const pendingReferral = await createPendingReferral({
          referrerId: referrerUser._id,
          referrerType: referrerType,
          refereeId: recruiter._id,
          refereeType: "Recruiter",
          referralCode: referralCode
        });

        if (pendingReferral) {
          // Update recruiter's referredBy
          recruiter.referredBy = referrerUser._id;
          await recruiter.save();

          referralInfo = {
            referredBy: referrerUser._id,
            referrerType,
            status: "pending",
            message: "Referral registered. Coins will be awarded when you post your first job."
          };
        }
      }
    } catch (refErr) {
      console.error("❌ REFERRAL ERROR:", refErr.message);
      console.error("❌ Stack:", refErr.stack);
    }
  }

  return res.status(200).json(
    ApiResponse.success(
      { recruiter, referral: referralInfo },
      "Registration completed successfully"
    )
  );
});

/**
 * Get Recruiter by Phone
 */
export const getRecruiterByPhone = asyncHandler(async (req, res) => {
  const { phone } = req.params;

  const recruiter = await Recruiter.findOne({ phone }).lean();

  if (!recruiter) {
    throw new ApiError(404, "Recruiter not found");
  }

  return res
    .status(200)
    .json(
      ApiResponse.success(
        { recruiter },
        "Recruiter fetched successfully"
      )
    );
});

/**
 * Refresh recruiter access token
 */
export const refreshRecruiterAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.body.refreshToken || req.cookies?.recruiterRefreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, "Refresh token is required");
  }

  let decodedToken;
  try {
    decodedToken = verifyRefreshToken(incomingRefreshToken);
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      throw new ApiError(401, "Refresh token expired. Please login again.");
    } else if (error.name === "JsonWebTokenError") {
      throw new ApiError(401, "Invalid refresh token");
    }
    throw new ApiError(401, "Token verification failed");
  }

  if (decodedToken.type !== "refresh") {
    throw new ApiError(401, "Invalid token type. Expected refresh token.");
  }

  const recruiter = await Recruiter.findById(decodedToken.id).select("+refreshToken");
  if (!recruiter) {
    throw new ApiError(401, "Invalid refresh token: Recruiter not found");
  }

  if (recruiter.refreshToken !== incomingRefreshToken) {
    recruiter.refreshToken = null;
    await recruiter.save();
    throw new ApiError(401, "Refresh token mismatch. Please login again.");
  }

  if (recruiter.status === "Inactive" || recruiter.status === "Rejected") {
    throw new ApiError(403, "Account is inactive. Please contact support.");
  }

  const newAccessToken = generateAccessToken({
    id: recruiter._id.toString(),
    phone: recruiter.phone,
    role: recruiter.role || "recruiter",
  });

  const newRefreshToken = generateRefreshToken({
    id: recruiter._id.toString(),
    phone: recruiter.phone,
  });

  recruiter.refreshToken = newRefreshToken;
  await recruiter.save();

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
  res.cookie("recruiterRefreshToken", newRefreshToken, cookieOptions);

  return res.status(200).json(
    ApiResponse.success(
      {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      },
      "Access token refreshed successfully"
    )
  );
});

/**
 * Logout recruiter
 */
export const logoutRecruiter = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.body.refreshToken || req.cookies?.recruiterRefreshToken;

  if (incomingRefreshToken) {
    const recruiter = await Recruiter.findOne({
      refreshToken: incomingRefreshToken,
    }).select("+refreshToken");

    if (recruiter) {
      recruiter.refreshToken = null;
      await recruiter.save();
    }
  }

  res.clearCookie("recruiterRefreshToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });

  return res
    .status(200)
    .json(ApiResponse.success(null, "Logout successful"));
});

/**
 * Get Recruiter Profile
 * Returns the authenticated recruiter's complete profile information
 * 
 * @route GET /api/recruiters/profile
 * @requires Authentication (JWT token)
 */
export const getRecruiterProfile = asyncHandler(async (req, res) => {
  const recruiter = req.recruiter; // From auth middleware

  // Fetch full recruiter profile
  const profile = await Recruiter.findById(recruiter._id).lean();

  if (!profile) {
    throw new ApiError(404, "Recruiter profile not found");
  }

  // Format response
  const formattedProfile = {
    _id: profile._id,
    phone: profile.phone,
    phoneVerified: profile.phoneVerified,
    name: profile.name,
    companyName: profile.companyName,
    email: profile.email,
    website: profile.website,
    businessType: profile.businessType,
    establishedFrom: profile.establishedFrom,
    // Location
    state: profile.state,
    city: profile.city,
    // Documents
    profilePhoto: profile.profilePhoto,
    companyLogo: profile.companyLogo,
    documents: profile.documents || [],
    // About Me
    aboutMe: profile.aboutMe || null,
    // Registration Status
    registrationStep: profile.registrationStep,
    isRegistrationComplete: profile.isRegistrationComplete,
    // Status
    status: profile.status,
    // Coin Balance
    coinBalance: profile.coinBalance || 0,
    // Role
    role: profile.role,
    // Timestamps
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };

  return res.status(200).json(
    ApiResponse.success(
      { profile: formattedProfile },
      "Recruiter profile retrieved successfully"
    )
  );
});

/**
 * Update Recruiter Profile
 * Allows authenticated recruiter to update their profile information
 * 
 * @route PUT /api/recruiters/profile
 * @requires Authentication (JWT token)
 */
export const updateRecruiterProfile = asyncHandler(async (req, res) => {
  const recruiter = req.recruiter; // From auth middleware
  const {
    name,
    companyName,
    email,
    state,
    city,
    stateId,
    cityId,
    website,
    businessType,
    establishedFrom,
    aboutMe,
  } = req.body;

  // Find the recruiter
  const profile = await Recruiter.findById(recruiter._id);
  if (!profile) {
    throw new ApiError(404, "Recruiter profile not found");
  }

  // Update basic information
  if (name !== undefined) {
    profile.name = name?.trim() || null;
  }
  if (companyName !== undefined) {
    profile.companyName = companyName?.trim() || null;
  }
  if (email !== undefined) {
    profile.email = email?.trim().toLowerCase() || null;
  }
  // Update location (support both names and IDs)
  if (stateId || cityId) {
    if (stateId) {
      const stateDoc = await State.findById(stateId);
      if (!stateDoc) {
        throw new ApiError(404, "State not found");
      }
      profile.state = stateDoc.name;
    }
    if (cityId) {
      const cityDoc = await City.findById(cityId);
      if (!cityDoc) {
        throw new ApiError(404, "City not found");
      }
      profile.city = cityDoc.name;

      // Verify city belongs to state if both are provided
      if (stateId && cityDoc.stateId.toString() !== stateId) {
        throw new ApiError(400, "City does not belong to the selected state");
      }
    }
  } else {
    if (state !== undefined) {
      profile.state = state?.trim() || null;
    }
    if (city !== undefined) {
      profile.city = city?.trim() || null;
    }
  }
  if (website !== undefined) {
    profile.website = website?.trim() || null;
  }
  if (businessType !== undefined) {
    profile.businessType = businessType?.trim() || null;
  }
  if (establishedFrom !== undefined) {
    // If empty string, set to null; else cast to number
    profile.establishedFrom =
      establishedFrom === "" || establishedFrom === null
        ? null
        : Number(establishedFrom);
  }
  if (aboutMe !== undefined) {
    profile.aboutMe = aboutMe?.trim() || null;
  }

  // Handle file uploads
  if (req.files?.companyLogo?.[0]) {
    profile.companyLogo = getFileUrl(req.files.companyLogo[0]);
    // Also update profilePhoto for backward compatibility
    profile.profilePhoto = profile.companyLogo;
  }
  if (req.files?.documents) {
    const documentUrls = req.files.documents.map((file) => getFileUrl(file));
    profile.documents = documentUrls;
  }

  await profile.save();

  // Format response
  const formattedProfile = {
    _id: profile._id,
    phone: profile.phone,
    phoneVerified: profile.phoneVerified,
    name: profile.name,
    companyName: profile.companyName,
    email: profile.email,
    website: profile.website,
    businessType: profile.businessType,
    establishedFrom: profile.establishedFrom,
    state: profile.state,
    city: profile.city,
    profilePhoto: profile.profilePhoto,
    companyLogo: profile.companyLogo,
    documents: profile.documents || [],
    aboutMe: profile.aboutMe || null,
    registrationStep: profile.registrationStep,
    isRegistrationComplete: profile.isRegistrationComplete,
    status: profile.status,
    coinBalance: profile.coinBalance || 0,
    role: profile.role,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };

  return res.status(200).json(
    ApiResponse.success(
      { profile: formattedProfile },
      "Profile updated successfully"
    )
  );
});

