const db = require("../config/db");


// ==========================================
// BUILD REQUIREMENTS
// ==========================================

const buildRequirements = (subjects) => {

    const requirements = [];

    for (const subject of subjects) {

        if (Number(subject.lecture_units) > 0) {

            requirements.push({
                subject_id: subject.subject_id,
                subject_code: subject.subject_code,
                type: "lecture",
                hours: Number(subject.lecture_units)
            });
        }

        if (Number(subject.lab_units) > 0) {

            requirements.push({
                subject_id: subject.subject_id,
                subject_code: subject.subject_code,
                type: "laboratory",
                hours: Number(subject.lab_units) * 3
            });
        }
    }

    return requirements;
};


// ==========================================
// GET AVAILABLE TIME SLOTS
// ==========================================

const getAvailableTimeSlots = async () => {

    const [slots] = await db.query(`
        SELECT
            id,
            day,
            start_time,
            end_time
        FROM time_slots

        WHERE status = 'available'

        ORDER BY
            FIELD(
                day,
                'Monday',
                'Tuesday',
                'Wednesday',
                'Thursday',
                'Friday',
                'Saturday'
            ),
            start_time
    `);

    return slots;
};


// ==========================================
// CHECK DATABASE CONFLICT
// ==========================================

const checkScheduleConflict = async (
    slots,
    academicTermId,
    sectionId,
    professorId,
    roomId
) => {

    const slotIds =
        slots.map(slot => slot.id);

    const placeholders =
        slotIds.map(() => "?").join(",");

    const [rows] = await db.query(`
        SELECT
            cs.id

        FROM class_schedules cs

        WHERE cs.academic_term_id = ?

        AND cs.time_slot_id IN (${placeholders})

        AND (
            cs.section_id = ?
            OR cs.professor_id = ?
            OR cs.room_id = ?
        )

        LIMIT 1
    `, [
        academicTermId,
        ...slotIds,
        sectionId,
        professorId,
        roomId
    ]);

    return rows.length > 0;
};


// ==========================================
// CHECK SIMULATION CONFLICT
// ==========================================

const hasSimulationConflict = (
    candidateSlots,
    sectionId,
    professorId,
    roomId,
    simulatedSchedules
) => {

    const candidateIds =
        new Set(
            candidateSlots.map(slot => slot.id)
        );

    for (const schedule of simulatedSchedules) {

        if (
            schedule.section_id === sectionId ||
            schedule.professor_id === professorId ||
            schedule.room_id === roomId
        ) {

            const conflict =
                schedule.slots.some(
                    slot =>
                        candidateIds.has(slot.id)
                );

            if (conflict) {
                return true;
            }
        }
    }

    return false;
};


// ==========================================
// FIND PROFESSORS
// ==========================================

const findProfessorsForSubject = async (
    subjectId,
    academicTermId,
    slots
) => {

    const slotIds =
        slots.map(slot => slot.id);

    const placeholders =
        slotIds.map(() => "?").join(",");

    const [professors] = await db.query(`
        SELECT DISTINCT
            p.id,
            p.employee_id,
            p.firstname,
            p.lastname,
            p.department

        FROM profesor p

        JOIN professor_subjects ps
            ON ps.professor_id = p.id

        WHERE ps.subject_id = ?

        AND NOT EXISTS (

            SELECT 1

            FROM class_schedules cs

            WHERE cs.professor_id = p.id

            AND cs.academic_term_id = ?

            AND cs.time_slot_id IN (${placeholders})
        )

        ORDER BY p.id

    `, [
        subjectId,
        academicTermId,
        ...slotIds
    ]);

    return professors;
};


// ==========================================
// FIND ROOMS
// ==========================================

const findRooms = async (
    roomType,
    studentCount,
    academicTermId,
    slots
) => {

    const slotIds =
        slots.map(slot => slot.id);

    const placeholders =
        slotIds.map(() => "?").join(",");

    const [rooms] = await db.query(`
        SELECT
            r.id,
            r.room_name,
            r.room_type,
            r.capacity

        FROM rooms r

        WHERE r.room_type = ?

        AND r.status = 'available'

        AND r.capacity >= ?

        AND NOT EXISTS (

            SELECT 1

            FROM class_schedules cs

            WHERE cs.room_id = r.id

            AND cs.academic_term_id = ?

            AND cs.time_slot_id IN (${placeholders})
        )

        ORDER BY
            r.capacity ASC,
            r.id ASC

    `, [
        roomType,
        studentCount,
        academicTermId,
        ...slotIds
    ]);

    return rooms;
};


// ==========================================
// GENERATE CANDIDATE TIME SLOTS
// ==========================================

