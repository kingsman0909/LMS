const db = require("../config/db");

/*
|--------------------------------------------------------------------------
| CONFIG
|--------------------------------------------------------------------------
*/

const DAY_ORDER = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday"
];

const DAY_INDEX = new Map(
    DAY_ORDER.map((day, index) => [day, index])
);

const yearLevelMap = {
    1: "1st Year",
    2: "2nd Year",
    3: "3rd Year",
    4: "4th Year"
};

/*
|--------------------------------------------------------------------------
| SEARCH LIMITS
|--------------------------------------------------------------------------
*/

const MAX_BACKTRACK_NODES_PER_SECTION = 25000;
const MAX_TIME_MS_PER_SECTION = 5000;

const GREEDY_MAX_CANDIDATES_PER_REQUIREMENT = 100;
const BACKTRACK_MAX_CANDIDATES_PER_REQUIREMENT = 100;

const MAX_MRV_CANDIDATE_SCAN = 250;

const MAX_FAILURE_ANALYSIS_SCAN = 1000;

/*
|--------------------------------------------------------------------------
| SECTION DISTRIBUTION
|--------------------------------------------------------------------------
*/

const SECTION_TARGET_DAILY_HOURS = 6;

const NEW_DAY_BONUS = 25000;

const SECTION_DAY_LOAD_WEIGHT = 5000;

const SECTION_LONG_DAY_WEIGHT = 15000;

/*
|--------------------------------------------------------------------------
| DEBUG
|--------------------------------------------------------------------------
|
| Keep false during real scheduling.
| Set true only while debugging.
|
*/

const DEBUG_SCHEDULER = false;

const log = (...args) => {
    if (DEBUG_SCHEDULER) {
        console.log(...args);
    }
};

/*
|--------------------------------------------------------------------------
| BASIC HELPERS
|--------------------------------------------------------------------------
*/

const num = value => Number(value);

const normalizeTime = value => {
    if (value == null) {
        return "";
    }

    return String(value)
        .split(".")[0]
        .trim();
};

const makeSubjectTypeKey = (
    subjectId,
    type
) => `${num(subjectId)}:${type}`;

const makeRoomCacheKey = (
    sectionId,
    type
) => `${num(sectionId)}:${type}`;

/*
|--------------------------------------------------------------------------
| OCCUPANCY
|--------------------------------------------------------------------------
*/

const createOccupancy = () => ({
    sectionSlots: new Map(),
    professorSlots: new Map(),
    roomSlots: new Map(),

    sectionDayHours: new Map()
});

/*
|--------------------------------------------------------------------------
| SLOT OCCUPANCY
|--------------------------------------------------------------------------
*/

const getOccupiedSet = (
    map,
    key
) => {
    return map.get(num(key)) || null;
};

const hasSlotConflict = (
    map,
    key,
    slotIds
) => {
    const occupied = map.get(num(key));

    if (!occupied) {
        return false;
    }

    for (let i = 0; i < slotIds.length; i++) {
        if (occupied.has(slotIds[i])) {
            return true;
        }
    }

    return false;
};

const reserveSlotIds = (
    map,
    key,
    slotIds
) => {
    key = num(key);

    let occupied = map.get(key);

    if (!occupied) {
        occupied = new Set();
        map.set(key, occupied);
    }

    for (let i = 0; i < slotIds.length; i++) {
        occupied.add(slotIds[i]);
    }
};

const releaseSlotIds = (
    map,
    key,
    slotIds
) => {
    key = num(key);

    const occupied = map.get(key);

    if (!occupied) {
        return;
    }

    for (let i = 0; i < slotIds.length; i++) {
        occupied.delete(slotIds[i]);
    }

    if (occupied.size === 0) {
        map.delete(key);
    }
};

/*
|--------------------------------------------------------------------------
| SECTION DAY LOAD
|--------------------------------------------------------------------------
*/

const getSectionDayHours = (
    occupancy,
    sectionId,
    day
) => {
    const sectionMap =
        occupancy.sectionDayHours.get(
            num(sectionId)
        );

    if (!sectionMap) {
        return 0;
    }

    return sectionMap.get(day) || 0;
};

const addSectionDayHours = (
    occupancy,
    sectionId,
    day,
    hours
) => {
    sectionId = num(sectionId);

    let sectionMap =
        occupancy.sectionDayHours.get(
            sectionId
        );

    if (!sectionMap) {
        sectionMap = new Map();

        occupancy.sectionDayHours.set(
            sectionId,
            sectionMap
        );
    }

    sectionMap.set(
        day,
        (sectionMap.get(day) || 0) + hours
    );
};

const removeSectionDayHours = (
    occupancy,
    sectionId,
    day,
    hours
) => {
    sectionId = num(sectionId);

    const sectionMap =
        occupancy.sectionDayHours.get(
            sectionId
        );

    if (!sectionMap) {
        return;
    }

    const current =
        sectionMap.get(day) || 0;

    const next =
        current - hours;

    if (next <= 0) {
        sectionMap.delete(day);
    } else {
        sectionMap.set(day, next);
    }

    if (sectionMap.size === 0) {
        occupancy.sectionDayHours.delete(
            sectionId
        );
    }
};

const getSectionTotalScheduledHours = (
    occupancy,
    sectionId
) => {
    const sectionMap =
        occupancy.sectionDayHours.get(
            num(sectionId)
        );

    if (!sectionMap) {
        return 0;
    }

    let total = 0;

    for (const hours of sectionMap.values()) {
        total += hours;
    }

    return total;
};

const getSectionUsedDayCount = (
    occupancy,
    sectionId
) => {
    return (
        occupancy.sectionDayHours.get(
            num(sectionId)
        )?.size || 0
    );
};

/*
|--------------------------------------------------------------------------
| ASSIGNMENT CONFLICT
|--------------------------------------------------------------------------
*/

const candidateConflictMask = (
    candidate,
    occupancy
) => {
    let mask = 0;

    if (
        hasSlotConflict(
            occupancy.sectionSlots,
            candidate.sectionId,
            candidate.slotIds
        )
    ) {
        mask |= 1;
    }

    if (
        hasSlotConflict(
            occupancy.professorSlots,
            candidate.professorId,
            candidate.slotIds
        )
    ) {
        mask |= 2;
    }

    if (
        hasSlotConflict(
            occupancy.roomSlots,
            candidate.roomId,
            candidate.slotIds
        )
    ) {
        mask |= 4;
    }

    return mask;
};

const assignmentHasConflict = (
    assignment,
    occupancy
) => {
    return (
        candidateConflictMask(
            assignment,
            occupancy
        ) !== 0
    );
};

/*
|--------------------------------------------------------------------------
| RESERVATION
|--------------------------------------------------------------------------
*/

const reserveAssignment = (
    assignment,
    occupancy
) => {
    reserveSlotIds(
        occupancy.sectionSlots,
        assignment.sectionId,
        assignment.slotIds
    );

    reserveSlotIds(
        occupancy.professorSlots,
        assignment.professorId,
        assignment.slotIds
    );

    reserveSlotIds(
        occupancy.roomSlots,
        assignment.roomId,
        assignment.slotIds
    );

    addSectionDayHours(
        occupancy,
        assignment.sectionId,
        assignment.day,
        assignment.slotIds.length
    );
};

