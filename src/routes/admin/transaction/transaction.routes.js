import { Router } from "express";
import { getAllTransactions } from "../../../controllers/admin/transaction/transaction.controller.js";
import { verifyJWT } from "../../../middlewares/authMiddleware.js";

const router = Router();

// Protect all routes with Admin role
router.use(verifyJWT(["Admin"]));

// Get all transactions
router.get("/", getAllTransactions);

export default router;
