const db = require("../config/db");

const findByUsername = async (username) => {
    const [rows] = await db.query(
        "SELECT * FROM profesor WHERE username = ?",
        [username]
    );

    return rows[0];
};

const getProfessor = async () => {
    const [rows] = await db.query(
        "SELECT * FROM profesor"
    );

    return rows;
};

module.exports = {
    findByUsername,
    getProfessor
};