const releaseAssignment = (
    assignment,
    occupancy
) => {
    releaseSlotIds(
        occupancy.sectionSlots,
        assignment.sectionId,
        assignment.slotIds
    );

    releaseSlotIds(
        occupancy.professorSlots,
        assignment.professorId,
        assignment.slotIds
    );

    releaseSlotIds(
        occupancy.roomSlots,
        assignment.roomId,
        assignment.slotIds
    );

    removeSectionDayHours(
        occupancy,
        assignment.sectionId,
        assignment.day,
        assignment.slotIds.length
    );
};

const releaseAssignments = (
    assignments,
    occupancy
) => {
    for (
        let i = assignments.length - 1;
        i >= 0;
        i--
    ) {
        releaseAssignment(
            assignments[i],
            occupancy
        );
    }
};

/*
|--------------------------------------------------------------------------
| DATABASE
|--------------------------------------------------------------------------
*/

/*
 * Bulk section loader.
 */

const getSections = async (
    programId,
    academicTermId
) => {
    const [rows] = await db.query(
        `
        SELECT
            id,
            program_id,
            year_level,
            section_name,
            academic_term_id,
            max_students
        FROM sections
        WHERE program_id = ?
        AND academic_term_id = ?
        ORDER BY
            year_level ASC,
            section_name ASC
        `,
        [
            programId,
            academicTermId
        ]
    );

    return rows;
};

/*
|--------------------------------------------------------------------------
| BULK STUDENT COUNTS
|--------------------------------------------------------------------------
*/

const getSectionStudentCounts = async (
    sectionIds,
    academicTermId
) => {
    const map = new Map();

    if (sectionIds.length === 0) {
        return map;
    }

    const placeholders =
        sectionIds.map(() => "?").join(",");

    const [rows] = await db.query(
        `
        SELECT
            section_id,
            COUNT(*) AS student_count
        FROM student_sections
        WHERE academic_term_id = ?
        AND section_id IN (${placeholders})
        GROUP BY section_id
        `,
        [
            academicTermId,
            ...sectionIds
        ]
    );

    for (const row of rows) {
        map.set(
            num(row.section_id),
            num(row.student_count)
        );
    }

    return map;
};

/*
|--------------------------------------------------------------------------
| BULK SECTION SUBJECTS
|--------------------------------------------------------------------------
*/

const getAllSectionSubjects = async (
    sectionIds,
    academicTermId
) => {
    const map = new Map();

    if (sectionIds.length === 0) {
        return map;
    }

    const placeholders =
        sectionIds.map(() => "?").join(",");

    const [rows] = await db.query(
        `
        SELECT
            s.id AS section_id,
            s.section_name,
            s.program_id,
            s.year_level,

            cs.subject_id,

            sub.subject_code,
            sub.subject_name,

            sub.units,
            sub.lecture_units,
            sub.lab_units,

            at.semester

        FROM sections s

        JOIN academic_terms at
            ON at.id = s.academic_term_id

        JOIN curriculum_subjects cs
            ON cs.program_id = s.program_id
            AND cs.year_level =
                CASE
                    WHEN s.year_level = 1 THEN '1st Year'
                    WHEN s.year_level = 2 THEN '2nd Year'
                    WHEN s.year_level = 3 THEN '3rd Year'
                    WHEN s.year_level = 4 THEN '4th Year'
                END
            AND cs.semester = at.semester

        JOIN subjects sub
            ON sub.id = cs.subject_id

        WHERE s.id IN (${placeholders})
        AND s.academic_term_id = ?

        ORDER BY
            s.id ASC,
            sub.subject_code ASC
        `,
        [
            ...sectionIds,
            academicTermId
        ]
    );

    for (const row of rows) {
        const sectionId =
            num(row.section_id);

        if (!map.has(sectionId)) {
            map.set(sectionId, []);
        }

        map.get(sectionId).push(row);
    }

    return map;
};

/*
|--------------------------------------------------------------------------
| SINGLE SECTION SUBJECTS
|--------------------------------------------------------------------------
*/

const getSectionSubjects = async (
    sectionId,
    academicTermId
) => {
    const map =
        await getAllSectionSubjects(
            [sectionId],
            academicTermId
        );

    return map.get(
        num(sectionId)
    ) || [];
};

/*
|--------------------------------------------------------------------------
| REQUIREMENTS
|--------------------------------------------------------------------------
*/

const buildRequirements = (
    subjects
) => {
    const requirements = [];

    let requirementId = 0;

    for (const subject of subjects) {
        const lectureUnits =
            num(subject.lecture_units || 0);

        const labUnits =
            num(subject.lab_units || 0);

        if (lectureUnits > 0) {
            requirements.push({
                id: requirementId++,
                subject_id: num(subject.subject_id),
                subject_code: subject.subject_code,
                subject_name: subject.subject_name,
                type: "lecture",
                hours: lectureUnits
            });
        }

        if (labUnits > 0) {
            requirements.push({
                id: requirementId++,
                subject_id: num(subject.subject_id),
                subject_code: subject.subject_code,
                subject_name: subject.subject_name,
                type: "laboratory",
                hours: labUnits * 3
            });
        }
    }

    return requirements;
};

/*
|--------------------------------------------------------------------------
| TIME SLOTS
|--------------------------------------------------------------------------
*/

const getTimeSlots = async () => {
    const [rows] = await db.query(
        `
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
                'Saturday',
                'Sunday'
            ),
            start_time
        `
    );

    return rows.map(row => ({
        id: num(row.id),
        day: row.day,
        start_time: normalizeTime(row.start_time),
        end_time: normalizeTime(row.end_time)
    }));
};

const groupSlotsByDay = (
    slots
) => {
    const map = new Map();

    for (const day of DAY_ORDER) {
        map.set(day, []);
    }

    for (const slot of slots) {
        if (!map.has(slot.day)) {
            map.set(slot.day, []);
        }

        map.get(slot.day).push(slot);
    }

    return map;
};

/*
|--------------------------------------------------------------------------
| BUILD WINDOWS
|--------------------------------------------------------------------------
|
| Precomputed ONCE per unique hour count.
|--------------------------------------------------------------------------
*/

const buildWindows = (
    slotsByDay,
    hours
) => {
    hours = num(hours);

    const windows = [];

    if (hours <= 0) {
        return windows;
    }

    for (const day of DAY_ORDER) {
        const daySlots =
            slotsByDay.get(day) || [];

        if (daySlots.length < hours) {
            continue;
        }

        for (
            let i = 0;
            i <= daySlots.length - hours;
            i++
        ) {
            const first =
                daySlots[i];

            let consecutive = true;

            for (
                let j = 1;
                j < hours;
                j++
            ) {
                if (
                    daySlots[i + j - 1].end_time !==
                    daySlots[i + j].start_time
                ) {
                    consecutive = false;
                    break;
                }
            }

            if (!consecutive) {
                continue;
            }

            const selected =
                daySlots.slice(
                    i,
                    i + hours
                );

            windows.push({
                day,
                dayIndex:
                    DAY_INDEX.get(day),
                slots: selected,
                slotIds:
                    selected.map(
                        slot => num(slot.id)
                    ),
                start_time:
                    selected[0].start_time,
                end_time:
                    selected[
                        selected.length - 1
                    ].end_time
            });
        }
    }

    return windows;
};

