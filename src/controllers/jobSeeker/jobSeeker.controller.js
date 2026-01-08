import mongoose from "mongoose";
import { JobSeeker } from "../../models/jobSeeker/jobSeeker.model.js";
import { Recruiter } from "../../models/recruiter/recruiter.model.js";
import { Specialization } from "../../models/admin/specialization/specialization.model.js";
import { QuestionSet } from "../../models/admin/questionSet/questionSet.model.js";
import { Category } from "../../models/category/category.model.js";
import { State } from "../../models/location/state.model.js";
import { City } from "../../models/location/city.model.js";
import ApiError from "../../utils/ApiError.js";
import ApiResponse from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { storeOTP, verifyOTP as verifyOTPFromService } from "../../utils/otpService.js";
import { getFileUrl } from "../../middlewares/fileUpload.js";
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from "../../utils/jwtToken.js";
import { generateUniqueReferralCode, validateReferralCode } from "../../utils/referralCode.js";
import { Referral } from "../../models/referral/referral.model.js";
import { CoinRule } from "../../models/admin/coinPricing/coinPricing.model.js";
import { addCoins } from "../../services/coin/coinService.js";
import { createPendingReferral } from "../../services/referral/referralService.js";

/**
 * Send OTP for mobile verification
 * Supports both Registration and Login flows:
 * - Registration: User doesn't exist, category provided
 * - Login: User exists, no category needed
 */


function normalizeSkills(input) {
  let raw = input;

  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = raw.replace(/^\[|\]$/g, "").split(",");
    }
  }

  // If it's not an array at this point, wrap it
  if (!Array.isArray(raw)) {
    raw = [raw];
  }

  let merged = [];
  let buffer = "";

  for (let part of raw) {
    // Clean brackets from each part BEFORE processing
    part = String(part).replace(/^\[+/, "").replace(/\]+$/, "").trim();

    if (part.includes("(") && !part.includes(")")) {
      buffer = part;
    } else if (buffer) {
      buffer += ", " + part;
      if (part.includes(")")) {
        merged.push(buffer.trim());
        buffer = "";
      }
    } else if (part) {  // Only add non-empty parts
      merged.push(part);
    }
  }

  // Final cleanup - remove any remaining brackets and trim
  return merged.map(s => s.replace(/^\[+/, "").replace(/\]+$/, "").trim()).filter(s => s.length > 0);
}

export const sendOTP = asyncHandler(async (req, res) => {
  const { phone, category } = req.body;

  // Cross-table validation: Check if phone exists in Recruiter table
  const existingRecruiter = await Recruiter.findOne({ phone });
  if (existingRecruiter) {
    throw new ApiError(400, "Invalid number");
  }

  // Check if job seeker already exists
  const existingJobSeeker = await JobSeeker.findOne({ phone });

  // Determine purpose: "login" if user exists, "registration" if new user
  const purpose = existingJobSeeker ? "login" : "registration";

  // For registration, category is optional (can be sent in verify-otp)
  // For login, category is not needed
  if (existingJobSeeker && category) {
    // User exists but category provided - might be trying to change category
    // This is allowed, will be handled in verify-otp
  }

  // Generate and store OTP
  const otp = await storeOTP(phone, purpose);

  // In production, send OTP via SMS service here
  // For now, we'll return it in response for testing
  console.log(`OTP for ${phone} (${purpose}): ${otp}`);

  // Return OTP if:
  // 1. Development mode, OR
  // 2. RETURN_OTP_IN_RESPONSE env variable is set to true, OR
  // 3. OTP is "1234" (testing mode)
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
          isExistingUser: !!existingJobSeeker // Indicate if user exists (for frontend logic)
        },
        "OTP sent successfully"
      )
    );
});

/**
 * Verify OTP
 * Smart verification:
 * - If user exists: Login flow (category optional, can update if provided)
 * - If user doesn't exist: Registration flow (category required)
 * Note: Referral code processing happens in registration APIs, not here
 */
export const verifyOTP = asyncHandler(async (req, res) => {
  const { phone, otp, category } = req.body;

  // Cross-table validation: Check if phone exists in Recruiter table
  const existingRecruiter = await Recruiter.findOne({ phone });
  if (existingRecruiter) {
    throw new ApiError(400, "Invalid number");
  }

  // Check if user exists to determine OTP purpose
  let jobSeeker = await JobSeeker.findOne({ phone });
  const purpose = jobSeeker ? "login" : "registration";
  const isNewUser = !jobSeeker;

  // Verify OTP with correct purpose
  const isValid = await verifyOTPFromService(phone, otp, purpose);
  if (!isValid) {
    throw new ApiError(400, "Invalid or expired OTP");
  }

  if (isNewUser) {
    // New user - Registration flow: category is REQUIRED
    if (!category) {
      throw new ApiError(400, "Category is required for new user registration");
    }

    // Check if a user with this phone already exists (double check for safety)
    const existingUser = await JobSeeker.findOne({ phone });
    if (existingUser) {
      throw new ApiError(400, "This phone number is already registered. Please login instead.");
    }

    // Generate unique referral code for new user
    const newUserReferralCode = await generateUniqueReferralCode("JobSeeker");

    jobSeeker = await JobSeeker.create({
      phone,
      phoneVerified: true,
      category,
      registrationStep: 1,
      referralCode: newUserReferralCode,
    });
  } else {
    // Existing user - Login flow: category is optional
    // If category provided, update it (user might be changing category)
    // If not provided, keep existing category
    jobSeeker.phoneVerified = true;

    if (category) {
      jobSeeker.category = category;
      // Reset registration step if category changed
      if (jobSeeker.registrationStep > 1) {
        jobSeeker.registrationStep = 1;
      }
    }

    // Ensure existing users have a referral code
    if (!jobSeeker.referralCode) {
      jobSeeker.referralCode = await generateUniqueReferralCode("JobSeeker");
    }

    await jobSeeker.save();
  }

  // Generate JWT tokens
  const accessToken = generateAccessToken({
    id: jobSeeker._id.toString(),
    phone: jobSeeker.phone,
    role: jobSeeker.role || "job-seeker",
  });

  const refreshToken = generateRefreshToken({
    id: jobSeeker._id.toString(),
    phone: jobSeeker.phone,
  });

  // Save refresh token to database
  jobSeeker.refreshToken = refreshToken;
  await jobSeeker.save({ select: "+refreshToken" }); // Include refreshToken field

  // Re-fetch to get updated coin balance
  const updatedJobSeeker = await JobSeeker.findById(jobSeeker._id).lean();

  // Prepare safe job seeker data (exclude sensitive fields)
  const safeJobSeeker = {
    _id: updatedJobSeeker._id,
    phone: updatedJobSeeker.phone,
    phoneVerified: updatedJobSeeker.phoneVerified,
    category: updatedJobSeeker.category,
    role: updatedJobSeeker.role,
    registrationStep: updatedJobSeeker.registrationStep,
    isRegistrationComplete: updatedJobSeeker.isRegistrationComplete,
    status: updatedJobSeeker.status,
    referralCode: updatedJobSeeker.referralCode,
    coinBalance: updatedJobSeeker.coinBalance || 0,
  };

  // Set refresh token as HTTP-only cookie (optional, for web apps)
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  };
  res.cookie("refreshToken", refreshToken, cookieOptions);

  return res
    .status(200)
    .json(
      ApiResponse.success(
        {
          accessToken,
          refreshToken, // Also return in response for mobile apps
          jobSeeker: safeJobSeeker,
        },
        purpose === "login" ? "Login successful" : "OTP verified successfully"
      )
    );
});

