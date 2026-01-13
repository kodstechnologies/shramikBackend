import { Router } from "express";
import {
  createRecruiterJob,
  getAllJobPosts,
  getJobPostById,
  updateVacancyCount,
  deactivateJob,
  getRecruiterJobs,
  repostJob,
  updateJobPost,
} from "../../controllers/recruiter/jobPost/jobPost.controller.js";
import { validateRequest } from "../../middlewares/recruiter/validateRecruiter.js";
import { createRecruiterJobSchema } from "../../validation/recruiter/jobPost/jobPost.validation.js";
import { verifyRecruiterJWT } from "../../middlewares/recruiter/authRecruiter.js";
import { optionalJobSeekerAuth } from "../../middlewares/jobSeeker/authJobSeeker.js";
import { ensureRecruiterProfileComplete } from "../../middlewares/recruiter/ensureProfileComplete.js";
import multer from "multer";

// Multer middleware for parsing form-data (no file uploads, just text fields)
const parseFormData = multer().none();

const router = Router();

/** 
 * GET /api/recruiters/jobs
 * Get all job posts with optional filtering and pagination
 * Public endpoint - but if job seeker is authenticated, filters by their category
 */
router.get("/jobs", optionalJobSeekerAuth, getAllJobPosts);

router.get("/jobs/my-jobs", verifyRecruiterJWT, getRecruiterJobs);
/**
 * GET /api/recruiters/jobs/:id
 * Get a specific job post by ID
 * Public endpoint - no authentication required
 */
router.get("/jobs/:id", getJobPostById);

/**
 * POST /api/recruiters/jobs
 * Create a new job posting
 * Requires: Recruiter authentication (JWT token)
 */
router.post(
  "/jobs",
  verifyRecruiterJWT,
  ensureRecruiterProfileComplete,
  validateRequest(createRecruiterJobSchema),
  createRecruiterJob
);

/**
 * PATCH /api/recruiters/jobs/:jobId/vacancy-count
 * Update vacancy count for a job post
 * Body: { vacancyCount: number }
 * Requires: Recruiter authentication (JWT token)
 */
router.patch("/jobs/:jobId/vacancy-count", verifyRecruiterJWT, updateVacancyCount);

/**
 * PATCH /api/recruiters/jobs/:jobId
 * Edit/Update a job post
 * Can update all fields except vacancyCount
 * Supports both JSON and form-data
 * Requires: Recruiter authentication (JWT token)
 */
router.patch("/jobs/:jobId", verifyRecruiterJWT, parseFormData, updateJobPost);



/* Repost Job Api */



router.patch("/jobs/:jobId/repost", verifyRecruiterJWT, repostJob);

/**
 * PATCH /api/recruiters/jobs/:jobId/deactivate
 * Manually deactivate/close a job post
 * Requires: Recruiter authentication (JWT token)
 */
router.patch("/jobs/:jobId/deactivate", verifyRecruiterJWT, deactivateJob);

/**
 * GET /api/recruiters/jobs/my-jobs
 * Get all job posts for the authenticated recruiter
 * Requires: Recruiter authentication (JWT token)
 * Supports filtering by status, pagination, and sorting
 * Note: This route must come before /:recruiterId/jobs to avoid route conflicts
 */


/**
 * GET /api/recruiters/:recruiterId/jobs
 * Get all job posts for a specific recruiter
 * Public endpoint - no authentication required
 * Supports filtering by status, pagination, and sorting
 * Note: This route should be last among job routes to avoid conflicts with more specific routes
 */
router.get("/:recruiterId/jobs", getRecruiterJobs);

export default router;

