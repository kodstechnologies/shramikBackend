import { Router } from "express";
import {
    getDashboardStats,
    getUserDistribution,
    getRecentTransactions,
    getDashboardAnalytics,
} from "../../../controllers/admin/dashboard/dashboard.controller.js";
import { verifyJWT } from "../../../middlewares/authMiddleware.js";

const router = Router();

// All routes require admin authentication
router.use(verifyJWT());

/**
 * @route   GET /api/admin/dashboard/stats
 * @desc    Get dashboard key metrics (total users, recruiters, active jobs)
 * @access  Admin
 */
router.get("/stats", getDashboardStats);

/**
 * @route   GET /api/admin/dashboard/user-distribution
 * @desc    Get user distribution by category (for pie chart)
 * @access  Admin
 */
router.get("/user-distribution", getUserDistribution);

/**
 * @route   GET /api/admin/dashboard/recent-transactions
 * @desc    Get recent coin transactions
 * @access  Admin
 */
router.get("/recent-transactions", getRecentTransactions);

/**
 * @route   GET /api/admin/dashboard/analytics
 * @desc    Get dashboard analytics graph data
 * @access  Admin
 */
router.get("/analytics", getDashboardAnalytics);

export default router;