/**
 * Register Non-Degree Holder (Complete registration in one step)
 * Supports both state/city names and stateId/cityId from dropdowns
 */
export const registerNonDegree = asyncHandler(async (req, res) => {
  const { phone, name, email, gender, dateOfBirth, state, city, stateId, cityId, specializationId, selectedSkills, referralCode } = req.body;

  // ✅ NORMALIZE selectedSkills (FIX FLUTTER FORM-DATA BUG)
  let finalSelectedSkills = normalizeSkills(selectedSkills);


  finalSelectedSkills = finalSelectedSkills.map(skill =>
    String(skill).replace(/^\[/, "").replace(/\]$/, "").trim()
  );

  // Cross-table validation
  const existingRecruiter = await Recruiter.findOne({ phone });
  if (existingRecruiter) throw new ApiError(400, "Invalid number");

  let jobSeeker = await JobSeeker.findOne({ phone });
  if (!jobSeeker || !jobSeeker.phoneVerified) {
    throw new ApiError(400, "Please verify your phone number first");
  }

  // Check if user is already fully registered - prevent re-registration
  if (jobSeeker.isRegistrationComplete) {
    throw new ApiError(400, "You are already registered. Please login instead or update your profile through the profile settings.");
  }

  if (jobSeeker.category !== "Non-Degree Holder") {
    throw new ApiError(400, "Invalid category for this registration");
  }

  const specialization = await Specialization.findById(specializationId);
  if (!specialization) throw new ApiError(404, "Specialization not found");

  const specializationSkills = specialization.skills || [];
  const normalizedSpecializationSkills = specializationSkills.map(skill =>
    String(skill).trim().toLowerCase()
  );

  // Debug logging for skill validation
  console.log("=== Non-Degree Skill Validation Debug ===");
  console.log("Raw selectedSkills from request:", selectedSkills);
  console.log("Normalized finalSelectedSkills:", finalSelectedSkills);
  console.log("Specialization skills (raw):", specializationSkills);
  console.log("Normalized specialization skills:", normalizedSpecializationSkills);

  // Log each skill comparison
  finalSelectedSkills.forEach(skill => {
    const normalizedSkill = String(skill).trim().toLowerCase();
    const isValid = normalizedSpecializationSkills.includes(normalizedSkill);
    console.log(`Skill "${skill}" -> normalized: "${normalizedSkill}" -> valid: ${isValid}`);
  });

  const invalidSkills = finalSelectedSkills.filter(skill =>
    !normalizedSpecializationSkills.includes(String(skill).trim().toLowerCase())
  );

  if (invalidSkills.length > 0) {
    // Debug: Log available skills for troubleshooting
    console.log("Available skills in specialization:", specializationSkills);
    console.log("Selected skills:", finalSelectedSkills);
    console.log("Invalid skills:", invalidSkills);

    throw new ApiError(
      400,
      `Invalid skills: [${invalidSkills.join(", ")}]. Skills must belong to the selected specialization. Available skills: ${specializationSkills.join(", ")}`
    );
  }

  let stateName = state;
  let cityName = city;

  if (stateId && !stateName) {
    const stateDoc = await State.findById(stateId);
    if (!stateDoc) throw new ApiError(404, "State not found");
    stateName = stateDoc.name;
  }

  if (cityId && !cityName) {
    const cityDoc = await City.findById(cityId);
    if (!cityDoc) throw new ApiError(404, "City not found");
    cityName = cityDoc.name;

    if (stateId && cityDoc.stateId.toString() !== stateId) {
      throw new ApiError(400, "City does not belong to the selected state");
    }
  }

  if (!stateName || !cityName) throw new ApiError(400, "State and city are required");

  const aadhaarCard = req.files?.aadhaarCard?.[0]
    ? getFileUrl(req.files.aadhaarCard[0])
    : null;

  const profilePhoto = req.files?.profilePhoto?.[0]
    ? getFileUrl(req.files.profilePhoto[0])
    : null;

  if (!aadhaarCard) throw new ApiError(400, "Aadhaar card is required");
  if (!profilePhoto) throw new ApiError(400, "Profile photo is required");

  jobSeeker.name = name;
  jobSeeker.email = email;
  jobSeeker.gender = gender?.toLowerCase().trim();
  jobSeeker.dateOfBirth = new Date(dateOfBirth);
  jobSeeker.state = stateName;
  jobSeeker.city = cityName;
  jobSeeker.specializationId = specializationId;
  jobSeeker.selectedSkills = finalSelectedSkills;
  jobSeeker.aadhaarCard = aadhaarCard;
  jobSeeker.profilePhoto = profilePhoto;
  jobSeeker.registrationStep = 4;
  jobSeeker.isRegistrationComplete = true;
  jobSeeker.status = "Active";

  await jobSeeker.save();

  // Process referral code if provided and not already referred
  // Creates a pending referral - coins will be awarded when user applies for a job
  let referralInfo = null;
  if (referralCode && !jobSeeker.referredBy) {
    try {
      const validation = await validateReferralCode(referralCode);
      if (validation.isValid) {
        const referrerUser = validation.referrer;
        const referrerType = validation.referrerType;

        // Create pending referral (coins awarded on first job application)
        const pendingReferral = await createPendingReferral({
          referrerId: referrerUser._id,
          referrerType: referrerType,
          refereeId: jobSeeker._id,
          refereeType: "JobSeeker",
          referralCode: referralCode
        });

        if (pendingReferral) {
          // Update job seeker's referredBy
          jobSeeker.referredBy = referrerUser._id;
          await jobSeeker.save();

          referralInfo = {
            referredBy: referrerUser._id,
            referrerType,
            status: "pending",
            message: "Referral registered. Coins will be awarded when you apply for your first job."
          };
        }
      }
    } catch (refErr) {
      console.error("❌ REFERRAL ERROR:", refErr.message);
      console.error("❌ Stack:", refErr.stack);
    }
  }

  return res.status(200).json(
    ApiResponse.success({ jobSeeker, referral: referralInfo }, "Registration completed successfully")
  );
});



