import Joi from "joi";

const phoneSchema = Joi.string()
  .pattern(/^[6-9]\d{9}$/)
  .required()
  .messages({
    "string.pattern.base": "Phone number must be a valid 10-digit Indian mobile number",
    "any.required": "Phone number is required",
  });

const otpSchema = Joi.string()
  .length(4)
  .pattern(/^\d{4}$/)
  .required()
  .messages({
    "string.length": "OTP must be exactly 4 digits",
    "string.pattern.base": "OTP must contain only digits",
    "any.required": "OTP is required",
  });

// Send OTP Schema for Recruiter
export const sendOTPSchema = Joi.object({
  phone: phoneSchema,
});

// Verify OTP Schema for Recruiter
export const verifyOTPSchema = Joi.object({
  phone: phoneSchema,
  otp: otpSchema,
});

const objectIdSchema = Joi.string()
  .hex()
  .length(24)
  .messages({
    "string.hex": "recruiterId must be a valid ObjectId",
    "string.length": "recruiterId must be exactly 24 characters",
  });

// State ID Schema (MongoDB ObjectId)
const stateIdSchema = Joi.string()
  .pattern(/^[0-9a-fA-F]{24}$/)
  .optional()
  .messages({
    "string.pattern.base": "Invalid state ID",
  });

// City ID Schema (MongoDB ObjectId)
const cityIdSchema = Joi.string()
  .pattern(/^[0-9a-fA-F]{24}$/)
  .optional()
  .messages({
    "string.pattern.base": "Invalid city ID",
  });

// Referral Code Schema (8-character alphanumeric, optional)
const referralCodeSchema = Joi.string()
  .alphanum()
  .min(6)
  .max(10)
  .uppercase()
  .optional()
  .messages({
    "string.alphanum": "Referral code must contain only letters and numbers",
    "string.min": "Referral code must be at least 6 characters",
    "string.max": "Referral code must be at most 10 characters",
  });

// Recruiter Registration Schema (basic for now)
// Supports both backend field names and Flutter field names for compatibility
export const recruiterRegistrationSchema = Joi.object({
  phone: phoneSchema.optional(),
  recruiterId: objectIdSchema.optional(),
  // Contact Person Name - accepts both 'name' and 'contactPersonName'
  name: Joi.string().trim().allow("").optional(),
  contactPersonName: Joi.string().trim().allow("").optional(),
  companyName: Joi.string().trim().allow("").optional(),
  email: Joi.string().email().trim().lowercase().optional(),
  state: Joi.string().trim().min(1).optional(),
  city: Joi.string().trim().min(1).optional(),
  stateName: Joi.string().trim().min(1).optional(),
  cityName: Joi.string().trim().min(1).optional(),
  stateId: stateIdSchema,
  cityId: cityIdSchema,
  address: Joi.string().trim().optional().allow(""),
  // Website - accepts any string (URL validation disabled)
  website: Joi.string().trim().optional().allow(""),
  businessType: Joi.string().trim().max(100).optional().allow(""),
  // Established Year - accepts both 'establishedFrom' and 'establishedYear'
  establishedFrom: Joi.alternatives().try(
    Joi.number().integer().min(1800).max(new Date().getFullYear() + 1),
    Joi.string().pattern(/^\d{4}$/)
  ).optional().messages({
    "alternatives.match": "Established year must be a valid year",
  }),
  establishedYear: Joi.alternatives().try(
    Joi.number().integer().min(1800).max(new Date().getFullYear() + 1),
    Joi.string().pattern(/^\d{4}$/)
  ).optional().messages({
    "alternatives.match": "Established year must be a valid year",
  }),
  // About/Description - accepts both 'aboutMe' and 'description'
  aboutMe: Joi.string().trim().max(2000).optional().allow(""),
  description: Joi.string().trim().max(2000).optional().allow(""),
  referralCode: referralCodeSchema,
}).or("phone", "recruiterId");

// Update Recruiter Profile Schema
export const updateRecruiterProfileSchema = Joi.object({
  name: Joi.string().trim().min(1).optional().messages({
    "string.min": "Name must be at least 1 character",
  }),
  companyName: Joi.string().trim().min(1).optional().messages({
    "string.min": "Company name must be at least 1 character",
  }),
  email: Joi.string().email().trim().lowercase().optional().messages({
    "string.email": "Please provide a valid email address",
  }),
  state: Joi.string().trim().min(1).optional(),
  city: Joi.string().trim().min(1).optional(),
  stateId: stateIdSchema,
  cityId: cityIdSchema,
  address: Joi.string().trim().max(500).optional().allow(""),
  // Website - accepts any string (URL validation disabled)
  website: Joi.string().trim().optional().allow(""),
  businessType: Joi.string().trim().max(100).optional().allow(""),
  establishedFrom: Joi.number()
    .integer()
    .min(1800)
    .max(new Date().getFullYear() + 1)
    .optional()
    .messages({
      "number.base": "Established from must be a valid year",
      "number.min": "Established from must be greater than or equal to 1800",
      "number.max": "Established from cannot be in the far future",
    }),
  aboutMe: Joi.string().trim().max(2000).optional().allow("").messages({
    "string.max": "About me section must not exceed 2000 characters",
  }),
  // Note: Documents (companyLogo, etc.) are handled via file upload middleware
});


