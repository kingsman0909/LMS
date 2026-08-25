require("dotenv").config();

const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");

const app = express();

const isDevelopment = process.env.DEVELOPMENT === "true";
const isDebugger = process.env.DEBUGGER === "true";

app.use(cors({
    origin: isDebugger || isDevelopment
        ? true
        : process.env.CLIENT_URL,
    credentials: true
}));

app.use(express.json());

app.use("/api/auth", authRoutes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
    console.log(
        `Server is running on port ${PORT} and client URL: ${process.env.CLIENT_URL}`
    );
});