/**
 * Step 1 Registration (Diploma/ITI Holder) - Upload Aadhaar and Profile Photo
 * Also processes referral code if provided
 * Supports stateId/cityId for location
 */
export const step1Registration = asyncHandler(async (req, res) => {
  const { phone, name, email, gender, dateOfBirth, stateId, cityId, referralCode } = req.body;

  // Cross-table validation: Check if phone exists in Recruiter table
  const existingRecruiter = await Recruiter.findOne({ phone });
  if (existingRecruiter) {
    throw new ApiError(400, "Invalid number");
  }

  // Find job seeker
  let jobSeeker = await JobSeeker.findOne({ phone });
  if (!jobSeeker || !jobSeeker.phoneVerified) {
    throw new ApiError(400, "Please verify your phone number first");
  }

  // Check if user is already fully registered - prevent re-registration
  if (jobSeeker.isRegistrationComplete) {
    throw new ApiError(400, "You are already registered. Please login instead or update your profile through the profile settings.");
  }

  if (
    jobSeeker.category !== "Diploma Holder" &&
    jobSeeker.category !== "ITI Holder"
  ) {
    throw new ApiError(400, "Invalid category for this registration step");
  }

  // Resolve state and city names from IDs
  let stateName = null;
  let cityName = null;

  console.log("📍 step1Registration - stateId:", stateId, "cityId:", cityId);

  if (stateId) {
    const stateDoc = await State.findById(stateId);
    console.log("📍 State document found:", stateDoc ? stateDoc.name : "NOT FOUND");
    if (!stateDoc) {
      throw new ApiError(404, "State not found");
    }
    stateName = stateDoc.name;
  }

  if (cityId) {
    const cityDoc = await City.findById(cityId);
    console.log("📍 City document found:", cityDoc ? cityDoc.name : "NOT FOUND");
    if (!cityDoc) {
      throw new ApiError(404, "City not found");
    }
    cityName = cityDoc.name;

    // Verify city belongs to the selected state
    if (stateId && cityDoc.stateId.toString() !== stateId) {
      throw new ApiError(400, "City does not belong to the selected state");
    }
  }

  console.log("📍 Resolved State:", stateName, "| City:", cityName);

  // Handle file uploads
  const aadhaarCard = req.files?.aadhaarCard?.[0]
    ? getFileUrl(req.files.aadhaarCard[0])
    : null;
  const profilePhoto = req.files?.profilePhoto?.[0]
    ? getFileUrl(req.files.profilePhoto[0])
    : null;

  if (!aadhaarCard) {
    throw new ApiError(400, "Aadhaar card is required");
  }

  if (!profilePhoto) {
    throw new ApiError(400, "Profile photo is required");
  }

  // Update job seeker
  jobSeeker.name = name;
  jobSeeker.email = email;
  jobSeeker.gender = gender ? gender.toLowerCase().trim() : null;
  jobSeeker.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;

  // Update location - always set if resolved
  if (stateName) {
    jobSeeker.state = stateName;
    console.log("📍 Setting jobSeeker.state to:", stateName);
  }
  if (cityName) {
    jobSeeker.city = cityName;
    console.log("📍 Setting jobSeeker.city to:", cityName);
  }

  jobSeeker.aadhaarCard = aadhaarCard;
  jobSeeker.profilePhoto = profilePhoto;
  jobSeeker.registrationStep = 2;

  console.log("📍 Before save - jobSeeker.state:", jobSeeker.state, "| jobSeeker.city:", jobSeeker.city);

  await jobSeeker.save();

  console.log("📍 After save - jobSeeker.state:", jobSeeker.state, "| jobSeeker.city:", jobSeeker.city);

  // Process referral code if provided and not already referred
  // Creates a pending referral - coins will be awarded when user applies for a job
  let referralInfo = null;
  if (referralCode && !jobSeeker.referredBy) {
    try {
      const validation = await validateReferralCode(referralCode);
      if (validation.isValid) {
        const referrerUser = validation.referrer;
        const referrerType = validation.referrerType;

        // Create pending referral (coins awarded on first job application)
        const pendingReferral = await createPendingReferral({
          referrerId: referrerUser._id,
          referrerType: referrerType,
          refereeId: jobSeeker._id,
          refereeType: "JobSeeker",
          referralCode: referralCode
        });

        if (pendingReferral) {
          // Update job seeker's referredBy
          jobSeeker.referredBy = referrerUser._id;
          await jobSeeker.save();

          referralInfo = {
            referredBy: referrerUser._id,
            referrerType,
            status: "pending",
            message: "Referral registered. Coins will be awarded when you apply for your first job."
          };
        }
      }
    } catch (refErr) {
      console.error("❌ REFERRAL ERROR:", refErr.message);
      console.error("❌ Stack:", refErr.stack);
    }
  }

  return res
    .status(200)
    .json(
      ApiResponse.success(
        { jobSeeker, referral: referralInfo },
        "Step 1 completed successfully"
      )
    );
});