/*
|--------------------------------------------------------------------------
| PROFESSORS
|--------------------------------------------------------------------------
*/

const getProfessorMap = async (
    subjectIds
) => {
    const map = new Map();

    if (subjectIds.length === 0) {
        return map;
    }

    const placeholders =
        subjectIds.map(() => "?").join(",");

    const [rows] = await db.query(
        `
        SELECT
            ps.subject_id,

            p.id,
            p.employee_id,
            p.firstname,
            p.lastname,
            p.department

        FROM professor_subjects ps

        JOIN profesor p
            ON p.id = ps.professor_id

        WHERE ps.subject_id IN (${placeholders})

        ORDER BY
            ps.subject_id,
            p.id
        `,
        subjectIds
    );

    for (const row of rows) {
        const subjectId =
            num(row.subject_id);

        if (!map.has(subjectId)) {
            map.set(subjectId, []);
        }

        map.get(subjectId).push({
            id: num(row.id),
            employee_id: row.employee_id,
            firstname: row.firstname,
            lastname: row.lastname,
            department: row.department
        });
    }

    return map;
};

/*
|--------------------------------------------------------------------------
| ROOMS
|--------------------------------------------------------------------------
*/

const getRooms = async () => {
    const [rows] = await db.query(
        `
        SELECT
            id,
            room_name,
            room_type,
            capacity
        FROM rooms
        WHERE status = 'available'
        ORDER BY
            capacity ASC,
            id ASC
        `
    );

    return rows.map(room => ({
        id: num(room.id),
        room_name: room.room_name,
        room_type: room.room_type,
        capacity: num(room.capacity)
    }));
};

/*
|--------------------------------------------------------------------------
| EXISTING SCHEDULES
|--------------------------------------------------------------------------
*/

const loadExistingSchedules = async (
    academicTermId
) => {
    const [rows] = await db.query(
        `
        SELECT
            cs.id,
            cs.section_id,
            cs.subject_id,
            cs.professor_id,
            cs.room_id,
            cs.time_slot_id,
            cs.academic_term_id,

            ts.day,

            r.room_type

        FROM class_schedules cs

        JOIN rooms r
            ON r.id = cs.room_id

        JOIN time_slots ts
            ON ts.id = cs.time_slot_id

        WHERE cs.academic_term_id = ?
        `,
        [
            academicTermId
        ]
    );

    return rows.map(row => ({
        ...row,
        section_id: num(row.section_id),
        subject_id: num(row.subject_id),
        professor_id: num(row.professor_id),
        room_id: num(row.room_id),
        time_slot_id: num(row.time_slot_id)
    }));
};

/*
|--------------------------------------------------------------------------
| RESERVE EXISTING
|--------------------------------------------------------------------------
*/

const reserveExistingSchedules = (
    rows,
    occupancy
) => {
    for (const row of rows) {
        const slotId =
            num(row.time_slot_id);

        reserveSlotIds(
            occupancy.sectionSlots,
            row.section_id,
            [slotId]
        );

        reserveSlotIds(
            occupancy.professorSlots,
            row.professor_id,
            [slotId]
        );

        reserveSlotIds(
            occupancy.roomSlots,
            row.room_id,
            [slotId]
        );

        addSectionDayHours(
            occupancy,
            row.section_id,
            row.day,
            1
        );
    }
};

/*
|--------------------------------------------------------------------------
| EXISTING REQUIREMENT COUNTS
|--------------------------------------------------------------------------
*/

const getExistingRequirementCounts = (
    existingRows
) => {
    const map = new Map();

    for (const row of existingRows) {
        const sectionId =
            num(row.section_id);

        const key =
            makeSubjectTypeKey(
                row.subject_id,
                row.room_type === "laboratory"
                    ? "laboratory"
                    : "lecture"
            );

        if (!map.has(sectionId)) {
            map.set(
                sectionId,
                new Map()
            );
        }

        const sectionMap =
            map.get(sectionId);

        sectionMap.set(
            key,
            (sectionMap.get(key) || 0) + 1
        );
    }

    return map;
};

/*
|--------------------------------------------------------------------------
| MISSING REQUIREMENTS
|--------------------------------------------------------------------------
*/

const getMissingRequirements = (
    section,
    existingRequirementCounts
) => {
    const sectionCounts =
        existingRequirementCounts.get(
            num(section.id)
        ) || new Map();

    const missing = [];

    for (const requirement of section.requirements) {
        const key =
            makeSubjectTypeKey(
                requirement.subject_id,
                requirement.type
            );

        const existingCount =
            sectionCounts.get(key) || 0;

        if (
            existingCount >=
            requirement.hours
        ) {
            continue;
        }

        missing.push({
            ...requirement,
            remainingHours:
                requirement.hours -
                existingCount
        });
    }

    return missing;
};

/*
|--------------------------------------------------------------------------
| SECTION STATUS
|--------------------------------------------------------------------------
*/

const getSectionStatus = (
    section,
    existingRequirementCounts
) => {
    const sectionCounts =
        existingRequirementCounts.get(
            num(section.id)
        ) || new Map();

    let completed = 0;

    for (const requirement of section.requirements) {
        const key =
            makeSubjectTypeKey(
                requirement.subject_id,
                requirement.type
            );

        const count =
            sectionCounts.get(key) || 0;

        if (
            count >= requirement.hours
        ) {
            completed++;
        }
    }

    return {
        complete:
            completed ===
            section.requirements.length,

        completedRequirements:
            completed,

        totalRequirements:
            section.requirements.length
    };
};

/*
|--------------------------------------------------------------------------
| RESOURCE LOAD
|--------------------------------------------------------------------------
*/

const getResourceLoad = (
    map,
    id
) => {
    return map.get(num(id))?.size || 0;
};

/*
|--------------------------------------------------------------------------
| ROOM CACHE
|--------------------------------------------------------------------------
*/

const createRoomCache = (
    rooms
) => {
    const cache = new Map();

    return (
        section,
        requirement
    ) => {
        const key =
            makeRoomCacheKey(
                section.id,
                requirement.type
            );

        if (cache.has(key)) {
            return cache.get(key);
        }

        const requiredType =
            requirement.type === "laboratory"
                ? "laboratory"
                : "lecture";

        const studentCount =
            num(section.student_count);

        const valid =
            rooms.filter(room =>
                room.room_type === requiredType &&
                room.capacity >= studentCount
            );

        cache.set(
            key,
            valid
        );

        return valid;
    };
};

/*
|--------------------------------------------------------------------------
| CANDIDATE SCORE
|--------------------------------------------------------------------------
*/

