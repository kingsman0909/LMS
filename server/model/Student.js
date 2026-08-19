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

const getAllStudent = async (
    page = 1,
    limit = 50,
    search = ""
) => {

    const offset = (page - 1) * limit;

    const searchValue = `%${search}%`;

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

        AND (
            student.firstname LIKE ?
            OR student.lastname LIKE ?
            OR student.student_id LIKE ?
            OR users.email LIKE ?
        )

        ORDER BY student.id

        LIMIT ? OFFSET ?
    `, [
        searchValue,
        searchValue,
        searchValue,
        searchValue,
        limit,
        offset
    ]);


    // GET TOTAL
    const [[countResult]] = await db.query(`
        SELECT COUNT(*) AS total

        FROM users

        INNER JOIN student
            ON users.id = student.user_id

        WHERE users.role = 'student'

        AND (
            student.firstname LIKE ?
            OR student.lastname LIKE ?
            OR student.student_id LIKE ?
            OR users.email LIKE ?
        )
    `, [
        searchValue,
        searchValue,
        searchValue,
        searchValue
    ]);


    const total = countResult.total;


    return {
        students: rows,
        total,
        page,
        limit,
        hasMore: offset + rows.length < total
    };
};

const getTotalStudents = async () => {

    const [[result]] = await db.query(`
        SELECT COUNT(*) AS totalStudents
        FROM users
        where role = "student"
    `);

    return result.totalStudents;
};

// =====================================================
// GET STUDENTS HANDLED BY PROFESSOR
// =====================================================
const getProfStudents = async (
    academicTermId,
    professorId
) => {

    console.log("PARAMS:", professorId, academicTermId);

    const [rows] = await db.query(`
        SELECT DISTINCT

            u.id AS user_id,
            u.email,
            u.username,
            u.status,

            st.id AS student_id,
            st.student_id AS school_student_id,

            st.firstname,
            st.middlename,
            st.lastname,

            st.course,
            st.year_level,

            sec.id AS section_id,
            sec.section_name,

            sec.program_id,

            at.school_year,
            at.semester

        FROM class_schedules cs

        INNER JOIN sections sec
            ON cs.section_id = sec.id

        INNER JOIN student_enrollments se
            ON se.section_id = sec.id

        INNER JOIN student st
            ON st.id = se.student_id

        INNER JOIN users u
            ON u.id = st.user_id

        INNER JOIN academic_terms at
            ON at.id = sec.academic_term_id

        WHERE cs.professor_id = ?
          AND cs.academic_term_id = ?
          AND se.status = 'approved'
          AND u.role = 'student'

        ORDER BY
            sec.section_name,
            st.lastname,
            st.firstname

    `, [professorId, academicTermId]);

    console.log("STUDENTS FROM NODE:", rows);

    return rows;
};
module.exports = {

    getProfStudents,
    createStudent,

    findByUserId,

    findByStudentId,

    getStudentWithUser,
    getAllStudent,
    getTotalStudents

};