/**
 * Step 2 Registration (Diploma/ITI Holder) - Select Trade, Skills, and Answer Questions
 */
export const step2Registration = asyncHandler(async (req, res) => {
  const { phone, jobSeekerId, specializationId, selectedSkills, questionAnswers, role } =
    req.body;

  let finalSelectedSkills = normalizeSkills(selectedSkills);


  finalSelectedSkills = finalSelectedSkills.map((skill) =>
    String(skill).trim()
  );


  // Find job seeker - prefer jobSeekerId over phone
  let jobSeeker;
  if (jobSeekerId) {
    jobSeeker = await JobSeeker.findById(jobSeekerId);
  } else if (phone) {
    jobSeeker = await JobSeeker.findOne({ phone });
  } else {
    throw new ApiError(400, "Either jobSeekerId or phone is required");
  }

  if (!jobSeeker || !jobSeeker.phoneVerified) {
    throw new ApiError(400, "Please verify your phone number first");
  }

  // Check if user is already fully registered - prevent re-registration
  if (jobSeeker.isRegistrationComplete) {
    throw new ApiError(400, "You are already registered. Please login instead or update your profile through the profile settings.");
  }

  if (jobSeeker.registrationStep < 2) {
    throw new ApiError(400, "Please complete step 1 first");
  }

  // Verify specialization exists
  const specialization = await Specialization.findById(specializationId);
  if (!specialization) {
    throw new ApiError(404, "Specialization not found");
  }

  // Verify skills belong to specialization (case-insensitive, whitespace-insensitive)
  const specializationSkills = specialization.skills || [];

  // Normalize specialization skills for comparison (trim and lowercase)
  const normalizedSpecializationSkills = specializationSkills.map(skill =>
    String(skill).trim().toLowerCase()
  );

  // Check each selected skill against specialization skills
  const invalidSkills = finalSelectedSkills.filter((skill) => {
    const normalizedSkill = String(skill).trim().toLowerCase();
    return !normalizedSpecializationSkills.includes(normalizedSkill);
  });

  if (invalidSkills.length > 0) {
    // Debug: Log available skills for troubleshooting
    console.log("Available skills in specialization:", specializationSkills);
    console.log("Selected skills:", selectedSkills);
    console.log("Invalid skills:", invalidSkills);

    throw new ApiError(
      400,
      `Invalid skills: ${invalidSkills.join(", ")}. Skills must belong to the selected specialization. Available skills: ${specializationSkills.join(", ")}`
    );
  }

  // Get question set for this specialization
  // Check if specializationId is in the specializationIds array
  // Convert specializationId to ObjectId for proper matching
  const specializationObjectId = new mongoose.Types.ObjectId(specializationId);
  const questionSet = await QuestionSet.findOne({
    specializationIds: { $in: [specializationObjectId] },
  });

  if (!questionSet) {
    throw new ApiError(
      404,
      `No question set found for this specialization. Please ask admin to create a question set for specialization ID: ${specializationId}`
    );
  }

  if (!questionSet.questions || questionSet.questions.length === 0) {
    throw new ApiError(
      404,
      `Question set found but it has no questions. Please ask admin to add questions to the question set.`
    );
  }

  // Validate that all questions are answered
  const questionSetQuestions = questionSet.questions || [];
  if (questionAnswers.length !== questionSetQuestions.length) {
    throw new ApiError(
      400,
      `Please answer all ${questionSetQuestions.length} questions`
    );
  }

  // Process question answers and mark correct/incorrect
  const processedAnswers = questionAnswers.map((answer, index) => {
    // Find question by questionId (e.g., "q1", "q2", etc.)
    // questionId format is typically "q1", "q2", etc. from the API response
    let question;

    if (answer.questionId) {
      // Extract number from questionId (e.g., "q1" -> 1, "q2" -> 2)
      const questionIndexMatch = answer.questionId.match(/q(\d+)/i);
      if (questionIndexMatch) {
        const questionIndex = parseInt(questionIndexMatch[1]) - 1; // Convert to 0-based index
        if (questionIndex >= 0 && questionIndex < questionSetQuestions.length) {
          question = questionSetQuestions[questionIndex];
        }
      }
    }

    // Fallback: Try to find by questionText (for backward compatibility)
    if (!question && answer.questionText) {
      question = questionSetQuestions.find(
        (q) => q.text.trim().toLowerCase() === answer.questionText.trim().toLowerCase()
      );
    }

    // Fallback: Use index if questionId format doesn't match
    if (!question && index < questionSetQuestions.length) {
      question = questionSetQuestions[index];
    }

    if (!question) {
      throw new ApiError(
        400,
        `Question not found for questionId: ${answer.questionId || `at index ${index}`}`
      );
    }

    // Find the correct option
    const correctOption = question.options.find((opt) => opt.isCorrect);
    const isCorrect = correctOption &&
      correctOption.text.trim().toLowerCase() === answer.selectedOption?.trim().toLowerCase();

    return {
      questionId: answer.questionId || `q${index + 1}`,
      questionText: question.text,
      selectedOption: answer.selectedOption,
      isCorrect: isCorrect || false,
    };
  });

  // Update job seeker

  jobSeeker.specializationId = specializationId;
  jobSeeker.selectedSkills = finalSelectedSkills;   // ✅ CORRECT
  jobSeeker.skills = finalSelectedSkills;           // ✅ CORRECT

  jobSeeker.questionAnswers = processedAnswers;
  jobSeeker.role = role || "Worker";
  jobSeeker.registrationStep = 3;

  await jobSeeker.save();

  return res
    .status(200)
    .json(
      ApiResponse.success(
        { jobSeeker },
        "Step 2 completed successfully"
      )
    );
});