const scoreCandidate = (
    candidate,
    occupancy,
    requirement,
    professorMap
) => {
    const professorLoad =
        getResourceLoad(
            occupancy.professorSlots,
            candidate.professorId
        );

    const roomLoad =
        getResourceLoad(
            occupancy.roomSlots,
            candidate.roomId
        );

    const professorCount =
        professorMap.get(
            num(requirement.subject_id)
        )?.length || 0;

    const scarcityPenalty =
        professorCount <= 1
            ? 100000
            : professorCount <= 2
                ? 30000
                : professorCount <= 3
                    ? 10000
                    : 0;

    const roomWaste =
        candidate.room.capacity -
        candidate.studentCount;

    const existingDayHours =
        getSectionDayHours(
            occupancy,
            candidate.sectionId,
            candidate.day
        );

    const assignmentHours =
        candidate.slotIds.length;

    const projectedDayHours =
        existingDayHours +
        assignmentHours;

    const usedDayCount =
        getSectionUsedDayCount(
            occupancy,
            candidate.sectionId
        );

    const newDayBonus =
        existingDayHours === 0
            ? -NEW_DAY_BONUS
            : 0;

    const sectionDayLoadPenalty =
        existingDayHours *
        existingDayHours *
        SECTION_DAY_LOAD_WEIGHT;

    const excessDailyHours =
        Math.max(
            0,
            projectedDayHours -
            SECTION_TARGET_DAILY_HOURS
        );

    const longDayPenalty =
        excessDailyHours > 0
            ? excessDailyHours *
              excessDailyHours *
              SECTION_LONG_DAY_WEIGHT
            : 0;

    const spreadBonus =
        usedDayCount < DAY_ORDER.length &&
        existingDayHours === 0
            ? -Math.min(
                10000,
                usedDayCount * 1000
            )
            : 0;

    return (
        professorLoad * 10000 +
        roomLoad * 1000 +
        scarcityPenalty +
        roomWaste * 5 +
        sectionDayLoadPenalty +
        longDayPenalty +
        newDayBonus +
        spreadBonus +
        candidate.dayIndex * 2 +
        candidate.roomId
    );
};

/*
|--------------------------------------------------------------------------
| CANDIDATE
|--------------------------------------------------------------------------
*/

const makeCandidate = (
    section,
    requirement,
    professor,
    room,
    window
) => ({
    sectionId: num(section.id),

    requirementId:
        num(requirement.id),

    requirement,

    professor,

    professorId:
        num(professor.id),

    room,

    roomId:
        num(room.id),

    window,

    slotIds:
        window.slotIds,

    day:
        window.day,

    dayIndex:
        window.dayIndex,

    start_time:
        window.start_time,

    end_time:
        window.end_time,

    studentCount:
        num(section.student_count)
});

/*
|--------------------------------------------------------------------------
| TOP-K CANDIDATE HEAP
|--------------------------------------------------------------------------
|
| Instead of:
|
|   every new candidate
|       ↓
|   scan 100 candidates
|       ↓
|   find worst
|
| We maintain a max heap.
|
| Root = WORST candidate.
|--------------------------------------------------------------------------
*/

class MaxHeap {
    constructor(limit) {
        this.items = [];
        this.limit = limit;
    }

    get size() {
        return this.items.length;
    }

    peek() {
        return this.items[0] || null;
    }

    swap(i, j) {
        const temp =
            this.items[i];

        this.items[i] =
            this.items[j];

        this.items[j] =
            temp;
    }

    push(item) {
        this.items.push(item);

        let index =
            this.items.length - 1;

        while (index > 0) {
            const parent =
                Math.floor(
                    (index - 1) / 2
                );

            if (
                this.items[parent].score >=
                this.items[index].score
            ) {
                break;
            }

            this.swap(
                parent,
                index
            );

            index = parent;
        }
    }

    replaceRoot(item) {
        this.items[0] = item;

        let index = 0;

        while (true) {
            const left =
                index * 2 + 1;

            const right =
                left + 1;

            let largest = index;

            if (
                left < this.items.length &&
                this.items[left].score >
                this.items[largest].score
            ) {
                largest = left;
            }

            if (
                right < this.items.length &&
                this.items[right].score >
                this.items[largest].score
            ) {
                largest = right;
            }

            if (
                largest === index
            ) {
                break;
            }

            this.swap(
                index,
                largest
            );

            index = largest;
        }
    }

    add(item) {
        if (
            this.items.length <
            this.limit
        ) {
            this.push(item);
            return;
        }

        if (
            item.score <
            this.items[0].score
        ) {
            this.replaceRoot(item);
        }
    }

    toSortedArray() {
        return this.items
            .slice()
            .sort(
                (a, b) =>
                    a.score -
                    b.score
            )
            .map(
                item =>
                    item.candidate
            );
    }
}

/*
|--------------------------------------------------------------------------
| CANDIDATE POOL
|--------------------------------------------------------------------------
*/

const getCandidatePool = ({
    section,
    requirement,
    windows,
    professors,
    getValidRooms,
    occupancy,
    professorMap,
    limit
}) => {
    const validRooms =
        getValidRooms(
            section,
            requirement
        );

    if (
        validRooms.length === 0 ||
        professors.length === 0 ||
        windows.length === 0
    ) {
        return {
            candidates: [],
            totalValid: 0
        };
    }

    const heap =
        new MaxHeap(limit);

    let totalValid = 0;

    for (
        let w = 0;
        w < windows.length;
        w++
    ) {
        const window =
            windows[w];

        const sectionConflict =
            hasSlotConflict(
                occupancy.sectionSlots,
                section.id,
                window.slotIds
            );

        if (sectionConflict) {
            continue;
        }

        for (
            let p = 0;
            p < professors.length;
            p++
        ) {
            const professor =
                professors[p];

            if (
                hasSlotConflict(
                    occupancy.professorSlots,
                    professor.id,
                    window.slotIds
                )
            ) {
                continue;
            }

            for (
                let r = 0;
                r < validRooms.length;
                r++
            ) {
                const room =
                    validRooms[r];

                if (
                    hasSlotConflict(
                        occupancy.roomSlots,
                        room.id,
                        window.slotIds
                    )
                ) {
                    continue;
                }

                totalValid++;

                const candidate =
                    makeCandidate(
                        section,
                        requirement,
                        professor,
                        room,
                        window
                    );

                /*
                 * IMPORTANT:
                 * Score exactly ONCE.
                 */
                const score =
                    scoreCandidate(
                        candidate,
                        occupancy,
                        requirement,
                        professorMap
                    );

                heap.add({
                    candidate,
                    score
                });
            }
        }
    }

    return {
        candidates:
            heap.toSortedArray(),

        totalValid
    };
};

/*
|--------------------------------------------------------------------------
| REQUIREMENT WINDOWS
|--------------------------------------------------------------------------
*/

const getRequirementWindows = (
    requirement,
    windowsByHours
) => {
    const hours =
        num(
            requirement.remainingHours ||
            requirement.hours
        );

    return (
        windowsByHours.get(hours) ||
        []
    );
};

/*
|--------------------------------------------------------------------------
| FLEXIBILITY
|--------------------------------------------------------------------------
*/

