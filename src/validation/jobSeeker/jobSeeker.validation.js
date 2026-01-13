import Joi from "joi";

// Common schemas
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

const categorySchema = Joi.string()
  .valid("Non-Degree Holder", "Diploma Holder", "ITI Holder")
  .required();

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

const stateSchema = Joi.string().trim().min(1).required();
const citySchema = Joi.string().trim().min(1).required();

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

// Send OTP Schema (category is optional here, will be sent in verify-otp)
export const sendOTPSchema = Joi.object({
  phone: phoneSchema,
  category: categorySchema.optional(), // Optional in send-otp, required in verify-otp
});

// Verify OTP Schema (category is optional - required only for new registrations)
export const verifyOTPSchema = Joi.object({
  phone: phoneSchema,
  otp: otpSchema,
  category: categorySchema.optional(), // Optional - required only if user doesn't exist
});

// Non-Degree Holder Registration Schema
// Supports both: state/city (names) OR stateId/cityId (IDs from dropdowns)
export const nonDegreeRegistrationSchema = Joi.object({
  phone: phoneSchema,
  // Personal Information
  name: Joi.string().trim().min(1).required().messages({
    "string.min": "Name is required",
    "any.required": "Name is required",
  }),
  email: Joi.string().email().required().messages({
    "string.email": "Please provide a valid email address",
    "any.required": "Email is required",
  }),
  gender: Joi.string()
    .trim()
    .lowercase()
    .valid("male", "female", "prefer not to say")
    .required()
    .messages({
      "any.only": "Gender must be one of: male, female, prefer not to say",
      "any.required": "Gender is required",
    }),
  dateOfBirth: Joi.date().required().messages({
    "date.base": "Please provide a valid date of birth",
    "any.required": "Date of birth is required",
  }),
  // Option 1: State and City names (backward compatible)
  state: stateSchema.optional(),
  city: citySchema.optional(),
  // Option 2: State and City IDs (from dropdowns)
  stateId: stateIdSchema,
  cityId: cityIdSchema,
  address: Joi.string().trim().optional().allow(""),
  specializationId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      "string.pattern.base": "Invalid specialization ID",
      "any.required": "Specialization is required",
    }),
  selectedSkills: Joi.array()
    .items(Joi.string().trim().min(1))
    .min(1)
    .required()
    .messages({
      "array.min": "At least one skill must be selected",
      "any.required": "Skills are required",
    }),
  referralCode: referralCodeSchema,
}).or("state", "stateId").or("city", "cityId").messages({
  "object.missing": "Either state/stateId and city/cityId are required",
});

// Step 1 Registration Schema (Diploma/ITI Holder)
// Supports stateId/cityId for location
export const step1RegistrationSchema = Joi.object({
  phone: phoneSchema,
  // Personal Information
  name: Joi.string().trim().min(1).required().messages({
    "string.min": "Name is required",
    "any.required": "Name is required",
  }),
  email: Joi.string().email().required().messages({
    "string.email": "Please provide a valid email address",
    "any.required": "Email is required",
  }),
  gender: Joi.string()
    .trim()
    .lowercase()
    .valid("male", "female", "prefer not to say")
    .required()
    .messages({
      "any.only": "Gender must be one of: male, female, prefer not to say",
      "any.required": "Gender is required",
    }),
  dateOfBirth: Joi.date().required().messages({
    "date.base": "Please provide a valid date of birth",
    "any.required": "Date of birth is required",
  }),
  // Location - State and City IDs (from dropdowns)
  stateId: stateIdSchema,
  cityId: cityIdSchema,
  address: Joi.string().trim().max(500).optional().allow(""),
  referralCode: referralCodeSchema,
  // category is optional - already set in verify-otp and stored in job seeker record
  // Files will be handled separately via multer
});

// Step 2 Registration Schema (Diploma/ITI Holder)
export const step2RegistrationSchema = Joi.object({
  phone: phoneSchema.optional(),
  jobSeekerId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .optional()
    .messages({
      "string.pattern.base": "Invalid job seeker ID",
    }),
  specializationId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      "string.pattern.base": "Invalid specialization ID",
      "any.required": "Specialization is required",
    }),
  selectedSkills: Joi.array()
    .items(Joi.string().trim().min(1))
    .min(1)
    .required()
    .messages({
      "array.min": "At least one skill must be selected",
      "any.required": "Skills are required",
    }),
  questionAnswers: Joi.array()
    .items(
      Joi.object({
        questionId: Joi.string().required(),
        selectedOption: Joi.string().trim().required(),
        // Optional fields for backward compatibility
        questionText: Joi.string().trim().optional(),
        isCorrect: Joi.boolean().optional(),
      })
    )
    .min(1)
    .required()
    .messages({
      "array.min": "At least one question must be answered",
      "any.required": "Question answers are required",
    }),
  role: Joi.string()
    .valid("Worker", "Contractor", "Admin")
    .default("Worker")
    .optional(),
}).or("phone", "jobSeekerId"); // At least one of phone or jobSeekerId is required

