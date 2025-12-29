import { Router } from "express";
import {
    getJobSeekerStats,
    getTopJobSeekers,
    getJobSeekerCategories,
    getAllJobSeekers,
    getJobSeekerDetails,
    blockJobSeeker,
    unblockJobSeeker,
} from "../../../controllers/admin/jobSeeker/jobSeeker.controller.js";
import { verifyJWT } from "../../../middlewares/authMiddleware.js";

const router = Router();

// Protect all routes with admin authentication
router.use(verifyJWT());

/**
 * @route   GET /api/admin/job-seekers/stats
 * @desc    Get job seeker insights stats (Active Profiles, Interviews, Offers, Skills)
 * @access  Admin
 * @query   startDate, endDate - Optional date range filter
 */
router.get("/stats", getJobSeekerStats);

/**
 * @route   GET /api/admin/job-seekers/top
 * @desc    Get top job seekers with pagination and filtering
 * @access  Admin
 * @query   page, limit - Pagination
 * @query   category - Filter by category
 * @query   startDate, endDate - Optional date range filter
 */
router.get("/top", getTopJobSeekers);

/**
 * @route   GET /api/admin/job-seekers/all
 * @desc    Get all job seekers with comprehensive filters
 * @access  Admin
 * @query   page, limit - Pagination
 * @query   search - Search by name, phone, email
 * @query   status - Filter by status
 * @query   isBlocked - Filter by blocked status
 * @query   category - Filter by category
 */
router.get("/all", getAllJobSeekers);

/**
 * @route   GET /api/admin/job-seekers/categories
 * @desc    Get list of categories for filter dropdown
 * @access  Admin
 */
router.get("/categories", getJobSeekerCategories);

/**
 * @route   GET /api/admin/job-seekers/:id/details
 * @desc    Get job seeker details with all their applications
 * @access  Admin
 * @param   id - Job Seeker ID
 */
router.get("/:id/details", getJobSeekerDetails);

/**
 * @route   POST /api/admin/job-seekers/:id/block
 * @desc    Block a job seeker
 * @access  Admin
 * @body    reason - Optional reason for blocking
 */
router.post("/:id/block", blockJobSeeker);

/**
 * @route   POST /api/admin/job-seekers/:id/unblock
 * @desc    Unblock a job seeker
 * @access  Admin
 */
router.post("/:id/unblock", unblockJobSeeker);

export default router;
