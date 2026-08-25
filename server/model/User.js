const db = require("../config/db");

const loginTest = async (role) => {

    console.log("logintest")
    const [userRows] = await db.query(
        `
        SELECT *
        FROM users
        WHERE role = ?
        limit 1
        `,
        [role]
    );

    const user = userRows[0];

    if (!user) {
        return null;
    }

    let profile = null;

    if (role === 'student') {

        const [studentRows] = await db.query(
            `
            SELECT *
            FROM student
            WHERE user_id = ?
            `,
            [user.id]
        );

        profile = studentRows[0];

    } else if (role === 'professor') {

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

    else if (role === "admin"){
        profile = {
            name: "admin",
            role: "admin"
        };
    }

    console.log(user, profile)
    return {
        user,
        profile
    };
}
// Find user by username
const findByUsername = async (username) => {

    const [userRows] = await db.query(
        `
        SELECT *
        FROM users
        WHERE username = ?
        `,
        [username]
    );

    const user = userRows[0];

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
        const [adminRows] = await db.query(
            `
            SELECT * FROM admin
            WHERE user_id = ?
            `,[user.id]
        );

        profile = adminRows[0];
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

    loginTest,

    findByUsername,

    findByEmail,

    createUser,

    findById

};