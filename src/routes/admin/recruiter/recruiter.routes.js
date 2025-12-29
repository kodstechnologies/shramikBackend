import { Router } from "express";
import {
    getRecruiterStats,
    getRecruiterActivity,
    getAllRecruiters,
    getRecruiterDetails,
    blockRecruiter,
    unblockRecruiter,
    blockJob,
    unblockJob,
} from "../../../controllers/admin/recruiter/recruiter.controller.js";
import { verifyJWT } from "../../../middlewares/authMiddleware.js";

const router = Router();

// Protect all routes with admin authentication
router.use(verifyJWT());

/**
 * @route   GET /api/admin/recruiters/stats
 * @desc    Get recruiter performance stats (Active, Open Positions, Interviews, Hires)
 * @access  Admin
 * @query   startDate, endDate - Optional date range filter
 */
router.get("/stats", getRecruiterStats);

/**
 * @route   GET /api/admin/recruiters/activity
 * @desc    Get recruiter activity snapshot with pagination
 * @access  Admin
 * @query   page, limit - Pagination
 * @query   startDate, endDate - Optional date range filter
 */
router.get("/activity", getRecruiterActivity);

/**
 * @route   GET /api/admin/recruiters/all
 * @desc    Get all recruiters with comprehensive filters
 * @access  Admin
 * @query   page, limit - Pagination
 * @query   search - Search by company name, name, phone, email
 * @query   status - Filter by status
 * @query   isBlocked - Filter by blocked status
 */
router.get("/all", getAllRecruiters);

/**
 * @route   GET /api/admin/recruiters/:id/details
 * @desc    Get recruiter details with all their jobs
 * @access  Admin
 * @param   id - Recruiter ID
 */
router.get("/:id/details", getRecruiterDetails);

/**
 * @route   POST /api/admin/recruiters/:id/block
 * @desc    Block a recruiter
 * @access  Admin
 * @body    reason - Optional reason for blocking
 */
router.post("/:id/block", blockRecruiter);

/**
 * @route   POST /api/admin/recruiters/:id/unblock
 * @desc    Unblock a recruiter
 * @access  Admin
 */
router.post("/:id/unblock", unblockRecruiter);

/**
 * @route   POST /api/admin/recruiters/jobs/:jobId/block
 * @desc    Block a job
 * @access  Admin
 */
router.post("/jobs/:jobId/block", blockJob);

/**
 * @route   POST /api/admin/recruiters/jobs/:jobId/unblock
 * @desc    Unblock a job
 * @access  Admin
 */
router.post("/jobs/:jobId/unblock", unblockJob);

export default router;