/**
 * Step 3 Registration (Diploma/ITI Holder) - Education and Experience Details
 * Supports:
 * - stateId/cityId/yearOfPassing from dropdowns OR state/city/yearOfPassing as names
 * - percentageOrGrade as separate field OR inside education object
 */
export const step3Registration = asyncHandler(async (req, res) => {
  const { phone, jobSeekerId, education, stateId, cityId, yearOfPassing, percentageOrGrade, experienceStatus, yearOfExperience } = req.body;

  // Find job seeker - prefer jobSeekerId over phone
  let jobSeeker;
  if (jobSeekerId) {
    jobSeeker = await JobSeeker.findById(jobSeekerId);
  } else if (phone) {
    jobSeeker = await JobSeeker.findOne({ phone });
  } else {
    throw new ApiError(400, "Either jobSeekerId or phone is required");
  }

  if (!jobSeeker || !jobSeeker.phoneVerified) {
    throw new ApiError(400, "Please verify your phone number first");
  }

  // Check if user is already fully registered - prevent re-registration
  if (jobSeeker.isRegistrationComplete) {
    throw new ApiError(400, "You are already registered. Please login instead or update your profile through the profile settings.");
  }

  if (jobSeeker.registrationStep < 3) {
    throw new ApiError(400, "Please complete step 2 first");
  }

  // Resolve state and city names from IDs
  let stateName = null;
  let cityName = null;

  if (stateId) {
    const stateDoc = await State.findById(stateId);
    if (!stateDoc) {
      throw new ApiError(404, "State not found");
    }
    stateName = stateDoc.name;
  }

  if (cityId) {
    const cityDoc = await City.findById(cityId);
    if (!cityDoc) {
      throw new ApiError(404, "City not found");
    }
    cityName = cityDoc.name;

    // Verify city belongs to the selected state
    if (stateId && cityDoc.stateId.toString() !== stateId) {
      throw new ApiError(400, "City does not belong to the selected state");
    }
  }

  // Build final education object
  // education is now a simple string (college name)
  const finalEducation = {
    collegeInstituteName: education,
    city: cityName,
    state: stateName,
    yearOfPassing: yearOfPassing,
  };

  // Add percentageOrGrade if provided
  if (percentageOrGrade) {
    finalEducation.percentageOrGrade = percentageOrGrade;
  }

  // Validate required fields
  if (!finalEducation.city || !finalEducation.state || !finalEducation.yearOfPassing) {
    throw new ApiError(400, "State, city, and year of passing are required");
  }

  if (!finalEducation.percentageOrGrade) {
    throw new ApiError(400, "Percentage or Grade is required");
  }

  // Handle file uploads
  const resume = req.files?.resume?.[0]
    ? getFileUrl(req.files.resume[0])
    : null;
  const experienceCertificate = req.files?.experienceCertificate?.[0]
    ? getFileUrl(req.files.experienceCertificate[0])
    : null;
  const documents = req.files?.documents
    ? req.files.documents.map((file) => getFileUrl(file))
    : [];

  if (!resume) {
    throw new ApiError(400, "Resume is required");
  }

  // If has experience, experience certificate is required
  if (experienceStatus) {
    if (!experienceCertificate) {
      throw new ApiError(400, "Experience certificate is required when you have experience");
    }
  }

  // Update job seeker
  jobSeeker.education = finalEducation;
  jobSeeker.experienceStatus = experienceStatus;
  jobSeeker.yearOfExperience = experienceStatus ? (yearOfExperience || "") : "";
  jobSeeker.resume = resume;
  if (experienceCertificate) {
    jobSeeker.experienceCertificate = experienceCertificate;
  }
  if (documents.length > 0) {
    jobSeeker.documents = documents;
  }
  jobSeeker.registrationStep = 4;
  jobSeeker.isRegistrationComplete = true;
  jobSeeker.status = "Active";

  await jobSeeker.save();

  return res
    .status(200)
    .json(
      ApiResponse.success(
        { jobSeeker },
        "Registration completed successfully"
      )
    );
});

/**
 * Get Available Categories (Public endpoint for registration)
 * Fetches active categories from database
 */
export const getCategories = asyncHandler(async (req, res) => {
  const categories = await Category.find({ status: "Active" })
    .select("name description status")
    .sort({ name: 1 })
    .lean();

  // Format for frontend compatibility
  const formattedCategories = categories.map((cat) => ({
    _id: cat._id,
    value: cat.name,
    label: cat.name,
    description: cat.description || "",
  }));

  return res
    .status(200)
    .json(
      ApiResponse.success(
        { categories: formattedCategories },
        "Categories fetched successfully"
      )
    );
});

/**
 * Get All Specializations (Public endpoint for registration)
 * Returns all specializations formatted for dropdown selection
 */
