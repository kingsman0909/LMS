const db = require('../config/db');

const reset = async () => {
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        await connection.query(`DELETE FROM class_schedules`);
        await connection.query(`DELETE FROM users`);
        await connection.query(`DELETE FROM sections`);

        await connection.query(`
            UPDATE student_applications
            SET status = 'pending'
            WHERE status = 'approved'
        `);

        await connection.commit();

        return {
            success: true,
            message: 'System reset successfully'
        };

    } catch (error) {
        await connection.rollback();
        throw error;

    } finally {
        connection.release();
    }
};

module.exports = { reset };