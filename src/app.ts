import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import path from "path";
import { fileURLToPath } from "url";
import { env } from "./config/env.js";
import { globalLimiter } from "./middlewares/limiter.js";
import { requestId } from "./middlewares/requestId.js";
import router from "./routes/index.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { AppError } from "./utils/errors.js";
import { HTTP_STATUS } from "./constants/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// 1. View Engine Setup (EJS)
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "../views"));

app.use(requestId);

// 2. Global Security and Logging Middlewares
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      // Add other directives if necessary for your frontend
    },
  },
}));

app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// 3. Global Rate Limiting
app.use(globalLimiter);

// 4. API Routes Base Binding
app.use("/api/v1", router);

// 5. Unhandled Route Fallback
app.all("*", (req, res, next) => {
  next(
    new AppError(
      `Cannot find path ${req.originalUrl} on this server`,
      HTTP_STATUS.NOT_FOUND
    )
  );
});

// 6. Global Error Handling Middleware
app.use(errorHandler as any);

export { app };
export default app;