export const getAllSpecializations = asyncHandler(async (req, res) => {
  const specializations = await Specialization.find({ status: "Active" })
    .select("name skills status")
    .sort({ name: 1 })
    .lean();

  // Format for dropdown (just names and IDs)
  const formattedSpecializations = specializations.map((spec) => ({
    _id: spec._id,
    value: spec._id.toString(),
    label: spec.name,
    name: spec.name,
  }));

  return res
    .status(200)
    .json(
      ApiResponse.success(
        { specializations: formattedSpecializations },
        "Specializations fetched successfully"
      )
    );
});

/**
 * Get Specialization with Skills and Questions
 * Used when user selects a specialization from dropdown
 * Returns all skills for that specialization (for user to select from)
 * Also returns questions related to that specialization
 */
export const getSpecializationSkills = asyncHandler(async (req, res) => {
  const { specializationId } = req.params;

  const specialization = await Specialization.findById(specializationId).lean();
  if (!specialization) {
    throw new ApiError(404, "Specialization not found");
  }

  // Get question set for this specialization
  // Check if specializationId is in the specializationIds array
  // Convert specializationId to ObjectId for proper matching
  const specializationObjectId = new mongoose.Types.ObjectId(specializationId);
  const questionSet = await QuestionSet.findOne({
    specializationIds: { $in: [specializationObjectId] },
  }).lean();

  // Format skills for frontend selection (all available skills from this specialization)
  const allSkills = (specialization.skills || []).map((skill) => ({
    value: skill,
    label: skill,
  }));

  // Format questions with auto-generated questionId for frontend
  const formattedQuestions = questionSet
    ? (questionSet.questions || []).map((question, index) => ({
      questionId: `q${index + 1}`, // Auto-generated questionId: "q1", "q2", "q3", etc.
      text: question.text,
      options: question.options || [],
    }))
    : [];

  return res
    .status(200)
    .json(
      ApiResponse.success(
        {
          specialization: {
            _id: specialization._id,
            name: specialization.name,
            skills: specialization.skills || [], // Raw skills array
            allSkills: allSkills, // Formatted for frontend selection
          },
          questionSet: questionSet
            ? {
              _id: questionSet._id,
              name: questionSet.name,
              questions: formattedQuestions, // Questions with auto-generated questionId
              totalQuestions: questionSet.totalQuestions || 0,
            }
            : null,
        },
        "Specialization, skills, and questions fetched successfully"
      )
    );
});

/**
 * Get Skills by Category
 * Returns all skills from the specialization matching the category
 * Used for Non-Degree Holder registration to show all available skills
 */
export const getSkillsByCategory = asyncHandler(async (req, res) => {
  const { category } = req.query;

  if (!category) {
    throw new ApiError(400, "Category is required");
  }

  // Map category names to specialization names
  // "Non-Degree Holder" -> "Non-Degree"
  // "Diploma Holder" -> "Diploma"
  // "ITI Holder" -> "ITI"
  const categoryToSpecializationMap = {
    "Non-Degree Holder": "Non-Degree",
    "Diploma Holder": "Diploma",
    "ITI Holder": "ITI",
  };

  const specializationName = categoryToSpecializationMap[category];

  if (!specializationName) {
    throw new ApiError(
      400,
      `Invalid category. Valid categories: ${Object.keys(categoryToSpecializationMap).join(", ")}`
    );
  }

  // Find specialization by name (case-insensitive, exact match preferred)
  let specialization = await Specialization.findOne({
    name: { $regex: new RegExp(`^${specializationName}$`, "i") },
    status: "Active",
  }).lean();

  // If exact match not found, try partial match
  if (!specialization) {
    specialization = await Specialization.findOne({
      name: { $regex: new RegExp(specializationName, "i") },
      status: "Active",
    }).lean();
  }

  if (!specialization) {
    throw new ApiError(
      404,
      `No active specialization found for category: ${category}. Please ask admin to create a "${specializationName}" specialization.`
    );
  }

  // Format skills for frontend selection (all available skills)
  const allSkills = (specialization.skills || []).map((skill) => ({
    value: skill,
    label: skill,
  }));

  return res
    .status(200)
    .json(
      ApiResponse.success(
        {
          category: category,
          specialization: {
            _id: specialization._id,
            name: specialization.name,
            allSkills: allSkills, // All available skills formatted for frontend (user can select from these)
          },
        },
        "Skills fetched successfully"
      )
    );
});

/**
 * Get Job Seeker by Phone
 */
export const getJobSeekerByPhone = asyncHandler(async (req, res) => {
  const { phone } = req.params;

  const jobSeeker = await JobSeeker.findOne({ phone })
    .populate("specializationId", "name skills")
    .lean();

  if (!jobSeeker) {
    throw new ApiError(404, "Job seeker not found");
  }

  return res
    .status(200)
    .json(
      ApiResponse.success(
        { jobSeeker },
        "Job seeker fetched successfully"
      )
    );
});

/**
 * Refresh Access Token
 * 
 * This endpoint allows job seekers to get a new access token when their current one expires.
 * Uses the refresh token (long-lived) to generate a new access token (short-lived).
 * 
 * Flow:
 * 1. Client sends refresh token
 * 2. Verify refresh token signature and expiration
 * 3. Find job seeker and verify stored refresh token matches
 * 4. Generate new access token
 * 5. Optionally generate new refresh token (token rotation)
 * 
 * @route POST /api/job-seekers/refresh-token
 */
