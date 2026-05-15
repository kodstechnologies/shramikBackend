// app.js
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";

import connectDB from "./src/config/db.js";
import ApiError from "./src/utils/ApiError.js";
import routes from "./src/routes/index.js";

import { seedDefaultAdmin } from "./src/seeders/seedAdmin.js";
import { seedCategories } from "./src/seeders/seedCategories.js";
import { seedRoles } from "./src/seeders/seedRoles.js";
import { seedStatesAndCities } from "./src/seeders/seedStatesAndCities.js";
import { seedJobMeta } from "./src/seeders/seedJobMeta.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, ".env") });

const app = express();

// --------------------------------------------------
// DB Initialization
// --------------------------------------------------
let dbInitialized = false;

async function initializeDB() {
  if (dbInitialized) return;

  await connectDB();

  // Run seeders on fresh database
  console.log("🌱 Running database seeders...");
  await seedDefaultAdmin();
  await seedCategories();
  await seedRoles();
  await seedStatesAndCities();
  await seedJobMeta();
  console.log("✅ All seeders completed!");

  dbInitialized = true;
}

// Initialize DB immediately when server starts
initializeDB()
  .then(() => {
    console.log("✅ Database initialized at server startup");
  })
  .catch((err) => {
    console.error("❌ Database initialization failed:", err);
    process.exit(1);
  });

// --------------------------------------------------
// CORS
// --------------------------------------------------
app.use(
  cors({
    origin: (origin, callback) => {
      const allowedOrigins = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:8080",
        "http://192.168.29.45:3000",
        "http://192.168.29.45:8080",
        "http://192.168.29.45:8000",
        "https://admin.shramikjobs.co.in",
        ...(process.env.CORS_ORIGIN?.split(",").map(o => o.trim()) || [])
      ];


      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn("🚫 Blocked by CORS:", origin);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

// --------------------------------------------------
// Middleware
// --------------------------------------------------
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(cookieParser());
app.use(express.static("public"));

// --------------------------------------------------
// Routes
// --------------------------------------------------
app.use("/", routes);

app.get("/test", (req, res) => {
  res.json({
    success: true,
    message: "Serverr is working!",
    timestamp: new Date().toISOString(),
  });
});


// --------------------------------------------------
// Global Error Handler
// --------------------------------------------------
app.use((err, req, res, next) => {
  console.error("❌ Error Details:", {
    message: err.message,
    name: err.name,
    stack: err.stack,
    url: req.url,
    method: req.method,
  });

  // Multer errors
  if (err instanceof multer.MulterError) {
    return res.status(413).json({
      success: false,
      message: err.message,
      data: null,
      meta: null,
    });
  }

  // Custom API errors
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      data: null,
      meta: err.meta || null,
    });
  }

  // Fallback
  res.status(500).json({
    success: false,
    message: "Internal Server Error",
    data:
      process.env.NODE_ENV === "development"
        ? { error: err.message }
        : null,
    meta: null,
  });
});

export default app;
