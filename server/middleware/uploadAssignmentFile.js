const multer = require("multer");

const storage = multer.memoryStorage();

const allowedMimeTypes = [
    // PDF
    "application/pdf",

    // Microsoft Word
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",

    // Microsoft PowerPoint
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",

    // Microsoft Excel
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

    // Text
    "text/plain",

    // CSV
    "text/csv"
];

const fileFilter = (req, file, cb) => {
    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(
            new Error(
                "Unsupported file type. Please upload a PDF, Word, PowerPoint, Excel, TXT, or CSV file."
            ),
            false
        );
    }
};

const uploadAssignmentFile = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10 MB
    }
});

module.exports = uploadAssignmentFile;