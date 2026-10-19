
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { hashToken } from "../utils/hashToken.js";
import { generateResetToken } from "../utils/generateResetToken.js";
import { sendEmail } from "../utils/sendEmail.js";
import jwt from "jsonwebtoken";


const registerUser = asyncHandler(async (req, res) => {
  const { fullName, email, username, password } = req.body;

  if (
    [fullName, email, username, password].some(
      (field) => typeof field !== "string" || !field.trim()
    )
  ) {
    throw new ApiError(400, "All fields are required");
  }

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedUsername = username.trim().toLowerCase();

  const existedUser = await User.findOne({
    $or: [
      { username: normalizedUsername },
      { email: normalizedEmail }
    ]
  });

  if (existedUser) {
    throw new ApiError(409, "Username or email already exists");
  }

  const user = await User.create({
    fullName: fullName.trim(),
    email: normalizedEmail,
    username: normalizedUsername,
    password
  });

  const createdUser = await User.findById(user._id).select("-password");

  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while creating the user");
  }

  return res.status(201).json(
    new ApiResponse(201, createdUser, "User registered successfully")
  );
});

const loginUser = asyncHandler(async (req, res) => {
  const { email, username, password } = req.body;

  if ((!email && !username) || typeof password !== "string" || !password) {
    throw new ApiError(400, "Email or username and password are required");
  }

  const conditions = [];

  if (typeof email === "string" && email.trim()) {
    conditions.push({ email: email.trim().toLowerCase() });
  }

  if (typeof username === "string" && username.trim()) {
    conditions.push({ username: username.trim().toLowerCase() });
  }

  if (conditions.length === 0) {
    throw new ApiError(400, "A valid email or username is required");
  }

  const user = await User.findOne({ $or: conditions });

  if (!user) {
    throw new ApiError(401, "Invalid credentials");
  }

  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid credentials");
  }

  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();

user.refreshToken = hashToken(refreshToken);
await user.save({ validateBeforeSave: false });

  const loggedInUser = await User.findById(user._id).select("-password -refreshToken");

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        user: loggedInUser,
        accessToken,
        refreshToken
      },
      "User logged in successfully"
    )
  );
});

const getCurrentUser = asyncHandler(async (req, res) => {
  return res.status(200).json(
    new ApiResponse(
      200,
      req.user,
      "Current user fetched successfully"
    )
  );
});


const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        refreshToken: null
      }
    }
  );

  return res.status(200).json(
    new ApiResponse(200, {}, "User logged out successfully")
  );
});



const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken = req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, "Refresh token is required");
  }

  let decodedToken;

try {
  decodedToken = jwt.verify(
    incomingRefreshToken,
    process.env.REFRESH_TOKEN_SECRET
  );
} catch {
  throw new ApiError(401, "Invalid or expired refresh token");
}

if (!decodedToken._id) {
  throw new ApiError(401, "Invalid refresh token");
}

const user = await User.findById(decodedToken._id);

  if (!user || user.refreshToken !== hashToken(incomingRefreshToken)) {
    throw new ApiError(401, "Invalid refresh token");
  }

  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();

  user.refreshToken = hashToken(refreshToken);
  await user.save({ validateBeforeSave: false });

  return res.status(200).json(
    new ApiResponse(
      200,
      { accessToken, refreshToken },
      "Access token refreshed successfully"
    )
  );
});
const updateUserProfile = asyncHandler(async (req, res) => {
  const { fullName, username } = req.body;

  const normalizedUsername = username?.trim().toLowerCase();

  if (normalizedUsername) {
    const existingUser = await User.findOne({
      username: normalizedUsername
    });

    if (
      existingUser &&
      existingUser._id.toString() !== req.user._id.toString()
    ) {
      throw new ApiError(409, "Username already taken");
    }
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      ...(fullName !== undefined && { fullName: fullName.trim() }),
      ...(normalizedUsername !== undefined && {
        username: normalizedUsername
      })
    },
    { new: true, runValidators: true }
  ).select("-password -refreshToken");

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  return res.status(200).json(
    new ApiResponse(200, user, "Profile updated successfully")
  );
});  
const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    throw new ApiError(400, "Both passwords are required");
  }

  if (newPassword.length < 8) {
    throw new ApiError(
      400,
      "New password must be at least 8 characters"
    );
  }

  const user = await User.findById(req.user._id);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

  if (!isPasswordCorrect) {
    throw new ApiError(400, "Invalid current password");
  }

  user.password = newPassword;
  await user.save();

  return res.status(200).json(
    new ApiResponse(200, {}, "Password changed successfully")
  );
});



const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    throw new ApiError(400, "Email is required");
  }

  const user = await User.findOne({
    email: email.trim().toLowerCase()
  });

  if (!user) {
    return res.status(200).json(
      new ApiResponse(
        200,
        {},
        "If the account exists, password reset instructions will be sent"
      )
    );
  }

  const { resetToken, hashedToken } = generateResetToken();

  user.resetPasswordToken = hashedToken;
  user.resetPasswordExpiry = new Date(Date.now() + 10 * 60 * 1000);

  await user.save({ validateBeforeSave: false });

  const resetLink =
    `http://localhost:3000/reset-password?token=${resetToken}`;

  try {
    await sendEmail({
      to: user.email,
      subject: "DevCollab Password Reset",
      text: `Use this link to reset your password. This link expires in 10 minutes: ${resetLink}`,
      html: `
        <h2>Reset Your DevCollab Password</h2>
        <p>You requested to reset your password.</p>
        <p>This link expires in 10 minutes.</p>
        <a href="${resetLink}">Reset Password</a>
        <p>If you did not request this, you can ignore this email.</p>
      `
    });
  } catch (error) {
    console.error("Password reset email failed:", error.message);
    user.resetPasswordToken = null;
    user.resetPasswordExpiry = null;
    await user.save({ validateBeforeSave: false });

    throw new ApiError(500, "Unable to send password reset email");
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      {},
      "If the account exists, password reset instructions will be sent"
    )
  );
});


const resetPassword = asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body;

  if (
    typeof token !== "string" ||
    !token.trim() ||
    typeof newPassword !== "string" ||
    !newPassword
  ) {
    throw new ApiError(400, "Token and new password are required");
  }

  if (newPassword.length < 8) {
    throw new ApiError(
      400,
      "Password must be at least 8 characters"
    );
  }

  const hashedToken = hashToken(token.trim());

  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpiry: { $gt: new Date() }
  });

  if (!user) {
    throw new ApiError(400, "Invalid or expired reset token");
  }

  user.password = newPassword;
  user.refreshToken = null;
  user.resetPasswordToken = null;
  user.resetPasswordExpiry = null;

  await user.save();

  return res.status(200).json(
    new ApiResponse(200, {}, "Password reset successfully")
  );
});

export {
  registerUser,
  loginUser,
  getCurrentUser,
  refreshAccessToken,
  logoutUser,
  updateUserProfile,
  changeCurrentPassword,
  forgotPassword,
  resetPassword
};
