import { Router } from "express";
import {
  getJobsWithApplications,
  getJobApplicants,
  getApplicantFilterOptions,
  shortlistApplicant,
  rejectApplicant,
  getJobsWithShortlistedCandidates,
  getShortlistedApplicantsForJob,
  getAllShortlistedCandidates,
} from "../../../controllers/recruiter/application/application.controller.js";
import { verifyRecruiterJWT } from "../../../middlewares/recruiter/authRecruiter.js";

const router = Router();

/**
 * GET /api/recruiters/jobs/applications
 * Get all applications from job seekers for jobs created by the recruiter
 * Query params: jobStatus (optional), applicationStatus (optional), page (default: 1), limit (default: 10), sortBy, sortOrder
 * Requires: Recruiter authentication (JWT token)
 */
router.get("/jobs/applications", verifyRecruiterJWT, getJobsWithApplications);

/**
 * GET /api/recruiters/jobs/:jobId/applicants
 * Get all applicants for a specific job post
 * Query params: status (optional), page (default: 1), limit (default: 10), sortBy, sortOrder
 * Requires: Recruiter authentication (JWT token)
 */

router.get("/applications/shortlisted", verifyRecruiterJWT, getAllShortlistedCandidates);
router.get("/jobs/:jobId/applicants", verifyRecruiterJWT, getJobApplicants);

/**
 * GET /api/recruiters/jobs/:jobId/filter-options
 * Get dynamic filter options (cities, genders, experience, age ranges) based on actual applicants
 * Returns only values that exist among applicants for this job
 * Requires: Recruiter authentication (JWT token)
 */
router.get("/jobs/:jobId/filter-options", verifyRecruiterJWT, getApplicantFilterOptions);

router.get(
  "/jobs/with-shortlisted",
  verifyRecruiterJWT,
  getJobsWithShortlistedCandidates
);

router.get(
  "/jobs/:jobId/shortlisted",
  verifyRecruiterJWT,
  getShortlistedApplicantsForJob
);

/**
 * PATCH /api/recruiters/applications/:applicationId/shortlist
 * Shortlist an applicant (update application status to "Shortlisted")
 * Body: { notes: string (optional) }
 * Requires: Recruiter authentication (JWT token)
 */
router.patch("/applications/:applicationId/shortlist", verifyRecruiterJWT, shortlistApplicant);

/**
 * PATCH /api/recruiters/applications/:applicationId/reject
 * Reject an applicant (update application status to "Rejected")
 * Body: { notes: string (optional) }
 * Requires: Recruiter authentication (JWT token)
 */
router.patch("/applications/:applicationId/reject", verifyRecruiterJWT, rejectApplicant);

export default router;