// Step 3 Registration Schema (Diploma/ITI Holder)
// Supports stateId/cityId/yearOfPassing from dropdowns OR state/city/yearOfPassing as names
// Supports percentageOrGrade as separate field OR inside education object
export const step3RegistrationSchema = Joi.object({
  phone: Joi.string()
    .pattern(/^[6-9]\d{9}$/)
    .optional()
    .allow("")
    .messages({
      "string.pattern.base": "Phone number must be a valid 10-digit Indian mobile number",
    }),
  jobSeekerId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .optional()
    .messages({
      "string.pattern.base": "Invalid job seeker ID",
    }),
  education: Joi.string().trim().min(1).required(), // College/Institute name as simple text
  stateId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      "string.pattern.base": "Invalid state ID",
      "any.required": "State ID is required",
    }),
  cityId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      "string.pattern.base": "Invalid city ID",
      "any.required": "City ID is required",
    }),
  yearOfPassing: Joi.string().trim().min(1).required().messages({
    "any.required": "Year of passing is required",
  }),
  percentageOrGrade: Joi.string().trim().min(1).required().messages({
    "any.required": "Percentage or Grade is required",
  }),
  experienceStatus: Joi.boolean().required(),
  yearOfExperience: Joi.alternatives().try(Joi.string(), Joi.number()).optional().allow(""),
  // Files (resume, documents, experienceCertificate) will be handled via multer
})
  .or("phone", "jobSeekerId") // At least one of phone or jobSeekerId is required
  .messages({
    "object.missing": "Either phone or jobSeekerId is required",
  });

// Get Specialization Skills Schema
export const getSpecializationSkillsSchema = Joi.object({
  specializationId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      "string.pattern.base": "Invalid specialization ID",
      "any.required": "Specialization ID is required",
    }),
});

// Get Skills by Category Schema
export const getSkillsByCategorySchema = Joi.object({
  category: Joi.string()
    .valid("Non-Degree Holder", "Diploma Holder", "ITI Holder")
    .required()
    .messages({
      "any.only": "Category must be one of: Non-Degree Holder, Diploma Holder, ITI Holder",
      "any.required": "Category is required",
    }),
});

// Application Schemas
export const applyForJobSchema = Joi.object({
  jobId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      "string.pattern.base": "Invalid job ID format",
      "any.required": "Job ID is required",
    }),
  coverLetter: Joi.string().trim().max(5000).allow("").optional().messages({
    "string.max": "Cover letter must not exceed 5000 characters",
  }),
  notes: Joi.string().trim().max(1000).allow("").optional().messages({
    "string.max": "Notes must not exceed 1000 characters",
  }),
});

export const getMyApplicationsSchema = Joi.object({
  status: Joi.string()
    .valid("Applied", "Pending", "Shortlisted", "Accepted", "Rejected", "Withdrawn")
    .optional()
    .messages({
      "any.only": "Status must be one of: Applied, Pending, Shortlisted, Accepted, Rejected, Withdrawn",
    }),
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
});

// Update Job Seeker Profile Schema
export const updateJobSeekerProfileSchema = Joi.object({
  name: Joi.string().trim().min(1).optional().messages({
    "string.min": "Name must be at least 1 character",
  }),
  email: Joi.string().email().trim().lowercase().optional().messages({
    "string.email": "Please provide a valid email address",
  }),
  gender: Joi.string()
    .trim()
    .lowercase()
    .valid("male", "female", "prefer not to say")
    .optional()
    .messages({
      "any.only": "Gender must be one of: male, female, prefer not to say",
    }),
  dateOfBirth: Joi.date().optional().messages({
    "date.base": "Please provide a valid date of birth",
  }),
  state: Joi.string().trim().min(1).optional(),
  city: Joi.string().trim().min(1).optional(),
  stateId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .optional()
    .messages({
      "string.pattern.base": "Invalid state ID",
    }),
  cityId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .optional()
    .messages({
      "string.pattern.base": "Invalid city ID",
    }),
  address: Joi.string().trim().max(500).optional().allow(""),
  specializationId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .optional()
    .messages({
      "string.pattern.base": "Invalid specialization ID",
    }),
  selectedSkills: Joi.array()
    .items(Joi.string().trim().min(1))
    .min(1)
    .optional()
    .messages({
      "array.min": "At least one skill must be selected if skills are provided",
    }),
  aboutMe: Joi.string().trim().max(2000).optional().allow("").messages({
    "string.max": "About me section must not exceed 2000 characters",
  }),
  // Note: Documents (profilePhoto, resume, etc.) are handled via file upload middleware
});

