const db = require('../config/db');

const getPrograms = async () => {

    const [rows] = await db.query(`
    SELECT * from programs

`);
    return rows;
};

const findById = async (id) => {

    const [rows] = await db.query(

        `SELECT *
         FROM programs
         WHERE id = ?`,

        [id]

    );

    return rows[0];

};

const createProgram = async ({
    program_code,
    program_name,
    description
}) => {

    const [result] = await db.query(
        `
        INSERT INTO programs
        (
            program_code,
            program_name,
            description
        )
        VALUES (?, ?, ?)
        `,
        [
            program_code,
            program_name,
            description
        ]
    );

    return result;
};

const getProgramsWithSections = async (academicTermId) => {

    const [rows] = await db.query(`
        SELECT DISTINCT
            p.id,
            p.program_code,
            p.program_name,
            p.description

        FROM programs p

        INNER JOIN sections s
            ON s.program_id = p.id

        INNER JOIN student_sections ss
            ON ss.section_id = s.id
            AND ss.academic_term_id = s.academic_term_id

        WHERE s.academic_term_id = ?

        ORDER BY p.program_code
    `, [
        academicTermId
    ]);

    return rows;
};

module.exports = {
    getPrograms,
    findById,
    createProgram,
    getProgramsWithSections
};