import { OTP } from "../models/otp.model.js";

/**
 * Generate a random 4-digit OTP
 *
 * Always generates a random OTP (1000–9999) for DLT SMS delivery.
 * To force a static OTP for local testing, set STATIC_TEST_OTP in .env.
 */
export const generateOTP = () => {
  if (process.env.STATIC_TEST_OTP) {
    return process.env.STATIC_TEST_OTP;
  }

  return Math.floor(1000 + Math.random() * 9000).toString();
};

/**
 * Store OTP in database
 * @param {string} phone - Phone number
 * @param {string} purpose - Purpose of OTP (registration, login, verification)
 * @returns {Promise<string>} - The generated OTP
 */
export const storeOTP = async (phone, purpose = "registration") => {
  // Delete any existing OTPs for this phone
  await OTP.deleteMany({ phone, purpose, verified: false });

  // Generate new OTP
  const otp = generateOTP();

  // Set expiration to 10 minutes from now
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 10);

  // Store OTP
  await OTP.create({
    phone,
    otp,
    expiresAt,
    purpose,
    verified: false,
  });

  return otp;
};

/**
 * Verify OTP
 * @param {string} phone - Phone number
 * @param {string} otp - OTP to verify
 * @param {string} purpose - Purpose of OTP
 * @returns {Promise<boolean>} - True if OTP is valid, false otherwise
 */
export const verifyOTP = async (phone, otp, purpose = "registration") => {
  const otpRecord = await OTP.findOne({
    phone,
    otp,
    purpose,
    verified: false,
    expiresAt: { $gt: new Date() }, // Not expired
  });

  if (!otpRecord) {
    return false;
  }

  // Mark OTP as verified
  otpRecord.verified = true;
  await otpRecord.save();

  // Delete all OTPs for this phone after successful verification
  await OTP.deleteMany({ phone, purpose });

  return true;
};

/**
 * Check if phone has a valid unverified OTP
 * @param {string} phone - Phone number
 * @param {string} purpose - Purpose of OTP
 * @returns {Promise<boolean>}
 */
export const hasValidOTP = async (phone, purpose = "registration") => {
  const otpRecord = await OTP.findOne({
    phone,
    purpose,
    verified: false,
    expiresAt: { $gt: new Date() },
  });

  return !!otpRecord;
};

