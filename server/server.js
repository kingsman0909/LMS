require("dotenv").config();

const express = require("express");
const cors = require("cors");
const http = require("http");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");

const authRoutes = require("./routes/auth");
const { setIO } = require("./realtimeConn/socket");

const app = express();

const isDevelopment = process.env.DEVELOPMENT === "true";
const isDebugger = process.env.DEBUGGER === "true";


// EXPRESS CORS

app.use(cors({
    origin: isDebugger || isDevelopment
        ? true
        : process.env.CLIENT_URL,
    credentials: true
}));


app.use(express.json());

app.use("/api/auth", authRoutes);


// HTTP SERVER

const server = http.createServer(app);


// SOCKET.IO

const io = new Server(server, {
    cors: {
        origin: isDebugger || isDevelopment
            ? true
            : process.env.CLIENT_URL,
        methods: ["GET", "POST"],
        credentials: true
    }
});


// Make Socket.IO available to services

setIO(io);


// SOCKET AUTHENTICATION

io.use((socket, next) => {

    const token = socket.handshake.auth.token;

    if (!token) {

        return next(
            new Error("Authentication required")
        );

    }


    try {

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );


        socket.user = decoded.user;


        if (!socket.user) {

            return next(
                new Error("Invalid token")
            );

        }


        if (socket.user.role !== "admin") {

            return next(
                new Error("Admin access required")
            );

        }


        next();

    } catch (error) {

        return next(
            new Error("Invalid token")
        );

    }

});

// SOCKET CONNECTION

io.on("connection", (socket) => {

    console.log(
        "Admin socket connected:",
        socket.id
    );

    // Only allow authenticated admins
    if (socket.user?.role !== "admin") {

        console.log(
            "Non-admin socket rejected:",
            socket.id
        );

        socket.disconnect(true);

        return;
    }

    const adminId =
        socket.user.id;

    // Global admin room
    socket.join("admins");

    // Personal admin room
    socket.join(
        `admin:${adminId}`
    );

    console.log(
        "Admin joined rooms:",
        {
            socketId: socket.id,
            adminId,
            rooms: [
                "admins",
                `admin:${adminId}`
            ]
        }
    );

    // IMPORTANT:
    // If bulk approval is already running
    // when this admin connects/reconnects,
    // immediately tell this admin.
    const {
        getBulkApprovalStatus
    } = require(
        "./services/authService"
    );

    const bulkStatus =
        getBulkApprovalStatus();

    if (bulkStatus.isApproving) {

        socket.emit(
            "bulk_approval_status",
            {
                isApproving: true,
                adminId:
                    bulkStatus.adminId
            }
        );

    }

    socket.on("disconnect", () => {

        console.log(
            "Admin socket disconnected:",
            socket.id
        );

    });

});

const PORT = process.env.PORT || 3000;


server.listen(PORT, "0.0.0.0", () => {

    console.log(
        `Server is running on port ${PORT} and client URL: ${process.env.CLIENT_URL}`
    );

});