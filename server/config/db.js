const mysql = require('mysql2/promise');

const db = mysql.createPool({
    host: "localhost",
    user: "root",
    password: "ken_09096068957",
    database: "lms_db"
});

console.log("MySQL pool created");

module.exports = db;