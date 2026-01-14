import ApiError from "../../utils/ApiError.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { Recruiter } from "../../models/recruiter/recruiter.model.js";

/**
 * Ensure recruiter profile is complete before allowing job post creation.
 *
 * Required fields:
 * - name
 * - companyName
 * - email
 * - state
 * - city
 * - businessType
 * - establishedFrom
 *
 * website, aboutMe and documents are NOT required.
 */
export const ensureRecruiterProfileComplete = asyncHandler(async (req, res, next) => {
  const recruiterFromAuth = req.recruiter;

  if (!recruiterFromAuth || !recruiterFromAuth._id) {
    throw new ApiError(401, "Unauthorized: Recruiter not found in request");
  }

  // Always read fresh from DB in case profile was updated recently
  const recruiter = await Recruiter.findById(recruiterFromAuth._id).lean();

  if (!recruiter) {
    throw new ApiError(404, "Recruiter profile not found");
  }

  const missingFields = [];

  const isEmpty = (v) =>
    v === undefined || v === null || (typeof v === "string" && v.trim().length === 0);

  if (isEmpty(recruiter.name)) missingFields.push("name");
  if (isEmpty(recruiter.companyName)) missingFields.push("companyName");
  if (isEmpty(recruiter.email)) missingFields.push("email");
  if (isEmpty(recruiter.state)) missingFields.push("state");
  if (isEmpty(recruiter.city)) missingFields.push("city");
  // if (isEmpty(recruiter.businessType)) missingFields.push("businessType");
  if (
    recruiter.establishedFrom === undefined ||
    recruiter.establishedFrom === null ||
    Number.isNaN(Number(recruiter.establishedFrom))
  ) {
    missingFields.push("establishedFrom");
  }

  if (missingFields.length > 0) {
    throw new ApiError(
      400,
      `Please complete your profile before creating a job post. Missing: ${missingFields.join(
        ", "
      )}`
    );
  }

  return next();
});
















