import multer from "multer";
import { AppError } from "./errors.js";
import { HTTP_STATUS } from "../constants/index.js";

const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB maximum file size
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new AppError("Only image files are allowed", HTTP_STATUS.BAD_REQUEST));
    }
  },
});
