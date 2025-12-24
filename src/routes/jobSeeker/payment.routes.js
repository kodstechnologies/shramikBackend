import { Router } from "express";
import { verifyJobSeekerJWT } from "../../middlewares/jobSeeker/authJobSeeker.js";
import { jobSeekerPayment } from "../../controllers/jobSeeker/jobSeeker.payment.controller.js";


const router = Router();

router.post("/", verifyJobSeekerJWT, jobSeekerPayment);

export default router;