const estimateRequirementFlexibility = ({
    section,
    requirement,
    windowsByHours,
    professorMap,
    getValidRooms,
    occupancy,
    maxScan = MAX_MRV_CANDIDATE_SCAN
}) => {
    const windows =
        getRequirementWindows(
            requirement,
            windowsByHours
        );

    const professors =
        professorMap.get(
            num(requirement.subject_id)
        ) || [];

    const validRooms =
        getValidRooms(
            section,
            requirement
        );

    if (
        windows.length === 0 ||
        professors.length === 0 ||
        validRooms.length === 0
    ) {
        return 0;
    }

    let valid = 0;
    let scanned = 0;

    for (
        let w = 0;
        w < windows.length;
        w++
    ) {
        const window =
            windows[w];

        if (
            hasSlotConflict(
                occupancy.sectionSlots,
                section.id,
                window.slotIds
            )
        ) {
            continue;
        }

        for (
            let p = 0;
            p < professors.length;
            p++
        ) {
            const professor =
                professors[p];

            if (
                hasSlotConflict(
                    occupancy.professorSlots,
                    professor.id,
                    window.slotIds
                )
            ) {
                continue;
            }

            for (
                let r = 0;
                r < validRooms.length;
                r++
            ) {
                const room =
                    validRooms[r];

                scanned++;

                if (
                    !hasSlotConflict(
                        occupancy.roomSlots,
                        room.id,
                        window.slotIds
                    )
                ) {
                    valid++;
                }

                if (
                    scanned >= maxScan
                ) {
                    return valid;
                }
            }
        }
    }

    return valid;
};

/*
|--------------------------------------------------------------------------
| MRV
|--------------------------------------------------------------------------
*/

const selectMRVRequirement = ({
    section,
    requirements,
    assignedIds,
    windowsByHours,
    professorMap,
    getValidRooms,
    occupancy
}) => {
    let selected = null;

    let selectedFlexibility =
        Infinity;

    for (
        let i = 0;
        i < requirements.length;
        i++
    ) {
        const requirement =
            requirements[i];

        if (
            assignedIds.has(
                requirement.id
            )
        ) {
            continue;
        }

        const flexibility =
            estimateRequirementFlexibility({
                section,
                requirement,
                windowsByHours,
                professorMap,
                getValidRooms,
                occupancy
            });

        if (
            flexibility === 0
        ) {
            return {
                requirement,
                flexibility: 0
            };
        }

        if (
            flexibility <
            selectedFlexibility
        ) {
            selected =
                requirement;

            selectedFlexibility =
                flexibility;

            /*
             * Can't get better than one.
             */
            if (
                flexibility === 1
            ) {
                break;
            }
        }
    }

    return {
        requirement: selected,
        flexibility:
            selectedFlexibility
    };
};

/*
|--------------------------------------------------------------------------
| FORWARD CHECK
|--------------------------------------------------------------------------
*/

const forwardCheck = ({
    section,
    requirements,
    assignedIds,
    windowsByHours,
    professorMap,
    getValidRooms,
    occupancy
}) => {
    for (
        let i = 0;
        i < requirements.length;
        i++
    ) {
        const requirement =
            requirements[i];

        if (
            assignedIds.has(
                requirement.id
            )
        ) {
            continue;
        }

        const flexibility =
            estimateRequirementFlexibility({
                section,
                requirement,
                windowsByHours,
                professorMap,
                getValidRooms,
                occupancy,
                maxScan: 1
            });

        if (
            flexibility === 0
        ) {
            return false;
        }
    }

    return true;
};

/*
|--------------------------------------------------------------------------
| GREEDY
|--------------------------------------------------------------------------
*/

const solveGreedy = ({
    section,
    requirements,
    windowsByHours,
    professorMap,
    getValidRooms,
    occupancy
}) => {
    const assignments = [];

    const assignedIds =
        new Set();

    while (
        assignedIds.size <
        requirements.length
    ) {
        const selected =
            selectMRVRequirement({
                section,
                requirements,
                assignedIds,
                windowsByHours,
                professorMap,
                getValidRooms,
                occupancy
            });

        if (
            !selected.requirement ||
            selected.flexibility === 0
        ) {
            releaseAssignments(
                assignments,
                occupancy
            );

            return {
                success: false,
                assignments: [],
                failedRequirement:
                    selected.requirement ||
                    null
            };
        }

        const requirement =
            selected.requirement;

        const windows =
            getRequirementWindows(
                requirement,
                windowsByHours
            );

        const professors =
            professorMap.get(
                num(requirement.subject_id)
            ) || [];

        const pool =
            getCandidatePool({
                section,
                requirement,
                windows,
                professors,
                getValidRooms,
                occupancy,
                professorMap,
                limit:
                    GREEDY_MAX_CANDIDATES_PER_REQUIREMENT
            });

        if (
            pool.candidates.length === 0
        ) {
            releaseAssignments(
                assignments,
                occupancy
            );

            return {
                success: false,
                assignments: [],
                failedRequirement:
                    requirement
            };
        }

        const candidate =
            pool.candidates[0];

        if (
            assignmentHasConflict(
                candidate,
                occupancy
            )
        ) {
            releaseAssignments(
                assignments,
                occupancy
            );

            return {
                success: false,
                assignments: [],
                failedRequirement:
                    requirement
            };
        }

        reserveAssignment(
            candidate,
            occupancy
        );

        assignments.push(
            candidate
        );

        assignedIds.add(
            requirement.id
        );

        log(
            `[GREEDY] ${section.section_name} | ` +
            `${requirement.subject_code} ` +
            `${requirement.type} | ` +
            `${candidate.day} ` +
            `${candidate.start_time}-` +
            `${candidate.end_time}`
        );
    }

    return {
        success: true,
        assignments
    };
};

/*
|--------------------------------------------------------------------------
| BACKTRACKING
|--------------------------------------------------------------------------
*/

