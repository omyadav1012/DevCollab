
import crypto from "node:crypto";

const hashToken = (token) => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

export { hashToken };
