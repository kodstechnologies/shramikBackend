import { User } from "../models/users.model.js";
import bcrypt from "bcryptjs";
import { sendOtpSMS } from "../services/smsService.js";
import { storeOTP, verifyOTP as verifyOTPFromService } from "../utils/otpService.js";

/* ---------------------------------------------------
   CREATE USER
--------------------------------------------------- */
export const createUser = async (req, res) => {
  try {
    const { name, email, phone, password, role } = req.body;

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: "User already exists" });

    const newUser = await User.create({ name, email, phone, password, role });

    res.status(201).json({ message: "User created successfully", user: newUser });
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/* ---------------------------------------------------
   GET ALL USERS
--------------------------------------------------- */
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password");
    res.status(200).json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/* ---------------------------------------------------
   GET SINGLE USER
--------------------------------------------------- */
export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json(user);
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/* ---------------------------------------------------
   UPDATE USER
--------------------------------------------------- */
export const updateUser = async (req, res) => {
  try {
    if (req.body?.password) {
      const salt = await bcrypt.genSalt(10);
      req.body.password = await bcrypt.hash(req.body.password, salt);
    }

    const updatedUser = await User.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    }).select("-password");

    if (!updatedUser) return res.status(404).json({ message: "User not found" });

    res.status(200).json({ message: "User updated successfully", user: updatedUser });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/* ---------------------------------------------------
   DELETE USER
--------------------------------------------------- */
export const deleteUser = async (req, res) => {
  try {
    const deleted = await User.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "User not found" });

    res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/* ---------------------------------------------------
   LOGIN USING OTP
--------------------------------------------------- */

// Step 1 - Request OTP
export const requestOtp = async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ message: "Phone is required" });
    }

    const user = await User.findOne({ phone });

    if (!user) return res.status(404).json({ message: "User not found" });

    const purpose = "login";
    const otp = await storeOTP(phone, purpose);

    await sendOtpSMS({ number: phone, otp });

    const shouldReturnOTP =
      process.env.NODE_ENV === "development" ||
      process.env.RETURN_OTP_IN_RESPONSE === "true" ||
      otp === "1234";

    res.status(200).json({
      message: "OTP sent successfully",
      otp: shouldReturnOTP ? otp : undefined,
    });
  } catch (error) {
    console.error("Error requesting OTP:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Step 2 - Verify OTP
export const verifyOtp = async (req, res) => {
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({ message: "Phone and OTP are required" });
    }

    const isValid = await verifyOTPFromService(phone, otp, "login");
    if (!isValid) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    const user = await User.findOne({ phone }).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json({
      message: "Login successful",
      user,
    });
  } catch (error) {
    console.error("Error verifying OTP:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
