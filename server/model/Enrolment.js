const db = require("../config/db");

const Enrollment = {

    createEnrollment: async function ({
        student_id,
        section_id,
        status = "approved",
        approved_by = null,
        remarks = null
    }) {

        const [result] = await db.query(`
            INSERT INTO student_enrollments
            (
                student_id,
                section_id,
                status,
                approved_at,
                approved_by,
                remarks
            )
            VALUES (?, ?, ?, NOW(), ?, ?)
        `, [
            student_id,
            section_id,
            status,
            approved_by,
            remarks
        ]);

        return result;
    },


    findByStudentAndSection: async function (
        student_id,
        section_id
    ) {

        const [rows] = await db.query(`
            SELECT *
            FROM student_enrollments
            WHERE student_id = ?
            AND section_id = ?
            LIMIT 1
        `, [
            student_id,
            section_id
        ]);

        return rows[0] || null;
    }

};

module.exports = Enrollment;