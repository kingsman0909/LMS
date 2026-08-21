const db = require('../config/db');


// =====================================================
// GET SUBJECTS
// For students / enrollment
// =====================================================

const getSubjects = async (sem) => {

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
// GET SUBJECTS WITH ASSIGNED PROFESSOR
// For Curriculum Builder
//
// IMPORTANT:
// curriculum_subjects is NOT involved here.
// Curriculum may still be completely empty.
//
// Returns subjects belonging to each program
// that already have an assigned professor.
// =====================================================

const getSubjectsWithProfessor = async () => {

    const [rows] = await db.query(`
        SELECT

            s.id,
            s.subject_code,
            s.subject_name,
            s.description,
            s.units,
            s.lecture_units,
            s.lab_units,

            s.program_id,

            p.program_code,
            p.program_name,

            ps.id AS professor_subject_id,
            ps.professor_id,

            CONCAT(
                pr.firstname,
                ' ',
                pr.lastname
            ) AS professor_name

        FROM subjects s

        INNER JOIN programs p
            ON p.id = s.program_id

        INNER JOIN professor_subjects ps
            ON ps.subject_id = s.id

        INNER JOIN profesor pr
            ON pr.id = ps.professor_id

        ORDER BY
            p.program_code,
            s.subject_code
    `);

    return rows;
};

// =====================================================
// GET SUBJECTS FOR CURRICULUM
//
// Returns subjects belonging to a specific program
// that already have an assigned professor.
//
// YEAR LEVEL and SEMESTER are NOT used here.
// Admin decides those when adding the subject
// to the curriculum.
// =====================================================
const getSubjectsForCurriculum = async (programId) => {

    const [rows] = await db.query(`
        SELECT
            s.id AS subject_id,
            s.subject_code,
            s.subject_name,
            s.description,
            s.units,
            s.lecture_units,
            s.lab_units

        FROM subjects s

        LEFT JOIN curriculum_subjects cs
            ON cs.subject_id = s.id
            AND cs.program_id = ?

        WHERE s.program_id = ?
          AND s.status = 'active'
          AND cs.id IS NULL

        ORDER BY
            s.subject_code
    `, [
        programId,
        programId
    ]);

    return rows;
};// FIND SUBJECT BY ID
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
//
// IMPORTANT:
// This ONLY creates the subject.
//
// It does NOT automatically add the subject
// to curriculum_subjects anymore.
//
// Curriculum is managed separately.
// =====================================================

const createSubject = async (data, id) => {
    const {
        subject_code,
        subject_name,
        description,
        units,
        lecture_units,
        lab_units
    } = data;


    const [result] = await db.query(`
        INSERT INTO subjects (
            program_id,
            subject_code,
            subject_name,
            description,
            units,
            lecture_units,
            lab_units
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
        id,
        subject_code,
        subject_name,
        description,
        units,
        lecture_units,
        lab_units
    ]);


    return result;
};


// =====================================================
// UPDATE SUBJECT
// =====================================================
//
// IMPORTANT:
// Does NOT modify curriculum anymore.
// It only updates the subject itself.
// =====================================================

const updateSubject = async (id, data) => {

    const {
        subject_code,
        subject_name,
        description,
        units,
        lecture_units,
        lab_units
    } = data;


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


// =====================================================
// GET SUBJECTS BY STUDENT
// For student-specific subjects / irregular students
// =====================================================

const getSubjectsByStudent = async (
    studentId,
    academicTermId
) => {

    const [rows] = await db.query(`
        SELECT DISTINCT

            se.student_id,

            se.id AS enrollment_id,

            sec.id AS section_id,
            sec.section_name,

            s.id AS subject_id,
            s.subject_code,
            s.subject_name,
            s.description,
            s.units,
            s.lecture_units,
            s.lab_units

        FROM student_enrollments se

        INNER JOIN sections sec
            ON se.section_id = sec.id

        INNER JOIN class_schedules cs
            ON cs.section_id = sec.id

        INNER JOIN subjects s
            ON cs.subject_id = s.id

        WHERE se.student_id = ?
          AND se.status = 'approved'
          AND sec.academic_term_id = ?

        ORDER BY
            sec.id,
            s.subject_code

    `, [
        studentId,
        academicTermId
    ]);

    return rows;
};


module.exports = {

    getSubjects,

    getSubjectsAdmin,

    getSubjectsWithProfessor,

    getSubjectsForCurriculum,

    findById,

    findByCode,

    createSubject,

    updateSubject,

    deleteSubject,

    getSubjectsByStudent
};