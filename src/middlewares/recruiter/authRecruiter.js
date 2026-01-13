import ApiError from "../../utils/ApiError.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { verifyAccessToken } from "../../utils/jwtToken.js";
import { Recruiter } from "../../models/recruiter/recruiter.model.js";

const extractToken = (req) => {
  const headerToken = req.headers["authorization"]?.replace("Bearer ", "");
  const cookieToken = req.cookies?.accessToken;

  return headerToken || cookieToken || null;
};

export const verifyRecruiterJWT = asyncHandler(async (req, res, next) => {
  const token = extractToken(req);

  if (!token) {
    throw new ApiError(401, "Unauthorized: No access token provided");
  }

  let decodedToken;
  try {
    decodedToken = verifyAccessToken(token);
  } catch (error) {
    console.log("🔐 JWT Verification Failed:");
    console.log("  - Token (first 50 chars):", token?.substring(0, 50) + "...");
    console.log("  - Error name:", error.name);
    console.log("  - Error message:", error.message);
    console.log("  - Request URL:", req.originalUrl);

    if (error.name === "TokenExpiredError") {
      throw new ApiError(401, "Access token expired. Please refresh your token.");
    } else if (error.name === "JsonWebTokenError") {
      throw new ApiError(401, "Invalid access token");
    }
    throw new ApiError(401, "Token verification failed");
  }

  if (decodedToken.type !== "access") {
    throw new ApiError(401, "Invalid token type. Expected access token.");
  }

  const recruiter = await Recruiter.findById(decodedToken.id).select("-refreshToken");

  if (!recruiter) {
    throw new ApiError(401, "Invalid access token: Recruiter not found");
  }

  if (["Inactive", "Rejected"].includes(recruiter.status)) {
    throw new ApiError(403, "Account is inactive. Please contact support.");
  }

  req.recruiter = recruiter;
  req.recruiterId = recruiter._id;
  req.accessToken = token;

  next();
});


