const db = require("../config/db");

const getSchedulesByTerm = async (
    academicTermId
) => {

    const [rows] = await db.query(`
        SELECT
            cs.id,

            cs.section_id,
            cs.subject_id,
            cs.professor_id,
            cs.room_id,
            cs.time_slot_id,
            cs.academic_term_id,

            s.year_level,
            s.section_name,
            s.max_students,

            p.id AS program_id,
            p.program_code,
            p.program_name,

            sub.subject_code,
            sub.subject_name,

            CONCAT(
                prof.firstname,
                ' ',
                prof.lastname
            ) AS professor_name,

            r.room_name,
            r.room_type,
            r.capacity,

            ts.day,
            ts.start_time,
            ts.end_time

        FROM class_schedules cs

        JOIN sections s
            ON s.id = cs.section_id

        JOIN programs p
            ON p.id = s.program_id

        JOIN subjects sub
            ON sub.id = cs.subject_id

        JOIN profesor prof
            ON prof.id = cs.professor_id

        JOIN rooms r
            ON r.id = cs.room_id

        JOIN time_slots ts
            ON ts.id = cs.time_slot_id

        WHERE cs.academic_term_id = ?

        ORDER BY
            p.program_code,
            s.year_level,
            s.section_name,
            sub.subject_code,
            FIELD(
                ts.day,
                'Monday',
                'Tuesday',
                'Wednesday',
                'Thursday',
                'Friday',
                'Saturday'
            ),
            ts.start_time
    `, [
        academicTermId
    ]);

    return rows;
};


const getSchedulesBySection = async (
    academicTermId,
    sectionId
) => {

    const [rows] = await db.query(`
        SELECT
            cs.id,

            cs.section_id,
            cs.subject_id,
            cs.professor_id,
            cs.room_id,
            cs.time_slot_id,
            cs.academic_term_id,

            s.year_level,
            s.section_name,
            s.max_students,

            p.id AS program_id,
            p.program_code,
            p.program_name,

            sub.subject_code,
            sub.subject_name,

            CONCAT(
                prof.firstname,
                ' ',
                prof.lastname
            ) AS professor_name,

            r.room_name,
            r.room_type,
            r.capacity,

            ts.day,
            ts.start_time,
            ts.end_time

        FROM class_schedules cs

        JOIN sections s
            ON s.id = cs.section_id

        JOIN programs p
            ON p.id = s.program_id

        JOIN subjects sub
            ON sub.id = cs.subject_id

        JOIN profesor prof
            ON prof.id = cs.professor_id

        JOIN rooms r
            ON r.id = cs.room_id

        JOIN time_slots ts
            ON ts.id = cs.time_slot_id

        WHERE cs.academic_term_id = ?
          AND cs.section_id = ?

        ORDER BY
            FIELD(
                ts.day,
                'Monday',
                'Tuesday',
                'Wednesday',
                'Thursday',
                'Friday',
                'Saturday'
            ),
            ts.start_time
    `, [
        academicTermId,
        sectionId
    ]);

    return rows;
};


module.exports = {
    getSchedulesByTerm,
    getSchedulesBySection
};