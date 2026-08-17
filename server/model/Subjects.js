const db = require('../config/db');


// =====================================================
// GET SUBJECTS
// For students / enrollment
// =====================================================

const getSubjects = async (sem) => {
    console.log("model reached", sem);

    const [rows] = await db.query(`
        SELECT
            s.id,
            s.subject_code,
            s.subject_name,
            s.description,
            s.units,
            s.lecture_units,
            s.lab_units,

            cs.year_level,
            cs.semester,

            GROUP_CONCAT(
                DISTINCT p.id
                ORDER BY p.id
                SEPARATOR ','
            ) AS program_ids,

            GROUP_CONCAT(
                DISTINCT p.program_name
                ORDER BY p.program_name
                SEPARATOR ', '
            ) AS program_names

        FROM subjects s

        INNER JOIN curriculum_subjects cs
            ON s.id = cs.subject_id

        INNER JOIN programs p
            ON cs.program_id = p.id

        WHERE cs.semester = ?

        GROUP BY
            s.id,
            s.subject_code,
            s.subject_name,
            s.description,
            s.units,
            s.lecture_units,
            s.lab_units,
            cs.year_level,
            cs.semester

        ORDER BY
            cs.year_level,
            cs.semester,
            s.subject_code
    `, [sem]);

    return rows;
};


// =====================================================
// GET ALL SUBJECTS - ADMIN
// =====================================================

const getSubjectsAdmin = async () => {

    const [rows] = await db.query(`
        SELECT
            s.id,
            s.subject_code,
            s.subject_name,
            s.description,
            s.units,
            s.lecture_units,
            s.lab_units,

            cs.year_level,
            cs.semester,

            GROUP_CONCAT(
                DISTINCT p.id
                ORDER BY p.id
                SEPARATOR ','
            ) AS program_ids,

            GROUP_CONCAT(
                DISTINCT p.program_code
                ORDER BY p.program_code
                SEPARATOR ', '
            ) AS program_codes

        FROM subjects s

        LEFT JOIN curriculum_subjects cs
            ON s.id = cs.subject_id

        LEFT JOIN programs p
            ON cs.program_id = p.id

        GROUP BY
            s.id,
            s.subject_code,
            s.subject_name,
            s.description,
            s.units,
            s.lecture_units,
            s.lab_units,
            cs.year_level,
            cs.semester

        ORDER BY
            cs.year_level,
            cs.semester,
            s.subject_code
    `);

    return rows;
};


// =====================================================
// FIND SUBJECT BY ID
// =====================================================

const findById = async (id) => {

    const [rows] = await db.query(`
        SELECT
            s.id,
            s.subject_code,
            s.subject_name,
            s.description,
            s.units,
            s.lecture_units,
            s.lab_units,

            cs.year_level,
            cs.semester,

            GROUP_CONCAT(
                DISTINCT p.id
                ORDER BY p.id
                SEPARATOR ','
            ) AS program_ids,

            GROUP_CONCAT(
                DISTINCT p.program_name
                ORDER BY p.program_name
                SEPARATOR ', '
            ) AS program_names

        FROM subjects s

        LEFT JOIN curriculum_subjects cs
            ON s.id = cs.subject_id

        LEFT JOIN programs p
            ON cs.program_id = p.id

        WHERE s.id = ?

        GROUP BY
            s.id,
            s.subject_code,
            s.subject_name,
            s.description,
            s.units,
            s.lecture_units,
            s.lab_units,
            cs.year_level,
            cs.semester

    `, [id]);

    return rows[0];
};


// =====================================================
// FIND SUBJECT BY CODE
// =====================================================

const findByCode = async (code) => {

    const [rows] = await db.query(`
        SELECT
            s.id,
            s.subject_code,
            s.subject_name,
            s.description,
            s.units,
            s.lecture_units,
            s.lab_units,

            cs.year_level,
            cs.semester,

            GROUP_CONCAT(
                DISTINCT p.id
                ORDER BY p.id
                SEPARATOR ','
            ) AS program_ids,

            GROUP_CONCAT(
                DISTINCT p.program_name
                ORDER BY p.program_name
                SEPARATOR ', '
            ) AS program_names

        FROM subjects s

        LEFT JOIN curriculum_subjects cs
            ON s.id = cs.subject_id

        LEFT JOIN programs p
            ON cs.program_id = p.id

        WHERE s.subject_code = ?

        GROUP BY
            s.id,
            s.subject_code,
            s.subject_name,
            s.description,
            s.units,
            s.lecture_units,
            s.lab_units,
            cs.year_level,
            cs.semester

    `, [code]);

    return rows[0];
};


// =====================================================
// CREATE SUBJECT
// =====================================================

const createSubject = async (data) => {

    const {
        subject_code,
        subject_name,
        description,
        units,
        lecture_units,
        lab_units,
        year_level,
        semester,
        programs
    } = data;


    // -----------------------------------------
    // 1. Create the actual subject
    // -----------------------------------------

    const [result] = await db.query(`
        INSERT INTO subjects (
            subject_code,
            subject_name,
            description,
            units,
            lecture_units,
            lab_units
        )
        VALUES (?, ?, ?, ?, ?, ?)
    `, [
        subject_code,
        subject_name,
        description,
        units,
        lecture_units,
        lab_units
    ]);


    const subjectId = result.insertId;


    // -----------------------------------------
    // 2. Create curriculum relationships
    // -----------------------------------------

    if (programs && programs.length > 0) {

        const values = programs.map(programId => [
            programId,
            subjectId,
            year_level,
            semester
        ]);

        await db.query(`
            INSERT INTO curriculum_subjects (
                program_id,
                subject_id,
                year_level,
                semester
            )
            VALUES ?
        `, [values]);

    }


    return result;
};


// =====================================================
// UPDATE SUBJECT
// =====================================================

const updateSubject = async (id, data) => {

    const {
        subject_code,
        subject_name,
        description,
        units,
        lecture_units,
        lab_units,
        year_level,
        semester,
        programs
    } = data;


    // -----------------------------------------
    // 1. Update subject information
    // -----------------------------------------

    const [result] = await db.query(`
        UPDATE subjects
        SET
            subject_code = ?,
            subject_name = ?,
            description = ?,
            units = ?,
            lecture_units = ?,
            lab_units = ?
        WHERE id = ?
    `, [
        subject_code,
        subject_name,
        description,
        units,
        lecture_units,
        lab_units,
        id
    ]);


    // -----------------------------------------
    // 2. Remove old curriculum relationships
    // -----------------------------------------

    await db.query(`
        DELETE FROM curriculum_subjects
        WHERE subject_id = ?
    `, [id]);


    // -----------------------------------------
    // 3. Insert new curriculum relationships
    // -----------------------------------------

    if (programs && programs.length > 0) {

        const values = programs.map(programId => [
            programId,
            id,
            year_level,
            semester
        ]);

        await db.query(`
            INSERT INTO curriculum_subjects (
                program_id,
                subject_id,
                year_level,
                semester
            )
            VALUES ?
        `, [values]);

    }


    return result;
};


// =====================================================
// DELETE SUBJECT
// =====================================================

const deleteSubject = async (id) => {

    const [result] = await db.query(`
        DELETE FROM subjects
        WHERE id = ?
    `, [id]);

    return result;
};


module.exports = {
    getSubjects,
    findById,
    createSubject,
    updateSubject,
    deleteSubject,
    getSubjectsAdmin,
    findByCode
};