const db = require("../config/db");

const YEAR_LEVELS = {
    1: "1st Year",
    2: "2nd Year",
    3: "3rd Year",
    4: "4th Year"
};

const SEMESTERS = {
    1: "1st Semester",
    2: "2nd Semester",
    3: "Summer"
};

const Curriculum = {

    // =========================================================
    // GET CURRICULUM
    // =========================================================

    getCurriculum: async ({
        programId,
        yearLevel = null,
        semester = null
    }) => {

        let query = `
            SELECT
                cs.id AS id,
                cs.program_id,
                cs.subject_id,
                cs.year_level,
                cs.semester,

                s.subject_code,
                s.subject_name,
                s.lecture_units,
                s.lab_units

            FROM curriculum_subjects cs

            INNER JOIN subjects s
                ON s.id = cs.subject_id

            WHERE cs.program_id = ?
        `;

        const params = [
            programId
        ];

        // =====================================================
        // YEAR LEVEL
        // =====================================================

        if (yearLevel !== null && yearLevel !== "") {

            const normalizedYear =
                YEAR_LEVELS[Number(yearLevel)] ||
                yearLevel;

            query += `
                AND cs.year_level = ?
            `;

            params.push(
                normalizedYear
            );
        }

        // =====================================================
        // SEMESTER
        // =====================================================

        if (semester !== null && semester !== "") {

            const normalizedSemester =
                SEMESTERS[Number(semester)] ||
                semester;

            query += `
                AND cs.semester = ?
            `;

            params.push(
                normalizedSemester
            );
        }

        // =====================================================
        // ORDER
        // =====================================================

        query += `
            ORDER BY
                FIELD(
                    cs.year_level,
                    '1st Year',
                    '2nd Year',
                    '3rd Year',
                    '4th Year'
                ),

                FIELD(
                    cs.semester,
                    '1st Semester',
                    '2nd Semester',
                    'Summer'
                ),

                s.subject_code
        `;

        console.log(
            "GET CURRICULUM PARAMS:",
            {
                programId,
                yearLevel,
                semester
            }
        );

        console.log(
            "GET CURRICULUM SQL PARAMS:",
            params
        );

        const [rows] =
            await db.query(
                query,
                params
            );

        return rows;
    },


    // =========================================================
    // ADD SUBJECT TO CURRICULUM
    // =========================================================

    addToCurriculum: async ({
        programId,
        subjectId,
        yearLevel,
        semester
    }) => {

        const normalizedYear =
            YEAR_LEVELS[Number(yearLevel)] ||
            yearLevel;

        const normalizedSemester =
            SEMESTERS[Number(semester)] ||
            semester;

        const [result] =
            await db.query(`
                INSERT INTO curriculum_subjects
                (
                    program_id,
                    subject_id,
                    year_level,
                    semester
                )
                VALUES (?, ?, ?, ?)
            `, [
                programId,
                subjectId,
                normalizedYear,
                normalizedSemester
            ]);

        return result;
    }

};

module.exports = Curriculum;