const solveBacktracking = ({
    section,
    requirements,
    windowsByHours,
    professorMap,
    getValidRooms,
    occupancy
}) => {
    const start =
        Date.now();

    let nodes = 0;
    let timeout = false;
    let nodeLimit = false;

    const assignments = [];

    const assignedIds =
        new Set();

    const backtrack = () => {
        nodes++;

        if (
            Date.now() - start >=
            MAX_TIME_MS_PER_SECTION
        ) {
            timeout = true;
            return false;
        }

        if (
            nodes >
            MAX_BACKTRACK_NODES_PER_SECTION
        ) {
            nodeLimit = true;
            return false;
        }

        if (
            assignedIds.size ===
            requirements.length
        ) {
            return true;
        }

        const selected =
            selectMRVRequirement({
                section,
                requirements,
                assignedIds,
                windowsByHours,
                professorMap,
                getValidRooms,
                occupancy
            });

        if (
            !selected.requirement ||
            selected.flexibility === 0
        ) {
            return false;
        }

        const requirement =
            selected.requirement;

        const windows =
            getRequirementWindows(
                requirement,
                windowsByHours
            );

        const professors =
            professorMap.get(
                num(requirement.subject_id)
            ) || [];

        const pool =
            getCandidatePool({
                section,
                requirement,
                windows,
                professors,
                getValidRooms,
                occupancy,
                professorMap,
                limit:
                    BACKTRACK_MAX_CANDIDATES_PER_REQUIREMENT
            });

        if (
            pool.candidates.length === 0
        ) {
            return false;
        }

        for (
            let i = 0;
            i < pool.candidates.length;
            i++
        ) {
            const candidate =
                pool.candidates[i];

            if (
                timeout ||
                nodeLimit
            ) {
                return false;
            }

            if (
                assignmentHasConflict(
                    candidate,
                    occupancy
                )
            ) {
                continue;
            }

            reserveAssignment(
                candidate,
                occupancy
            );

            assignments.push(
                candidate
            );

            assignedIds.add(
                requirement.id
            );

            /*
             * Cheap forward check.
             */
            const possible =
                forwardCheck({
                    section,
                    requirements,
                    assignedIds,
                    windowsByHours,
                    professorMap,
                    getValidRooms,
                    occupancy
                });

            if (
                possible &&
                backtrack()
            ) {
                return true;
            }

            assignedIds.delete(
                requirement.id
            );

            assignments.pop();

            releaseAssignment(
                candidate,
                occupancy
            );
        }

        return false;
    };

    const success =
        backtrack();

    if (!success) {
        releaseAssignments(
            assignments,
            occupancy
        );
    }

    return {
        success,

        assignments:
            success
                ? [...assignments]
                : [],

        nodes,

        elapsed:
            Date.now() - start,

        timeout,

        nodeLimit,

        failureType:
            success
                ? null
                : timeout
                    ? "SEARCH_TIMEOUT"
                    : nodeLimit
                        ? "NODE_LIMIT"
                        : "CONSTRAINT_FAILURE"
    };
};

/*
|--------------------------------------------------------------------------
| HYBRID
|--------------------------------------------------------------------------
*/

const solveHybrid = ({
    section,
    requirements,
    windowsByHours,
    professorMap,
    getValidRooms,
    occupancy
}) => {
    const greedy =
        solveGreedy({
            section,
            requirements,
            windowsByHours,
            professorMap,
            getValidRooms,
            occupancy
        });

    if (
        greedy.success
    ) {
        return {
            success: true,
            method: "GREEDY",
            assignments:
                greedy.assignments,
            nodes: 0,
            elapsed: 0
        };
    }

    const backtrack =
        solveBacktracking({
            section,
            requirements,
            windowsByHours,
            professorMap,
            getValidRooms,
            occupancy
        });

    return {
        success:
            backtrack.success,

        method:
            "BACKTRACK",

        assignments:
            backtrack.assignments,

        nodes:
            backtrack.nodes,

        elapsed:
            backtrack.elapsed,

        timeout:
            backtrack.timeout,

        nodeLimit:
            backtrack.nodeLimit,

        failureType:
            backtrack.failureType,

        failedRequirement:
            greedy.failedRequirement
    };
};

/*
|--------------------------------------------------------------------------
| FAILURE ANALYSIS
|--------------------------------------------------------------------------
*/

const analyzeRequirement = ({
    section,
    requirement,
    windowsByHours,
    professorMap,
    getValidRooms,
    occupancy
}) => {
    const windows =
        getRequirementWindows(
            requirement,
            windowsByHours
        );

    const professors =
        professorMap.get(
            num(requirement.subject_id)
        ) || [];

    const validRooms =
        getValidRooms(
            section,
            requirement
        );

    let available = 0;
    let professorBlocked = 0;
    let roomBlocked = 0;
    let sectionBlocked = 0;

    let scanned = 0;

    outer:
    for (
        let w = 0;
        w < windows.length;
        w++
    ) {
        const window =
            windows[w];

        const sectionConflict =
            hasSlotConflict(
                occupancy.sectionSlots,
                section.id,
                window.slotIds
            );

        for (
            let p = 0;
            p < professors.length;
            p++
        ) {
            const professor =
                professors[p];

            const profConflict =
                hasSlotConflict(
                    occupancy.professorSlots,
                    professor.id,
                    window.slotIds
                );

            for (
                let r = 0;
                r < validRooms.length;
                r++
            ) {
                const room =
                    validRooms[r];

                scanned++;

                const roomConflict =
                    hasSlotConflict(
                        occupancy.roomSlots,
                        room.id,
                        window.slotIds
                    );

                if (
                    !sectionConflict &&
                    !profConflict &&
                    !roomConflict
                ) {
                    available++;
                } else {
                    if (sectionConflict) {
                        sectionBlocked++;
                    }

                    if (profConflict) {
                        professorBlocked++;
                    }

                    if (roomConflict) {
                        roomBlocked++;
                    }
                }

                if (
                    scanned >=
                    MAX_FAILURE_ANALYSIS_SCAN
                ) {
                    break outer;
                }
            }
        }
    }

    let bottleneck =
        "MULTIPLE RESOURCES";

    if (available > 0) {
        bottleneck =
            "COMBINATION / BACKTRACKING CONSTRAINT";
    } else if (
        professorBlocked >
        roomBlocked &&
        professorBlocked >
        sectionBlocked
    ) {
        bottleneck =
            "PROFESSOR";
    } else if (
        roomBlocked >
        professorBlocked &&
        roomBlocked >
        sectionBlocked
    ) {
        bottleneck =
            "ROOM";
    } else if (
        sectionBlocked >
        professorBlocked &&
        sectionBlocked >
        roomBlocked
    ) {
        bottleneck =
            "SECTION/TIMESLOT";
    }

    return {
        subjectCode:
            requirement.subject_code,

        subjectId:
            requirement.subject_id,

        type:
            requirement.type,

        hours:
            requirement.remainingHours ||
            requirement.hours,

        windows:
            windows.length,

        professors:
            professors.length,

        validRooms:
            validRooms.length,

        availableCandidates:
            available,

        professorBlocked,

        roomBlocked,

        sectionBlocked,

        bottleneck
    };
};

/*
|--------------------------------------------------------------------------
| SAVE SECTION SCHEDULES
|--------------------------------------------------------------------------
|
| Bulk INSERT instead of one INSERT per slot.
|--------------------------------------------------------------------------
*/

const saveSectionSchedules = async (
    assignments,
    academicTermId
) => {
    if (
        assignments.length === 0
    ) {
        return;
    }

    const values = [];

    for (
        let i = 0;
        i < assignments.length;
        i++
    ) {
        const assignment =
            assignments[i];

        for (
            let j = 0;
            j < assignment.window.slots.length;
            j++
        ) {
            const slot =
                assignment.window.slots[j];

            values.push([
                assignment.sectionId,
                assignment.requirement.subject_id,
                assignment.professorId,
                assignment.roomId,
                num(slot.id),
                academicTermId
            ]);
        }
    }

    if (values.length === 0) {
        return;
    }

    const placeholders =
        values
            .map(() => "(?, ?, ?, ?, ?, ?)")
            .join(",");

    const flatValues =
        values.flat();

    await db.query(
        `
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
        `,
        flatValues
    );
};

