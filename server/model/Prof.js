const db = require("../config/db");


// =========================================================
// FIND PROFESSOR BY USERNAME
// =========================================================

const findByUsername = async (username) => {

    const [rows] = await db.query(
        `
        SELECT
            p.*,

            d.id AS department_id,
            d.department_code,
            d.department_name,
            d.description AS department_description,
            d.status AS department_status,

            COALESCE(
                (
                    SELECT JSON_ARRAYAGG(
                        JSON_OBJECT(
                            'id', pr.id,
                            'program_code', pr.program_code,
                            'program_name', pr.program_name,
                            'description', pr.description,
                            'status', pr.status
                        )
                    )
                    FROM programs pr
                    WHERE pr.department_id = d.id
                      AND pr.status = 'active'
                ),
                JSON_ARRAY()
            ) AS programs

        FROM profesor p

        INNER JOIN users u
            ON u.id = p.user_id

        LEFT JOIN departments d
            ON d.id = p.department_id

        WHERE u.username = ?

        LIMIT 1
        `,
        [username]
    );

    if (!rows[0]) {
        return null;
    }

    return {
        ...rows[0],

        programs:
            typeof rows[0].programs === "string"
                ? JSON.parse(rows[0].programs)
                : rows[0].programs || []
    };
};


// =========================================================
// GET ALL PROFESSORS
// =========================================================

const getSingleProfessor = async (id) => {
    
    const [rows] = await db.query(`
            SELECT
                p.id AS professor_id,
                p.firstname,
                p.middlename,
                p.lastname,

                d.id AS department_id,
                d.department_code,
                d.department_name,
                d.description AS department_description,
                d.status AS department_status,

                COALESCE(
                    (
                        SELECT JSON_ARRAYAGG(
                            JSON_OBJECT(
                                'id', s.id,
                                'subject_code', s.subject_code,
                                'subject_name', s.subject_name,
                                'lecture_units', s.lecture_units,
                                'lab_units', s.lab_units
                            )
                        )
                        FROM professor_subjects ps
                        INNER JOIN subjects s
                            ON s.id = ps.subject_id
                        WHERE ps.professor_id = p.id
                    ),
                    JSON_ARRAY()
                ) AS assigned_subjects,

                (
                    SELECT COUNT(*)
                    FROM professor_subjects ps
                    WHERE ps.professor_id = p.id
                ) AS assigned_subject_count

            FROM profesor p

            LEFT JOIN departments d
                ON d.id = p.department_id

            WHERE p.id = ?;
        `, [id]);

        if(rows.length === 0){
            return null;
        }

        return rows[0];
}

const getProfessor = async () => {

    const [rows] = await db.query(
        `
        SELECT
            p.*,

            d.id AS department_id,
            d.department_code,
            d.department_name,
            d.description AS department_description,
            d.status AS department_status,

            /*
            |--------------------------------------------------------------------------
            | TOTAL ASSIGNED SUBJECTS
            |--------------------------------------------------------------------------
            */

            (
                SELECT COUNT(*)
                FROM professor_subjects ps
                WHERE ps.professor_id = p.id
            ) AS assigned_subject_count,

            /*
            |--------------------------------------------------------------------------
            | ASSIGNED PROGRAMS
            |--------------------------------------------------------------------------
            */

            COALESCE(
                (
                    SELECT JSON_ARRAYAGG(
                        JSON_OBJECT(
                            'id', pr.id,
                            'program_code', pr.program_code,
                            'program_name', pr.program_name,
                            'description', pr.description,
                            'status', pr.status
                        )
                    )
                    FROM programs pr
                    WHERE pr.department_id = d.id
                      AND pr.status = 'active'
                ),
                JSON_ARRAY()
            ) AS programs

        FROM profesor p

        LEFT JOIN departments d
            ON d.id = p.department_id

        ORDER BY
            d.department_name ASC,
            p.lastname ASC,
            p.firstname ASC
        `
    );

    return rows.map(professor => ({
        ...professor,

        assigned_subject_count:
            Number(professor.assigned_subject_count || 0),

        programs:
            typeof professor.programs === "string"
                ? JSON.parse(professor.programs)
                : professor.programs || []
    }));
};

// =========================================================
// ASSIGN MULTIPLE SUBJECTS TO PROFESSOR
// =========================================================

const assignSubjectsToProfessor = async (professorId, subjectIds) => {

    if (!professorId) {
        throw new Error("Professor ID is required");
    }

    if (!Array.isArray(subjectIds) || subjectIds.length === 0) {
        throw new Error("At least one subject ID is required");
    }

    // Remove duplicates from the request
    const uniqueSubjectIds = [
        ...new Set(
            subjectIds
                .map(Number)
                .filter(id => Number.isInteger(id) && id > 0)
        )
    ];

    if (uniqueSubjectIds.length === 0) {
        throw new Error("No valid subject IDs provided");
    }

    const values = uniqueSubjectIds.map(subjectId => [
        professorId,
        subjectId
    ]);

    const [result] = await db.query(
        `
        INSERT IGNORE INTO professor_subjects
            (professor_id, subject_id)
        VALUES ?
        `,
        [values]
    );

    return {
        insertedCount: result.affectedRows,
        subjectIds: uniqueSubjectIds
    };
};




module.exports = {
    findByUsername,
    getProfessor,
    assignSubjectsToProfessor,
    getSingleProfessor
};