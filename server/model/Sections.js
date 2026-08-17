const db = require("../config/db");

const Section = {

    getSectionsForSchedule: async function(
    academicTermId
) {

    const [rows] = await db.query(`
        SELECT

            s.id,

            p.id AS program_id,
            p.program_code AS program,

            s.year_level AS year,
            s.section_name AS section,

            s.max_students AS maxStudents,

            COUNT(DISTINCT ss.student_id) AS students,

            COUNT(DISTINCT cs.subject_id) AS classes,

            CASE

                WHEN COUNT(DISTINCT cs.subject_id) = 0
                    THEN 'Pending'

                ELSE 'Scheduled'

            END AS status

        FROM sections s

        JOIN programs p
            ON p.id = s.program_id

        LEFT JOIN student_sections ss
            ON ss.section_id = s.id
            AND ss.academic_term_id = s.academic_term_id

        LEFT JOIN class_schedules cs
            ON cs.section_id = s.id
            AND cs.academic_term_id = s.academic_term_id

        WHERE s.academic_term_id = ?

        GROUP BY
            s.id,
            p.id,
            p.program_code,
            s.year_level,
            s.section_name,
            s.max_students

        ORDER BY
            p.program_code,
            s.year_level,
            s.section_name
    `, [
        academicTermId
    ]);

    return rows;
},

getEnrollmentCapacity: async function (
    programId,
    yearLevel,
    academicTermId
) {

    const [rows] = await db.query(`
        SELECT

            COUNT(s.id) AS total_sections,

            COALESCE(
                SUM(s.max_students),
                0
            ) AS total_capacity,

            COALESCE(
                SUM(
                    COALESCE(sc.student_count, 0)
                ),
                0
            ) AS enrolled_students

        FROM sections s

        LEFT JOIN (
            SELECT
                section_id,
                COUNT(*) AS student_count

            FROM student_sections

            WHERE academic_term_id = ?

            GROUP BY section_id
        ) sc
            ON sc.section_id = s.id

        WHERE s.program_id = ?
        AND s.year_level = ?
        AND s.academic_term_id = ?
    `, [
        academicTermId,
        programId,
        yearLevel,
        academicTermId
    ]);

    const result = rows[0];

    return {
        total_sections:
            Number(result.total_sections),

        total_capacity:
            Number(result.total_capacity),

        enrolled_students:
            Number(result.enrolled_students),

        remaining_capacity:
            Number(result.total_capacity) -
            Number(result.enrolled_students)
    };
},

getEnrollmentCapacities: async function (
    academicTermId
) {

    const [rows] = await db.query(`
        SELECT
            p.id AS program_id,
            p.program_code,
            p.program_name,

            s.year_level,

            COUNT(s.id) AS total_sections,

            SUM(s.max_students) AS total_capacity,

            SUM(
                COALESCE(sc.student_count, 0)
            ) AS enrolled_students

        FROM sections s

        JOIN programs p
            ON p.id = s.program_id

        LEFT JOIN (
            SELECT
                section_id,
                academic_term_id,
                COUNT(*) AS student_count

            FROM student_sections

            GROUP BY
                section_id,
                academic_term_id

        ) sc
            ON sc.section_id = s.id
            AND sc.academic_term_id =
                s.academic_term_id

        WHERE s.academic_term_id = ?

        GROUP BY
            p.id,
            p.program_code,
            p.program_name,
            s.year_level

        ORDER BY
            p.program_code,
            s.year_level
    `, [
        academicTermId
    ]);


    return rows.map(row => {

        const totalCapacity =
            Number(row.total_capacity);

        const enrolledStudents =
            Number(row.enrolled_students);

        return {
            program_id:
                Number(row.program_id),

            program_code:
                row.program_code,

            program_name:
                row.program_name,

            year_level:
                Number(row.year_level),

            total_sections:
                Number(row.total_sections),

            total_capacity:
                totalCapacity,

            enrolled_students:
                enrolledStudents,

            remaining_capacity:
                totalCapacity -
                enrolledStudents
        };
    });
},

    getByProgramYearAndTerm: async function(
        programId,
        yearLevel,
        academicTermId
    ) {

        const [rows] = await db.query(`
            SELECT *
            FROM sections
            WHERE program_id = ?
            AND year_level = ?
            AND academic_term_id = ?
            ORDER BY section_name
        `, [
            programId,
            yearLevel,
            academicTermId
        ]);

        return rows;
    },


    getAvailableSections: async function(
        programId,
        yearLevel,
        academicTermId
    ) {

        console.log("GET AVAILABLE SECTION:", {
            programId,
            yearLevel,
            academicTermId
        });

        const [rows] = await db.query(`
            SELECT
                s.id,
                s.program_id,
                s.year_level,
                s.section_name,
                s.academic_term_id,
                s.max_students,
                COUNT(ss.id) AS student_count

            FROM sections s

            LEFT JOIN student_sections ss
                ON s.id = ss.section_id

            WHERE s.program_id = ?
            AND s.year_level = ?
            AND s.academic_term_id = ?

            GROUP BY
                s.id,
                s.program_id,
                s.year_level,
                s.section_name,
                s.academic_term_id,
                s.max_students

            HAVING student_count < s.max_students

            ORDER BY s.section_name

            LIMIT 1
        `, [
            programId,
            yearLevel,
            academicTermId
        ]);

        console.log(
            "AVAILABLE SECTION RESULT:",
            rows
        );

        return rows[0] || null;
    },


    create: async function(
        programId,
        yearLevel,
        sectionName,
        academicTermId,
        maxStudents
    ) {

        const [result] = await db.query(`
            INSERT INTO sections
            (
                program_id,
                year_level,
                section_name,
                academic_term_id,
                max_students
            )
            VALUES (?, ?, ?, ?, ?)
        `, [
            programId,
            yearLevel,
            sectionName,
            academicTermId,
            maxStudents
        ]);

        return result.insertId;
    }

};

module.exports = Section;