
import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const verifyJWT = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new ApiError(401, "Unauthorized request");
  }

  const token = authHeader.split(" ")[1];

  const decodedToken = jwt.verify(
    token,
    process.env.ACCESS_TOKEN_SECRET
  );

  const user = await User.findById(decodedToken._id)
    .select("-password");

  if (!user) {
    throw new ApiError(401, "Invalid access token");
  }

  req.user = user;
  next();
});
