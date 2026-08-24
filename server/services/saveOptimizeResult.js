const db = require("../config/db");

const saveOptimizerResult = async (assignments, academicTermId) => {
    if (!assignments || assignments.length === 0) {
        return;
    }

    const values = assignments.map(row => [
        row.section_id,
        row.subject_id,
        row.professor_id,
        row.room_id,
        row.time_slot_id,
        academicTermId
    ]);

    const placeholders = values.map(() => "(?, ?, ?, ?, ?, ?)").join(",");
    const flat = values.flat();

    await db.query(`
        INSERT INTO class_schedules
        (
            section_id,
            subject_id,
            professor_id,
            room_id,
            time_slot_id,
            academic_term_id
        )
        VALUES ${placeholders}
    `, flat);
};

module.exports = {
    saveOptimizerResult
};