export const refreshAccessToken = asyncHandler(async (req, res) => {
  // 1. Extract refresh token from request
  const incomingRefreshToken =
    req.body.refreshToken ||
    req.cookies?.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, "Refresh token is required");
  }

  // 2. Verify refresh token signature and expiration
  let decodedToken;
  try {
    decodedToken = verifyRefreshToken(incomingRefreshToken);
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      throw new ApiError(401, "Refresh token expired. Please login again.");
    } else if (error.name === "JsonWebTokenError") {
      throw new ApiError(401, "Invalid refresh token");
    } else {
      throw new ApiError(401, "Token verification failed");
    }
  }

  // 3. Verify token type (should be "refresh")
  if (decodedToken.type !== "refresh") {
    throw new ApiError(401, "Invalid token type. Expected refresh token.");
  }

  // 4. Find job seeker and verify stored refresh token matches
  const jobSeeker = await JobSeeker.findById(decodedToken.id).select("+refreshToken");

  if (!jobSeeker) {
    throw new ApiError(401, "Invalid refresh token: Job seeker not found");
  }

  // 5. Verify stored refresh token matches incoming token
  if (jobSeeker.refreshToken !== incomingRefreshToken) {
    // Token mismatch - possible token theft, invalidate all tokens
    jobSeeker.refreshToken = null;
    await jobSeeker.save({ select: "+refreshToken" });
    throw new ApiError(401, "Refresh token mismatch. Please login again.");
  }

  // 6. Check if job seeker is active
  if (jobSeeker.status === "Inactive" || jobSeeker.status === "Rejected") {
    throw new ApiError(403, "Account is inactive. Please contact support.");
  }

  // 7. Generate new access token
  const newAccessToken = generateAccessToken({
    id: jobSeeker._id.toString(),
    phone: jobSeeker.phone,
    role: jobSeeker.role || "job-seeker",
  });

  // 8. Optional: Token rotation - generate new refresh token
  // This is a security best practice: invalidate old refresh token, issue new one
  const newRefreshToken = generateRefreshToken({
    id: jobSeeker._id.toString(),
    phone: jobSeeker.phone,
  });

  // 9. Save new refresh token to database
  jobSeeker.refreshToken = newRefreshToken;
  await jobSeeker.save({ select: "+refreshToken" });

  // 10. Set new refresh token as HTTP-only cookie (optional, for web apps)
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  };
  res.cookie("refreshToken", newRefreshToken, cookieOptions);

  // 11. Return new tokens
  return res
    .status(200)
    .json(
      ApiResponse.success(
        {
          accessToken: newAccessToken,
          refreshToken: newRefreshToken, // New refresh token (token rotation)
        },
        "Access token refreshed successfully"
      )
    );
});

/**
 * Logout Job Seeker
 * 
 * Invalidates the refresh token by removing it from the database.
 * Access tokens cannot be invalidated (they're stateless), but they'll expire naturally.
 * 
 * @route POST /api/job-seekers/logout
 */
export const logoutJobSeeker = asyncHandler(async (req, res) => {
  // Extract refresh token
  const refreshToken =
    req.body.refreshToken ||
    req.cookies?.refreshToken;

  if (refreshToken) {
    // Find job seeker by refresh token and remove it
    const jobSeeker = await JobSeeker.findOne({ refreshToken }).select("+refreshToken");

    if (jobSeeker) {
      jobSeeker.refreshToken = null;
      await jobSeeker.save({ select: "+refreshToken" });
    }
  }

  // Clear refresh token cookie
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });

  return res
    .status(200)
    .json(
      ApiResponse.success(
        null,
        "Logout successful"
      )
    );
});

/**
 * Get Job Seeker Profile
 * Returns the authenticated job seeker's complete profile information
 * 
 * @route GET /api/job-seekers/profile
 * @requires Authentication (JWT token)
 */
export const getJobSeekerProfile = asyncHandler(async (req, res) => {
  const jobSeeker = req.jobSeeker; // From auth middleware

  // Populate specialization if exists
  const profile = await JobSeeker.findById(jobSeeker._id)
    .populate("specializationId", "name description skills status")
    .lean();

  if (!profile) {
    throw new ApiError(404, "Job seeker profile not found");
  }

  // ✅ DEBUG: Log what we're getting from database
  console.log("========== getJobSeekerProfile DEBUG ==========");
  console.log("📤 Profile from DB:");
  console.log("   - _id:", profile._id);
  console.log("   - name:", profile.name);
  console.log("   - email:", profile.email);
  console.log("   - phone:", profile.phone);
  console.log("   - gender:", profile.gender);
  console.log("   - dateOfBirth:", profile.dateOfBirth);
  console.log("   - state:", profile.state);
  console.log("   - city:", profile.city);
  console.log("   - category:", profile.category);
  console.log("   - role:", profile.role);
  console.log("   - specializationId:", profile.specializationId?._id || null);
  console.log("   - selectedSkills:", profile.selectedSkills);
  console.log("   - skills:", profile.skills);
  console.log("   - questionAnswers:", JSON.stringify(profile.questionAnswers));
  console.log("   - aboutMe:", profile.aboutMe);
  console.log("   - profilePhoto:", profile.profilePhoto);
  console.log("   - aadhaarCard:", profile.aadhaarCard);
  console.log("   - resume:", profile.resume);
  console.log("   - registrationStep:", profile.registrationStep);
  console.log("   - status:", profile.status);
  console.log("   - education:", profile.education);
  console.log("=================================================");

  // Format response
  const formattedProfile = {
    _id: profile._id,
    phone: profile.phone,
    phoneVerified: profile.phoneVerified,
    category: profile.category,
    role: profile.role,
    // Personal Information
    name: profile.name,
    email: profile.email,
    gender: profile.gender,
    dateOfBirth: profile.dateOfBirth,
    // Location
    state: profile.state,
    city: profile.city,
    // Skills & Specialization
    specializationId: profile.specializationId?._id || null,
    specialization: profile.specializationId
      ? {
        _id: profile.specializationId._id,
        name: profile.specializationId.name,
        description: profile.specializationId.description,
      }
      : null,
    skills: profile.skills || [],
    selectedSkills: profile.selectedSkills || [],
    // Question Answers
    questionAnswers: profile.questionAnswers || [],
    // Documents
    aadhaarCard: profile.aadhaarCard,
    profilePhoto: profile.profilePhoto,
    resume: profile.resume,
    experienceCertificate: profile.experienceCertificate,
    documents: profile.documents || [],
    // Education Details
    education: profile.education || null,
    // Experience Status & Year of Experience
    experienceStatus: profile.experienceStatus,
    yearOfExperience: profile.yearOfExperience || "",
    // About Me
    aboutMe: profile.aboutMe || null,
    // Registration Status
    registrationStep: profile.registrationStep,
    isRegistrationComplete: profile.isRegistrationComplete,
    // Status & Block
    status: profile.status,
    isBlocked: profile.isBlocked || false,
    // Coin Balance
    coinBalance: profile.coinBalance || 0,
    // FCM Tokens
    fcmTokens: profile.fcmTokens || [],
    // Referral System
    referralCode: profile.referralCode || null,
    referredBy: profile.referredBy || null,
    totalReferrals: profile.totalReferrals || 0,
    // Blocked Jobs from Feedback
    blockedJobsFromFeedback: profile.blockedJobsFromFeedback || [],
    // Timestamps
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };

  return res.status(200).json(
    ApiResponse.success(
      { profile: formattedProfile },
      "Job seeker profile retrieved successfully"
    )
  );
});