const getCandidateSlots = (
    allSlots,
    requiredHours
) => {

    const slotsByDay = {};

    for (const slot of allSlots) {

        if (!slotsByDay[slot.day]) {
            slotsByDay[slot.day] = [];
        }

        slotsByDay[slot.day].push(slot);
    }

    const candidates = [];

    for (const day of Object.keys(slotsByDay)) {

        const daySlots =
            slotsByDay[day];

        for (
            let i = 0;
            i <= daySlots.length - requiredHours;
            i++
        ) {

            const candidate =
                daySlots.slice(
                    i,
                    i + requiredHours
                );

            let consecutive = true;

            for (
                let j = 1;
                j < candidate.length;
                j++
            ) {

                if (
                    candidate[j - 1].end_time !==
                    candidate[j].start_time
                ) {

                    consecutive = false;
                    break;
                }
            }

            if (consecutive) {
                candidates.push(candidate);
            }
        }
    }

    return candidates;
};


// ==========================================
// SIMULATE ONE REQUIREMENT
// ==========================================

const simulateRequirement = async ({
    requirement,
    section,
    academicTermId,
    simulatedSchedules
}) => {

    const allSlots =
        await getAvailableTimeSlots();

    const candidates =
        getCandidateSlots(
            allSlots,
            requirement.hours
        );

    const roomType =
        requirement.type === "laboratory"
            ? "laboratory"
            : "lecture";


    let professorCandidatesFound = false;
    let roomCandidatesFound = false;


    for (const slots of candidates) {

        // --------------------------------------
        // PROFESSORS
        // --------------------------------------

        const professors =
            await findProfessorsForSubject(
                requirement.subject_id,
                academicTermId,
                slots
            );

        if (professors.length > 0) {
            professorCandidatesFound = true;
        }


        // --------------------------------------
        // ROOMS
        // --------------------------------------

        const rooms =
            await findRooms(
                roomType,
                section.student_count,
                academicTermId,
                slots
            );

        if (rooms.length > 0) {
            roomCandidatesFound = true;
        }


        // --------------------------------------
        // TRY PROFESSOR + ROOM COMBINATION
        // --------------------------------------

        for (const professor of professors) {

            for (const room of rooms) {

                const simulationConflict =
                    hasSimulationConflict(
                        slots,
                        section.id,
                        professor.id,
                        room.id,
                        simulatedSchedules
                    );

                if (simulationConflict) {
                    continue;
                }


                const databaseConflict =
                    await checkScheduleConflict(
                        slots,
                        academicTermId,
                        section.id,
                        professor.id,
                        room.id
                    );

                if (databaseConflict) {
                    continue;
                }


                return {

                    success: true,

                    schedule: {

                        section_id:
                            section.id,

                        subject_id:
                            requirement.subject_id,

                        subject_code:
                            requirement.subject_code,

                        type:
                            requirement.type,

                        professor_id:
                            professor.id,

                        professor_name:
                            `${professor.firstname} ${professor.lastname}`,

                        room_id:
                            room.id,

                        room_name:
                            room.room_name,

                        slots
                    }
                };
            }
        }
    }


    // ==========================================
    // FAILURE DIAGNOSIS
    // ==========================================

    let reason = "unknown";

    if (!professorCandidatesFound) {

        reason =
            "No qualified professor can be scheduled.";
    }

    else if (!roomCandidatesFound) {

        reason =
            "No suitable room can be scheduled.";
    }

    else {

        reason =
            "Professor, room, or time-slot conflicts prevent scheduling.";
    }


    return {

        success: false,

        reason,

        requirement: {

            subject_id:
                requirement.subject_id,

            subject_code:
                requirement.subject_code,

            type:
                requirement.type,

            hours:
                requirement.hours
        }
    };
};


// ==========================================
// SIMULATE SECTION
// ==========================================

const simulateSection = async ({
    section,
    requirements,
    academicTermId
}) => {

    const simulatedSchedules = [];

    const failures = [];


    for (const requirement of requirements) {

        const result =
            await simulateRequirement({

                requirement,

                section,

                academicTermId,

                simulatedSchedules

            });


        if (!result.success) {

            failures.push({

                section_id:
                    section.id,

                section_name:
                    section.section_name,

                subject:
                    requirement.subject_code,

                type:
                    requirement.type,

                reason:
                    result.reason

            });

            continue;
        }


        simulatedSchedules.push(
            result.schedule
        );
    }


    return {

        success:
            failures.length === 0,

        schedules:
            simulatedSchedules,

        failures
    };
};


module.exports = {

    buildRequirements,

    getAvailableTimeSlots,

    checkScheduleConflict,

    hasSimulationConflict,

    findProfessorsForSubject,

    findRooms,

    getCandidateSlots,

    simulateRequirement,

    simulateSection

};