
import "dotenv/config";
import express from "express";
import connectDB from "./config/db.js";
import userRouter from "./routes/user.routes.js";
import { errorMiddleware } from "./middlewares/error.middleware.js";

const app = express();

app.use(express.json());

// Health check route
app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
});

// User routes
app.use("/api/v1/users", userRouter);
app.use(errorMiddleware);

const PORT = process.env.PORT || 5000;

const startServer = async () => {
    await connectDB();

    app.listen(PORT, () => {
        console.log(`Server is running at ${PORT}`);
    });
};

startServer();