/*
|--------------------------------------------------------------------------
| GENERATE SCHEDULES
|--------------------------------------------------------------------------
*/

const generateSchedules = async (
    req
) => {
    const {
        programId,
        academicTermId
    } = req.body;

    if (
        !programId ||
        !academicTermId
    ) {
        throw new Error(
            "programId and academicTermId are required."
        );
    }

    console.log(
        `\n[SCHEDULER] Program=${programId} ` +
        `Term=${academicTermId}`
    );

    /*
     * --------------------------------------------------------------
     * LOAD SECTIONS
     * --------------------------------------------------------------
     */

    const sections =
        await getSections(
            programId,
            academicTermId
        );

    if (
        sections.length === 0
    ) {
        throw new Error(
            "No sections found for selected program."
        );
    }

    /*
     * --------------------------------------------------------------
     * TIME SLOTS
     * --------------------------------------------------------------
     */

    const timeSlots =
        await getTimeSlots();

    if (
        timeSlots.length === 0
    ) {
        throw new Error(
            "No available time slots."
        );
    }

    const slotsByDay =
        groupSlotsByDay(
            timeSlots
        );

    /*
     * --------------------------------------------------------------
     * ROOMS
     * --------------------------------------------------------------
     */

    const rooms =
        await getRooms();

    if (
        rooms.length === 0
    ) {
        throw new Error(
            "No available rooms."
        );
    }

    /*
     * --------------------------------------------------------------
     * EXISTING SCHEDULES
     * --------------------------------------------------------------
     */

    const existingSchedules =
        await loadExistingSchedules(
            academicTermId
        );

    const occupancy =
        createOccupancy();

    reserveExistingSchedules(
        existingSchedules,
        occupancy
    );

    const existingRequirementCounts =
        getExistingRequirementCounts(
            existingSchedules
        );

    /*
     * --------------------------------------------------------------
     * BULK LOAD SECTION DATA
     * --------------------------------------------------------------
     */

    const sectionIds =
        sections.map(
            section => num(section.id)
        );

    const [
        studentCounts,
        sectionSubjectsMap
    ] = await Promise.all([
        getSectionStudentCounts(
            sectionIds,
            academicTermId
        ),

        getAllSectionSubjects(
            sectionIds,
            academicTermId
        )
    ]);

    /*
     * --------------------------------------------------------------
     * PREPARE SECTIONS
     * --------------------------------------------------------------
     */

    const preparedSections = [];

    const allSubjectIds =
        new Set();

    for (
        let i = 0;
        i < sections.length;
        i++
    ) {
        const section =
            sections[i];

        section.student_count =
            studentCounts.get(
                num(section.id)
            ) || 0;

        section.subjects =
            sectionSubjectsMap.get(
                num(section.id)
            ) || [];

        if (
            section.subjects.length === 0
        ) {
            log(
                `[SKIP] ${section.section_name} no subjects`
            );

            continue;
        }

        section.requirements =
            buildRequirements(
                section.subjects
            );

        section.missingRequirements =
            getMissingRequirements(
                section,
                existingRequirementCounts
            );

        const status =
            getSectionStatus(
                section,
                existingRequirementCounts
            );

        section.isComplete =
            status.complete;

        if (
            section.isComplete
        ) {
            log(
                `[LOCKED] ${section.section_name}`
            );

            continue;
        }

        for (
            let r = 0;
            r <
            section.missingRequirements.length;
            r++
        ) {
            allSubjectIds.add(
                num(
                    section
                        .missingRequirements[r]
                        .subject_id
                )
            );
        }

        preparedSections.push(
            section
        );
    }

    if (
        preparedSections.length === 0
    ) {
        return {
            success: true,
            partial: false,
            programId,
            academicTermId,

            sectionCount:
                sections.length,

            newSections: 0,
            scheduledSections: 0,
            failedSections: 0,

            scheduled: [],
            failed: [],
            schedules: [],

            message:
                "All sections already have complete schedules."
        };
    }

    /*
     * --------------------------------------------------------------
     * PROFESSORS
     * --------------------------------------------------------------
     */

    const professorMap =
        await getProfessorMap(
            [...allSubjectIds]
        );

    /*
     * --------------------------------------------------------------
     * ROOM CACHE
     * --------------------------------------------------------------
     */

    const getValidRooms =
        createRoomCache(
            rooms
        );

    /*
     * --------------------------------------------------------------
     * WINDOWS
     * --------------------------------------------------------------
     */

    const uniqueHours =
        [
            ...new Set(
                preparedSections.flatMap(
                    section =>
                        section.missingRequirements.map(
                            requirement =>
                                num(
                                    requirement.remainingHours ||
                                    requirement.hours
                                )
                        )
                )
            )
        ];

    const windowsByHours =
        new Map();

    for (
        let i = 0;
        i < uniqueHours.length;
        i++
    ) {
        const hours =
            uniqueHours[i];

        windowsByHours.set(
            hours,
            buildWindows(
                slotsByDay,
                hours
            )
        );
    }

    /*
     * --------------------------------------------------------------
     * SECTION ORDERING
     * --------------------------------------------------------------
     *
     * Hardest sections first.
     *
     * This calculation is intentionally limited.
     */

    const sectionJobs =
        preparedSections.map(
            section => {
                let difficulty = 0;

                for (
                    let i = 0;
                    i <
                    section.missingRequirements.length;
                    i++
                ) {
                    const requirement =
                        section
                            .missingRequirements[i];

                    const flexibility =
                        estimateRequirementFlexibility({
                            section,
                            requirement,
                            windowsByHours,
                            professorMap,
                            getValidRooms,
                            occupancy,
                            maxScan: 50
                        });

                    difficulty +=
                        flexibility;
                }

                return {
                    section,
                    difficulty
                };
            }
        );

    sectionJobs.sort(
        (a, b) =>
            a.difficulty -
            b.difficulty
    );

    /*
     * --------------------------------------------------------------
     * RESULTS
     * --------------------------------------------------------------
     */

    const scheduledSections = [];

    const failedSections = [];

    const generatedSchedules = [];

    /*
     * --------------------------------------------------------------
     * SOLVE
     * --------------------------------------------------------------
     */

    for (
        let index = 0;
        index < sectionJobs.length;
        index++
    ) {
        const section =
            sectionJobs[index].section;

        console.log(
            `[SCHEDULER] ` +
            `${index + 1}/${sectionJobs.length} ` +
            `${section.section_name}`
        );

        const result =
            solveHybrid({
                section,

                requirements:
                    section.missingRequirements,

                windowsByHours,

                professorMap,

                getValidRooms,

                occupancy
            });

        if (
            result.success
        ) {
            try {
                await saveSectionSchedules(
                    result.assignments,
                    academicTermId
                );

                scheduledSections.push(
                    section.section_name
                );

                for (
                    let i = 0;
                    i < result.assignments.length;
                    i++
                ) {
                    const assignment =
                        result.assignments[i];

                    generatedSchedules.push({
                        section:
                            section.section_name,

                        sectionId:
                            section.id,

                        yearLevel:
                            section.year_level,

                        subject:
                            assignment
                                .requirement
                                .subject_code,

                        subjectId:
                            assignment
                                .requirement
                                .subject_id,

                        type:
                            assignment
                                .requirement
                                .type,

                        professor:
                            `${assignment.professor.firstname} ${assignment.professor.lastname}`,

                        professorId:
                            assignment.professorId,

                        room:
                            assignment.room.room_name,

                        roomId:
                            assignment.roomId,

                        roomType:
                            assignment.room.room_type,

                        day:
                            assignment.day,

                        start:
                            assignment.start_time,

                        end:
                            assignment.end_time
                    });
                }

                /*
                 * Keep successful reservations.
                 */

                console.log(
                    `[SAVED] ` +
                    `${section.section_name} ` +
                    `(${result.method})`
                );
            } catch (saveError) {
                releaseAssignments(
                    result.assignments,
                    occupancy
                );

                failedSections.push({
                    sectionId:
                        section.id,

                    section:
                        section.section_name,

                    reason:
                        `Database save failed: ` +
                        saveError.message,

                    failureType:
                        "DATABASE_SAVE_FAILURE",

                    bottleneck:
                        "DATABASE",

                    bottleneckAnalysis: []
                });
            }

            continue;
        }

        /*
         * ----------------------------------------------------------
         * FAILURE ANALYSIS
         * ----------------------------------------------------------
         */

        const analyses = [];

        for (
            let i = 0;
            i <
            section.missingRequirements.length;
            i++
        ) {
            analyses.push(
                analyzeRequirement({
                    section,

                    requirement:
                        section
                            .missingRequirements[i],

                    windowsByHours,

                    professorMap,

                    getValidRooms,

                    occupancy
                })
            );
        }

        let worst = null;
        let worstScore = -Infinity;

        for (
            let i = 0;
            i < analyses.length;
            i++
        ) {
            const analysis =
                analyses[i];

            let score = 0;

            if (
                analysis.availableCandidates === 0
            ) {
                score += 100000;
            }

            score +=
                analysis.professorBlocked;

            score +=
                analysis.roomBlocked;

            score +=
                analysis.sectionBlocked;

            if (
                score >
                worstScore
            ) {
                worstScore =
                    score;

                worst =
                    analysis;
            }
        }

        const reason =
            worst
                ? `Unable to schedule ` +
                  `${worst.subjectCode} ` +
                  `${worst.type}. ` +
                  `Likely bottleneck: ` +
                  `${worst.bottleneck}.`
                : `Unable to find a valid ` +
                  `schedule for section ` +
                  `${section.section_name}.`;

        console.log(
            `[FAILED] ` +
            `${section.section_name} | ` +
            `${result.failureType || "CONSTRAINT_FAILURE"}`
        );

        failedSections.push({
            sectionId:
                section.id,

            section:
                section.section_name,

            reason,

            failureType:
                result.failureType ||
                "CONSTRAINT_FAILURE",

            bottleneck:
                worst?.bottleneck ||
                "UNKNOWN",

            bottleneckAnalysis:
                analyses
        });
    }

    /*
     * --------------------------------------------------------------
     * FINAL STATUS
     * --------------------------------------------------------------
     */

    const completeSuccess =
        failedSections.length === 0;

    const partial =
        scheduledSections.length > 0 &&
        failedSections.length > 0;

    /*
     * --------------------------------------------------------------
     * BOTTLENECK SUMMARY
     * --------------------------------------------------------------
     */

    const bottleneckSummary = {
        professor: 0,
        room: 0,
        sectionTimeslot: 0,
        multipleResources: 0,
        combination: 0,
        searchTimeout: 0,
        nodeLimit: 0,
        unknown: 0
    };

    for (
        let i = 0;
        i < failedSections.length;
        i++
    ) {
        const failed =
            failedSections[i];

        const bottleneck =
            failed.bottleneck;

        if (
            bottleneck === "PROFESSOR"
        ) {
            bottleneckSummary.professor++;
        } else if (
            bottleneck === "ROOM"
        ) {
            bottleneckSummary.room++;
        } else if (
            bottleneck === "SECTION/TIMESLOT"
        ) {
            bottleneckSummary.sectionTimeslot++;
        } else if (
            bottleneck === "MULTIPLE RESOURCES"
        ) {
            bottleneckSummary.multipleResources++;
        } else if (
            bottleneck ===
            "COMBINATION / BACKTRACKING CONSTRAINT"
        ) {
            bottleneckSummary.combination++;
        } else if (
            failed.failureType ===
            "SEARCH_TIMEOUT"
        ) {
            bottleneckSummary.searchTimeout++;
        } else if (
            failed.failureType ===
            "NODE_LIMIT"
        ) {
            bottleneckSummary.nodeLimit++;
        } else {
            bottleneckSummary.unknown++;
        }
    }

    /*
     * --------------------------------------------------------------
     * RESULT
     * --------------------------------------------------------------
     */

    return {
        success:
            completeSuccess,

        partial,

        programId,

        academicTermId,

        sectionCount:
            sections.length,

        newSections:
            preparedSections.length,

        scheduledSections:
            scheduledSections.length,

        failedSections:
            failedSections.length,

        scheduled:
            scheduledSections,

        failed:
            failedSections,

        bottleneckSummary,

        schedules:
            generatedSchedules,

        simulation: {
            algorithm:
                "OPTIMIZED_HYBRID_MRV_LAZY_TOPK_BACKTRACK_WEEKLY",

            schedulingDays:
                [...DAY_ORDER],

            targetDailyHours:
                SECTION_TARGET_DAILY_HOURS,

            weeklyDistribution:
                true,

            maxBacktrackNodesPerSection:
                MAX_BACKTRACK_NODES_PER_SECTION,

            maxTimeMsPerSection:
                MAX_TIME_MS_PER_SECTION,

            greedyCandidates:
                GREEDY_MAX_CANDIDATES_PER_REQUIREMENT,

            backtrackCandidates:
                BACKTRACK_MAX_CANDIDATES_PER_REQUIREMENT,

            totalRooms:
                rooms.length,

            lectureRooms:
                rooms.filter(
                    room =>
                        room.room_type ===
                        "lecture"
                ).length,

            laboratoryRooms:
                rooms.filter(
                    room =>
                        room.room_type ===
                        "laboratory"
                ).length,

            totalTimeSlots:
                timeSlots.length,

            existingScheduleRows:
                existingSchedules.length
        },

        message:
            completeSuccess
                ? `All incomplete sections were ` +
                  `scheduled successfully.`
                : partial
                    ? `Schedule generation partially ` +
                      `completed. ` +
                      `${scheduledSections.length} ` +
                      `section(s) scheduled and ` +
                      `${failedSections.length} ` +
                      `section(s) failed.`
                    : `No incomplete sections could ` +
                      `be scheduled.`
    };
};

/*
|--------------------------------------------------------------------------
| EXPORT
|--------------------------------------------------------------------------
*/

module.exports = {
    generateSchedules,
    getSectionSubjects,
    buildRequirements,
    getSections
};