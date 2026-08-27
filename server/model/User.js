const db = require("../config/db");
// Find user by username
const findByUsername = async (username) => {
    console.log("logging in")
    const [userRows] = await db.query(
        `
        SELECT *
        FROM users
        WHERE username = ?
        `,
        [username]
    );

    const user = userRows[0];
    console.log("user: ", user)
    if (!user) {
        return null;
    }

    let profile = null;

    if (user.role === 'student') {

        const [studentRows] = await db.query(
            `
            SELECT *
            FROM student
            WHERE user_id = ?
            `,
            [user.id]
        );

        profile = studentRows[0];

    } else if (user.role === 'professor') {

        const [professorRows] = await db.query(
            `
            SELECT *
            FROM profesor
            WHERE user_id = ?
            `,
            [user.id]
        );

        profile = professorRows[0];
    }

    else if (user.role === "admin"){
        
        profile = {
            name: "admin",
            role: "admin",
            privilege: "admin access"
        };
    }

    return {
        user,
        profile
    };
};


// Find user by email
const findByEmail = async (email) => {

    const [rows] = await db.query(
        `
        SELECT *
        FROM users
        WHERE email = ?
        `,
        [email]
    );

    return rows[0];
};


// Create user account
const createUser = async (user) => {

    const sql = `
        INSERT INTO users (
            email,
            username,
            password,
            role,
            status
        )
        VALUES (?, ?, ?, ?, ?)
    `;

    const [result] = await db.query(sql, [

        user.email,

        user.username,

        user.password,

        user.role,

        user.status

    ]);

    return result;
};


// Find user by ID
const findById = async (userId) => {

    const [rows] = await db.query(
        `
        SELECT *
        FROM users
        WHERE id = ?
        `,
        [userId]
    );

    return rows[0];
};


module.exports = {

    findByUsername,

    findByEmail,

    createUser,

    findById

};