/**
 * Update Job Seeker Profile
 * Allows authenticated job seeker to update their profile information
 * 
 * @route PUT /api/job-seekers/profile
 * @requires Authentication (JWT token)
 */
export const updateJobSeekerProfile = asyncHandler(async (req, res) => {
  const jobSeeker = req.jobSeeker; // From auth middleware
  const {
    name,
    email,
    gender,
    dateOfBirth,
    state,
    city,
    stateId,
    cityId,
    specializationId,
    selectedSkills,
    aboutMe,
  } = req.body;

  // Find the job seeker
  const profile = await JobSeeker.findById(jobSeeker._id);
  if (!profile) {
    throw new ApiError(404, "Job seeker profile not found");
  }

  // ✅ BASIC UPDATES
  if (name !== undefined) profile.name = name?.trim() || null;
  if (email !== undefined) profile.email = email?.trim().toLowerCase() || null;
  if (gender !== undefined) profile.gender = gender?.trim().toLowerCase() || null;
  if (dateOfBirth !== undefined)
    profile.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;


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
    // Update using names directly
    if (state !== undefined) {
      profile.state = state?.trim() || null;
    }
    if (city !== undefined) {
      profile.city = city?.trim() || null;
    }
  }

  // Update specialization and skills
  if (specializationId !== undefined) {
    const specialization = await Specialization.findById(specializationId);
    if (!specialization) {
      throw new ApiError(404, "Specialization not found");
    }
    profile.specializationId = specializationId;
  }

  // Update skills if provided
  if (selectedSkills !== undefined) {
    let finalSelectedSkills = selectedSkills;

    if (typeof selectedSkills === "string") {
      try {
        finalSelectedSkills = JSON.parse(selectedSkills);
      } catch (err) {
        finalSelectedSkills = selectedSkills
          .replace(/^\[|\]$/g, "")
          .split(",")
          .map((s) => s.trim());
      }
    }

    finalSelectedSkills = finalSelectedSkills.map((skill) =>
      String(skill).trim()
    );

    if (finalSelectedSkills.length > 0) {
      profile.selectedSkills = finalSelectedSkills;
    } else {
      profile.selectedSkills = [];
    }
  }

  // Update about me section
  if (aboutMe !== undefined) {
    profile.aboutMe = aboutMe?.trim() || null;
  }

  // Handle file uploads
  if (req.files?.aadhaarCard?.[0]) {
    profile.aadhaarCard = getFileUrl(req.files.aadhaarCard[0]);
  }
  if (req.files?.profilePhoto?.[0]) {
    profile.profilePhoto = getFileUrl(req.files.profilePhoto[0]);
  }
  if (req.files?.resume?.[0]) {
    profile.resume = getFileUrl(req.files.resume[0]);
  }
  if (req.files?.experienceCertificate?.[0]) {
    profile.experienceCertificate = getFileUrl(req.files.experienceCertificate[0]);
  }
  if (req.files?.documents) {
    const documentUrls = req.files.documents.map((file) => getFileUrl(file));
    profile.documents = documentUrls;
  }

  await profile.save();

  // Populate specialization for response
  await profile.populate("specializationId", "name description skills status");

  // Format response
  const formattedProfile = {
    _id: profile._id,
    phone: profile.phone,
    phoneVerified: profile.phoneVerified,
    category: profile.category,
    role: profile.role,
    name: profile.name,
    email: profile.email,
    gender: profile.gender,
    dateOfBirth: profile.dateOfBirth,
    state: profile.state,
    city: profile.city,
    specializationId: profile.specializationId?._id || null,
    specialization: profile.specializationId
      ? {
        _id: profile.specializationId._id,
        name: profile.specializationId.name,
        description: profile.specializationId.description,
      }
      : null,
    skills: profile.skills || [],
    selectedSkills: profile.selectedSkills || [],
    questionAnswers: profile.questionAnswers || [],
    aadhaarCard: profile.aadhaarCard,
    profilePhoto: profile.profilePhoto,
    resume: profile.resume,
    experienceCertificate: profile.experienceCertificate,
    documents: profile.documents || [],
    education: profile.education || null,
    experienceStatus: profile.experienceStatus,
    aboutMe: profile.aboutMe || null,
    registrationStep: profile.registrationStep,
    isRegistrationComplete: profile.isRegistrationComplete,
    status: profile.status,
    coinBalance: profile.coinBalance || 0,
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

