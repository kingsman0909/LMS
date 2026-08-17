const db = require("../config/db");


// Create student profile
const createStudent = async (student, section_id) => {

    const sql = `
        INSERT INTO student (
            user_id,
            student_id,
            firstname,
            middlename,
            lastname,
            course,
            year_level,
            section_id,
            phone,
            gender,
            birthdate,
            address,
            profile_picture
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await db.query(sql, [

        student.user_id,

        student.student_id,

        student.firstname,

        student.middlename,

        student.lastname,

        student.course_name,

        student.year_level,

        section_id,

        student.phone,

        student.gender,

        student.birthdate,

        student.address,

        student.profile_picture

    ]);

    return result;
};


// Find student by user ID
const findByUserId = async (userId) => {

    const [rows] = await db.query(
        `
        SELECT *
        FROM student
        WHERE user_id = ?
        `,
        [userId]
    );

    return rows[0];
};


// Find student by student ID
const findByStudentId = async (studentId) => {

    const [rows] = await db.query(
        `
        SELECT *
        FROM student
        WHERE student_id = ?
        `,
        [studentId]
    );

    return rows[0];
};


// Get complete student profile
const getStudentWithUser = async (userId) => {

    const [rows] = await db.query(
        `
        SELECT

            users.id AS user_id,
            users.email,
            users.username,
            users.role,
            users.status,

            student.id AS student_id,
            student.student_id AS school_student_id,
            student.firstname,
            student.middlename,
            student.lastname,
            student.course,
            student.year_level,
            student.section,
            student.phone,
            student.gender,
            student.birthdate,
            student.address,
            student.profile_picture

        FROM users

        INNER JOIN student
            ON users.id = student.user_id

        WHERE users.id = ?
        `,
        [userId]
    );

    return rows[0];
};

const getAllStudent = async () => {

    const [rows] = await db.query(`
        SELECT
            users.id AS user_id,
            users.email,
            users.username,
            users.role,
            users.status,

            student.*

        FROM users

        INNER JOIN student
            ON users.id = student.user_id

        WHERE users.role = 'student'
    `);

    return rows;
};

module.exports = {

    createStudent,

    findByUserId,

    findByStudentId,

    getStudentWithUser,
    getAllStudent

};