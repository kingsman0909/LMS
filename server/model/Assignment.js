const db = require("../config/db");

/*
|--------------------------------------------------------------------------
| CREATE
|--------------------------------------------------------------------------
*/

const createAssignment = async (data) => {
    const {
        professor_id,
        subject_id,
        section_id,
        title,
        description,
        file_path,
        points,
        due_date,
        status = "open"
    } = data;

    const [result] = await db.query(
        `
        INSERT INTO assignments
        (
            professor_id,
            subject_id,
            section_id,
            title,
            description,
            file_path,
            points,
            due_date,
            status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
            professor_id,
            subject_id,
            section_id,
            title,
            description || null,
            file_path || null,
            points || 0,
            due_date,
            status
        ]
    );

    return {
        id: result.insertId,
        professor_id,
        subject_id,
        section_id,
        title,
        description: description || null,
        file_path: file_path || null,
        points: points || 0,
        due_date,
        status
    };
};


/*
|--------------------------------------------------------------------------
| GET ALL
|--------------------------------------------------------------------------
*/

const getAssignments = async () => {

    const [rows] = await db.query(
        `
        SELECT
            a.*,

            CONCAT(
                p.firstname,
                ' ',
                p.lastname
            ) AS professor_name,

            s.subject_code,
            s.subject_name,

            sec.section_name

        FROM assignments a

        LEFT JOIN profesor p
            ON a.professor_id = p.id

        LEFT JOIN subjects s
            ON a.subject_id = s.id

        LEFT JOIN sections sec
            ON a.section_id = sec.id

        ORDER BY a.created_at DESC
        `
    );

    return rows;
};


/*
|--------------------------------------------------------------------------
| GET BY ID
|--------------------------------------------------------------------------
*/

const getAssignmentById = async (id) => {

    const [rows] = await db.query(
        `
        SELECT
            a.*,

            CONCAT(
                p.firstname,
                ' ',
                p.lastname
            ) AS professor_name,

            s.subject_code,
            s.subject_name,

            sec.section_name

        FROM assignments a

        LEFT JOIN profesor p
            ON a.professor_id = p.id

        LEFT JOIN subjects s
            ON a.subject_id = s.id

        LEFT JOIN sections sec
            ON a.section_id = sec.id

        WHERE a.id = ?
        `,
        [id]
    );

    return rows[0] || null;
};


/*
|--------------------------------------------------------------------------
| GET BY PROFESSOR
|--------------------------------------------------------------------------
*/

const getAssignmentsByProfessor = async (professorId) => {

    const [rows] = await db.query(
        `
        SELECT
            a.*,

            s.subject_code,
            s.subject_name,

            sec.section_name

        FROM assignments a

        LEFT JOIN subjects s
            ON a.subject_id = s.id

        LEFT JOIN sections sec
            ON a.section_id = sec.id

        WHERE a.professor_id = ?

        ORDER BY a.due_date ASC
        `,
        [professorId]
    );

    return rows;
};


/*
|--------------------------------------------------------------------------
| GET BY SECTION + SUBJECT
|--------------------------------------------------------------------------
*/

const getAssignmentsBySectionAndSubject = async (
    sectionId,
    subjectId
) => {

    const [rows] = await db.query(
        `
        SELECT
            a.*,

            s.subject_code,
            s.subject_name,

            sec.section_name

        FROM assignments a

        LEFT JOIN subjects s
            ON a.subject_id = s.id

        LEFT JOIN sections sec
            ON a.section_id = sec.id

        WHERE
            a.section_id = ?
            AND a.subject_id = ?

        ORDER BY a.due_date ASC
        `,
        [
            sectionId,
            subjectId
        ]
    );

    return rows;
};


/*
|--------------------------------------------------------------------------
| UPDATE
|--------------------------------------------------------------------------
*/

const updateAssignment = async (id, data) => {

    const {
        subject_id,
        section_id,
        title,
        description,
        file_path,
        points,
        due_date,
        status
    } = data;

    const [result] = await db.query(
        `
        UPDATE assignments

        SET
            subject_id = ?,
            section_id = ?,
            title = ?,
            description = ?,
            file_path = ?,
            points = ?,
            due_date = ?,
            status = ?

        WHERE id = ?
        `,
        [
            subject_id,
            section_id,
            title,
            description || null,
            file_path || null,
            points || 0,
            due_date,
            status,
            id
        ]
    );

    return result.affectedRows > 0;
};


/*
|--------------------------------------------------------------------------
| UPDATE STATUS
|--------------------------------------------------------------------------
*/

const updateAssignmentStatus = async (
    id,
    status
) => {

    const [result] = await db.query(
        `
        UPDATE assignments

        SET status = ?

        WHERE id = ?
        `,
        [
            status,
            id
        ]
    );

    return result.affectedRows > 0;
};


/*
|--------------------------------------------------------------------------
| DELETE
|--------------------------------------------------------------------------
*/

const deleteAssignment = async (id) => {

    const [result] = await db.query(
        `
        DELETE FROM assignments
        WHERE id = ?
        `,
        [id]
    );

    return result.affectedRows > 0;
};


/*
|--------------------------------------------------------------------------
| GET ASSIGNMENTS BY SECTION + SUBJECT
|--------------------------------------------------------------------------
*/

const getStudentAssignments = async (
    sectionId,
    subjectId = null
) => {

    let query = `
        SELECT
            a.*,

            CONCAT(
                p.firstname,
                ' ',
                p.lastname
            ) AS professor_name,

            s.subject_code,
            s.subject_name,

            sec.section_name

        FROM assignments a

        LEFT JOIN profesor p
            ON a.professor_id = p.id

        LEFT JOIN subjects s
            ON a.subject_id = s.id

        LEFT JOIN sections sec
            ON a.section_id = sec.id

        WHERE a.section_id = ?
    `;

    const values = [sectionId];

    // If a specific subject is selected,
    // add subject filtering.
    if (subjectId) {
        query += `
            AND a.subject_id = ?
        `;

        values.push(subjectId);
    }

    query += `
        ORDER BY a.due_date ASC
    `;

    const [rows] = await db.query(
        query,
        values
    );

    return rows;
};

/*
|--------------------------------------------------------------------------
| EXPORT
|--------------------------------------------------------------------------
*/

module.exports = {
    createAssignment,
    getAssignments,
    getStudentAssignments,
    getAssignmentById,
    getAssignmentsByProfessor,
    getAssignmentsBySectionAndSubject,
    updateAssignment,
    updateAssignmentStatus,
    deleteAssignment
};