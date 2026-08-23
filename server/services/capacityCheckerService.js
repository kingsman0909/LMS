const db = require("../config/db");

/*
|--------------------------------------------------------------------------
| UNIVERSITY PROFESSOR CAPACITY CHECKER SERVICE
|--------------------------------------------------------------------------
|
| PURPOSE
|--------------------------------------------------------------------------
|
| Strong professor-capacity feasibility checker.
|
| PROFESSOR POPULATION RULE
|--------------------------------------------------------------------------
|
| A professor is considered AVAILABLE only when:
|
|   users.role   = 'professor'
|   users.status = 'active'
|
| professor_subjects is used ONLY to determine qualification.
|
|--------------------------------------------------------------------------
| TEACHING HOURS
|--------------------------------------------------------------------------
|
| lecture unit = 1 hour / week
| laboratory unit = 3 hours / week
|
|--------------------------------------------------------------------------
| IMPORTANT
|--------------------------------------------------------------------------
|
| This checker does NOT replace the actual scheduler.
|
| It does not solve:
|
|   - exact room conflicts
|   - exact time-slot conflicts
|   - professor time availability
|   - section time conflicts
|   - exact scheduler backtracking
|
| It checks whether professor teaching capacity is feasible.
|
|--------------------------------------------------------------------------
*/


/*
|--------------------------------------------------------------------------
| CONFIG
|--------------------------------------------------------------------------
*/

const DEFAULT_MAX_WEEKLY_HOURS = 18;


/*
|--------------------------------------------------------------------------
| BASIC HELPERS
|--------------------------------------------------------------------------
*/

const num = value => {

    const n = Number(value);

    return Number.isFinite(n)
        ? n
        : 0;
};


const positiveInt = value => {

    const n = Number(value);

    return Number.isInteger(n) && n > 0
        ? n
        : 0;
};


const normalizeText = value =>
    String(value ?? "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");


const round2 = value =>
    Number(
        Number(value || 0).toFixed(2)
    );


/*
|--------------------------------------------------------------------------
| YEAR LEVEL NORMALIZATION
|--------------------------------------------------------------------------
*/

const normalizeYearLevel = value => {

    const raw =
        normalizeText(value);

    if (!raw) {
        return "";
    }


    if (
        raw.includes("1st") ||
        raw.includes("first") ||
        raw === "1" ||
        raw === "year 1" ||
        raw === "year_1" ||
        raw === "1st year"
    ) {

        return "year_1";
    }


    if (
        raw.includes("2nd") ||
        raw.includes("second") ||
        raw === "2" ||
        raw === "year 2" ||
        raw === "year_2" ||
        raw === "2nd year"
    ) {

        return "year_2";
    }


    if (
        raw.includes("3rd") ||
        raw.includes("third") ||
        raw === "3" ||
        raw === "year 3" ||
        raw === "year_3" ||
        raw === "3rd year"
    ) {

        return "year_3";
    }


    if (
        raw.includes("4th") ||
        raw.includes("fourth") ||
        raw === "4" ||
        raw === "year 4" ||
        raw === "year_4" ||
        raw === "4th year"
    ) {

        return "year_4";
    }


    return raw.replace(/\s+/g, "_");
};


/*
|--------------------------------------------------------------------------
| SEMESTER NORMALIZATION
|--------------------------------------------------------------------------
*/

const normalizeSemester = value => {

    const raw =
        normalizeText(value);

    if (!raw) {
        return "";
    }


    if (
        raw === "1" ||
        raw === "1st" ||
        raw === "1st semester" ||
        raw === "first semester" ||
        raw.includes("1st semester") ||
        raw.includes("first semester")
    ) {

        return "1st semester";
    }


    if (
        raw === "2" ||
        raw === "2nd" ||
        raw === "2nd semester" ||
        raw === "second semester" ||
        raw.includes("2nd semester") ||
        raw.includes("second semester")
    ) {

        return "2nd semester";
    }


    if (
        raw === "summer" ||
        raw === "summer semester" ||
        raw.includes("summer")
    ) {

        return "summer";
    }


    return raw;
};


/*
|--------------------------------------------------------------------------
| DINIC MAX FLOW
|--------------------------------------------------------------------------
*/

class Dinic {

    constructor(nodeCount) {

        this.nodeCount =
            nodeCount;

        this.graph =
            Array.from(
                {
                    length: nodeCount
                },
                () => []
            );
    }


    addEdge(
        from,
        to,
        capacity
    ) {

        const safeCapacity =
            Math.max(
                0,
                Math.floor(
                    Number(capacity) || 0
                )
            );


        const forward = {

            to,

            rev:
                this.graph[to].length,

            capacity:
                safeCapacity,

            originalCapacity:
                safeCapacity
        };


        const backward = {

            to:
                from,

            rev:
                this.graph[from].length,

            capacity:
                0,

            originalCapacity:
                0
        };


        this.graph[from].push(
            forward
        );

        this.graph[to].push(
            backward
        );


        return {

            from,

            index:
                this.graph[from].length - 1
        };
    }


    bfs(
        source,
        sink
    ) {

        const level =
            new Array(
                this.nodeCount
            ).fill(-1);


        const queue = [];

        level[source] = 0;

        queue.push(source);


        let head = 0;


        while (
            head <
            queue.length
        ) {

            const node =
                queue[head++];


            for (
                const edge
                of this.graph[node]
            ) {

                if (
                    edge.capacity > 0 &&
                    level[edge.to] < 0
                ) {

                    level[edge.to] =
                        level[node] + 1;

                    queue.push(
                        edge.to
                    );
                }
            }
        }


        return level[sink] >= 0
            ? level
            : null;
    }


    dfs(
        node,
        sink,
        pushed,
        level,
        ptr
    ) {

        if (
            node === sink
        ) {

            return pushed;
        }


        while (
            ptr[node] <
            this.graph[node].length
        ) {

            const edge =
                this.graph[node][
                    ptr[node]
                ];


            if (
                edge.capacity > 0 &&
                level[edge.to] ===
                    level[node] + 1
            ) {

                const flow =
                    this.dfs(
                        edge.to,
                        sink,
                        Math.min(
                            pushed,
                            edge.capacity
                        ),
                        level,
                        ptr
                    );


                if (
                    flow > 0
                ) {

                    edge.capacity -=
                        flow;


                    this.graph[
                        edge.to
                    ][
                        edge.rev
                    ].capacity +=
                        flow;


                    return flow;
                }
            }


            ptr[node]++;
        }


        return 0;
    }


    maxFlow(
        source,
        sink
    ) {

        let flow = 0;


        while (true) {

            const level =
                this.bfs(
                    source,
                    sink
                );


            if (!level) {
                break;
            }


            const ptr =
                new Array(
                    this.nodeCount
                ).fill(0);


            while (true) {

                const pushed =
                    this.dfs(
                        source,
                        sink,
                        Number.MAX_SAFE_INTEGER,
                        level,
                        ptr
                    );


                if (
                    pushed <= 0
                ) {

                    break;
                }


                flow +=
                    pushed;
            }
        }


        return flow;
    }


    getUsedCapacity(
        edgeReference
    ) {

        const edge =
            this.graph[
                edgeReference.from
            ][
                edgeReference.index
            ];


        return (
            edge.originalCapacity -
            edge.capacity
        );
    }
}


/*
|--------------------------------------------------------------------------
| GET PROGRAMS
|--------------------------------------------------------------------------
*/

const getPrograms = async () => {

    const [rows] = await db.query(`
        SELECT
            id,
            program_name
        FROM programs
        ORDER BY id ASC
    `);


    return rows.map(
        row => ({

            id:
                positiveInt(
                    row.id
                ),

            name:
                row.program_name

        })
    );
};


/*
|--------------------------------------------------------------------------
| GET ACADEMIC TERM
|--------------------------------------------------------------------------
*/

const getAcademicTerm = async academicTermId => {

    const termId =
        positiveInt(
            academicTermId
        );


    if (
        termId <= 0
    ) {

        throw new Error(
            "A valid academicTermId is required."
        );
    }


    const [rows] = await db.query(`
        SELECT
            id,
            semester
        FROM academic_terms
        WHERE id = ?
        LIMIT 1
    `, [
        termId
    ]);


    if (
        rows.length === 0
    ) {

        throw new Error(
            `Academic term with ID ${termId} was not found.`
        );
    }


    return {

        id:
            positiveInt(
                rows[0].id
            ),

        semester:
            rows[0].semester

    };
};


/*
|--------------------------------------------------------------------------
| GET PROGRAM SECTIONS
|--------------------------------------------------------------------------
*/

const getProgramSections = async (
    programId,
    academicTermId
) => {

    const [rows] = await db.query(`
        SELECT
            year_level,
            COUNT(*) AS section_count
        FROM sections
        WHERE program_id = ?
          AND academic_term_id = ?
        GROUP BY year_level
        ORDER BY year_level ASC
    `, [
        programId,
        academicTermId
    ]);


    const sectionsByYearLevel =
        new Map();


    let totalSections = 0;


    for (
        const row
        of rows
    ) {

        const yearLevel =
            normalizeYearLevel(
                row.year_level
            );


        const sectionCount =
            positiveInt(
                row.section_count
            );


        if (
            !yearLevel
        ) {

            continue;
        }


        sectionsByYearLevel.set(
            yearLevel,
            sectionCount
        );


        totalSections +=
            sectionCount;
    }


    return {

        rows,

        sectionsByYearLevel,

        totalSections

    };
};


/*
|--------------------------------------------------------------------------
| GET PROGRAM CURRICULUM
|--------------------------------------------------------------------------
*/

const getProgramCurriculum = async (
    programId,
    academicTerm
) => {

    const termSemester =
        normalizeSemester(
            academicTerm?.semester
        );


    if (
        !termSemester
    ) {

        throw new Error(
            `Academic term ${academicTerm?.id || ""} has no valid semester value.`
        );
    }


    const [rows] = await db.query(`
        SELECT

            cs.id AS curriculum_subject_id,

            cs.subject_id,

            cs.year_level,

            cs.semester,

            sub.subject_code,

            sub.subject_name,

            sub.lecture_units,

            sub.lab_units

        FROM curriculum_subjects cs

        INNER JOIN subjects sub
            ON sub.id = cs.subject_id

        WHERE cs.program_id = ?

        ORDER BY
            cs.year_level ASC,
            cs.semester ASC,
            sub.subject_code ASC
    `, [
        programId
    ]);


    const filteredRows =
        rows.filter(
            row =>
                normalizeSemester(
                    row.semester
                ) ===
                termSemester
        );


    console.log(
        `[CURRICULUM] Program ${programId} | ` +
        `Term semester: ${termSemester} | ` +
        `Total curriculum rows: ${rows.length} | ` +
        `Matching semester rows: ${filteredRows.length}`
    );


    return filteredRows.map(
        row => ({

            curriculumSubjectId:
                positiveInt(
                    row.curriculum_subject_id
                ),

            subjectId:
                positiveInt(
                    row.subject_id
                ),

            yearLevel:
                String(
                    row.year_level ?? ""
                ).trim(),

            normalizedYearLevel:
                normalizeYearLevel(
                    row.year_level
                ),

            semester:
                String(
                    row.semester ?? ""
                ).trim(),

            subjectCode:
                row.subject_code,

            subjectName:
                row.subject_name,

            lectureUnits:
                Math.max(
                    0,
                    num(
                        row.lecture_units
                    )
                ),

            labUnits:
                Math.max(
                    0,
                    num(
                        row.lab_units
                    )
                )

        })
    );
};


/*
|--------------------------------------------------------------------------
| GET ALL UNIVERSITY CURRICULUM
|--------------------------------------------------------------------------
*/

const getUniversityCurriculum = async (
    programs,
    academicTerm
) => {

    const results = [];


    for (
        const program
        of programs
    ) {

        const curriculum =
            await getProgramCurriculum(
                program.id,
                academicTerm
            );


        results.push({

            programId:
                program.id,

            programName:
                program.name,

            curriculum

        });
    }


    return results;
};


/*
|--------------------------------------------------------------------------
| SUBJECT WEEKLY HOURS
|--------------------------------------------------------------------------
*/

const getSubjectWeeklyHours = subject => {

    const lectureHours =
        Math.max(
            0,
            num(
                subject.lectureUnits
            )
        );


    const laboratoryHours =
        Math.max(
            0,
            num(
                subject.labUnits
            )
        ) * 3;


    return {

        lectureHours,

        laboratoryHours,

        totalHours:
            lectureHours +
            laboratoryHours

    };
};


/*
|--------------------------------------------------------------------------
| GET ACTIVE PROFESSOR QUALIFICATIONS
|--------------------------------------------------------------------------
|
| IMPORTANT FIX
|--------------------------------------------------------------------------
|
| PROFESSOR EXISTENCE:
|
|   users.role = 'professor'
|   users.status = 'active'
|
| PROFESSOR QUALIFICATION:
|
|   professor_subjects
|
| This means inactive professors cannot enter the capacity calculation.
|
|--------------------------------------------------------------------------
*/

const getProfessorQualifications = async subjects => {

    if (
        !Array.isArray(subjects) ||
        subjects.length === 0
    ) {

        return {

            professors: [],

            qualificationsBySubject:
                new Map(),

            qualificationsByProfessor:
                new Map(),

            totalActiveProfessors:
                0,

            qualifiedProfessorCount:
                0

        };
    }


    /*
    |--------------------------------------------------------------------------
    | SUBJECT IDS
    |--------------------------------------------------------------------------
    */

    const subjectIds =
        [
            ...new Set(
                subjects
                    .map(
                        subject =>
                            positiveInt(
                                subject.subjectId
                            )
                    )
                    .filter(
                        id => id > 0
                    )
            )
        ];


    if (
        subjectIds.length === 0
    ) {

        return {

            professors: [],

            qualificationsBySubject:
                new Map(),

            qualificationsByProfessor:
                new Map(),

            totalActiveProfessors:
                0,

            qualifiedProfessorCount:
                0

        };
    }


    /*
    |--------------------------------------------------------------------------
    | LOAD ACTIVE PROFESSOR POOL
    |--------------------------------------------------------------------------
    |
    | THIS IS THE CRITICAL FIX.
    |
    | We DO NOT start from professor_subjects.
    |
    | We start from actual active professor accounts.
    |
    |--------------------------------------------------------------------------
    */

    const [professorRows] =
        await db.query(`
            SELECT

                p.id AS professor_id,

                p.user_id,

                p.employee_id,

                p.firstname,

                p.lastname,

                p.max_weekly_hours

            FROM profesor p

            INNER JOIN users u
                ON u.id = p.user_id

            WHERE u.role = 'professor'
              AND u.status = 'active'

            ORDER BY
                p.id ASC
        `);


    /*
    |--------------------------------------------------------------------------
    | BUILD ACTIVE PROFESSOR MAP
    |--------------------------------------------------------------------------
    */

    const professorMap =
        new Map();


    for (
        const row
        of professorRows
    ) {

        const professorId =
            positiveInt(
                row.professor_id
            );


        if (
            professorId <= 0
        ) {

            continue;
        }


        const maxHours =
            row.max_weekly_hours == null

                ? DEFAULT_MAX_WEEKLY_HOURS

                : Math.max(
                    0,
                    num(
                        row.max_weekly_hours
                    )
                );


        professorMap.set(
            professorId,
            {

                professorId,

                userId:
                    positiveInt(
                        row.user_id
                    ),

                employeeId:
                    row.employee_id,

                firstname:
                    row.firstname,

                lastname:
                    row.lastname,

                name:
                    `${row.firstname || ""} ${row.lastname || ""}`
                        .trim(),

                maxWeeklyHours:
                    maxHours,

                qualifiedSubjectIds:
                    new Set()

            }
        );
    }


    /*
    |--------------------------------------------------------------------------
    | QUALIFICATION MAPS
    |--------------------------------------------------------------------------
    */

    const qualificationsBySubject =
        new Map();


    const qualificationsByProfessor =
        new Map();


    /*
    |--------------------------------------------------------------------------
    | LOAD QUALIFICATIONS
    |--------------------------------------------------------------------------
    |
    | Only ACTIVE professors can appear here.
    |
    |--------------------------------------------------------------------------
    */

    const placeholders =
        subjectIds
            .map(
                () => "?"
            )
            .join(",");


    const [qualificationRows] =
        await db.query(`
            SELECT DISTINCT

                ps.professor_id,

                ps.subject_id

            FROM professor_subjects ps

            INNER JOIN profesor p
                ON p.id = ps.professor_id

            INNER JOIN users u
                ON u.id = p.user_id

            WHERE u.role = 'professor'
              AND u.status = 'active'
              AND ps.subject_id IN (${placeholders})

            ORDER BY
                ps.professor_id ASC,
                ps.subject_id ASC
        `, subjectIds);


    /*
    |--------------------------------------------------------------------------
    | BUILD QUALIFICATIONS
    |--------------------------------------------------------------------------
    */

    for (
        const row
        of qualificationRows
    ) {

        const professorId =
            positiveInt(
                row.professor_id
            );


        const subjectId =
            positiveInt(
                row.subject_id
            );


        if (
            professorId <= 0 ||
            subjectId <= 0
        ) {

            continue;
        }


        /*
        |--------------------------------------------------------------------------
        | SAFETY CHECK
        |--------------------------------------------------------------------------
        */

        const professor =
            professorMap.get(
                professorId
            );


        if (!professor) {

            continue;
        }


        /*
        |--------------------------------------------------------------------------
        | PROFESSOR -> SUBJECT
        |--------------------------------------------------------------------------
        */

        professor.qualifiedSubjectIds.add(
            subjectId
        );


        /*
        |--------------------------------------------------------------------------
        | SUBJECT -> PROFESSORS
        |--------------------------------------------------------------------------
        */

        if (
            !qualificationsBySubject.has(
                subjectId
            )
        ) {

            qualificationsBySubject.set(
                subjectId,
                new Set()
            );
        }


        qualificationsBySubject
            .get(subjectId)
            .add(
                professorId
            );


        /*
        |--------------------------------------------------------------------------
        | PROFESSOR -> SUBJECTS
        |--------------------------------------------------------------------------
        */

        if (
            !qualificationsByProfessor.has(
                professorId
            )
        ) {

            qualificationsByProfessor.set(
                professorId,
                new Set()
            );
        }


        qualificationsByProfessor
            .get(professorId)
            .add(
                subjectId
            );
    }


    /*
    |--------------------------------------------------------------------------
    | FINAL PROFESSOR LIST
    |--------------------------------------------------------------------------
    */

    const professors =
        [
            ...professorMap.values()
        ];


    const qualifiedProfessorCount =
        professors.filter(
            professor =>
                professor
                    .qualifiedSubjectIds
                    .size > 0
        ).length;


    /*
    |--------------------------------------------------------------------------
    | DEBUG
    |--------------------------------------------------------------------------
    */

    console.log(
        `[PROFESSOR POOL] ` +
        `Active professors: ${professors.length} | ` +
        `Qualified for requested subjects: ${qualifiedProfessorCount} | ` +
        `Requested subjects: ${subjectIds.length}`
    );


    return {

        professors,

        qualificationsBySubject,

        qualificationsByProfessor,

        totalActiveProfessors:
            professors.length,

        qualifiedProfessorCount

    };
};


/*
|--------------------------------------------------------------------------
| BUILD SUBJECT REQUIREMENTS
|--------------------------------------------------------------------------
*/

const buildSubjectRequirements = ({
    curriculum,
    sectionsByYearLevel,
    qualificationsBySubject,
    programId = null,
    programName = null
}) => {

    const requirements = [];


    for (
        const subject
        of curriculum
    ) {

        const weekly =
            getSubjectWeeklyHours(
                subject
            );


        const yearKey =
            normalizeYearLevel(
                subject.yearLevel
            );


        const sectionCount =
            positiveInt(
                sectionsByYearLevel.get(
                    yearKey
                )
            );


        const requiredHours =
            sectionCount *
            weekly.totalHours;


        const qualifiedSet =
            qualificationsBySubject?.get(
                subject.subjectId
            );


        const qualifiedProfessorIds =
            qualifiedSet instanceof Set

                ? [...qualifiedSet]

                : [];


        requirements.push({

            requirementKey:
                programId != null

                    ? `${programId}:${subject.curriculumSubjectId}`

                    : String(
                        subject.curriculumSubjectId
                    ),

            programId,

            programName,

            curriculumSubjectId:
                subject.curriculumSubjectId,

            subjectId:
                subject.subjectId,

            subjectCode:
                subject.subjectCode,

            subjectName:
                subject.subjectName,

            yearLevel:
                subject.yearLevel,

            normalizedYearLevel:
                yearKey,

            semester:
                subject.semester,

            lectureUnits:
                subject.lectureUnits,

            labUnits:
                subject.labUnits,

            lectureHours:
                weekly.lectureHours,

            laboratoryHours:
                weekly.laboratoryHours,

            weeklyHoursPerSection:
                weekly.totalHours,

            sectionCount,

            requiredHours,

            qualifiedProfessorIds,

            qualifiedProfessorCount:
                qualifiedProfessorIds.length,

            hasQualifiedProfessor:
                qualifiedProfessorIds.length > 0,

            missingProfessor:
                requiredHours > 0 &&
                qualifiedProfessorIds.length === 0

        });
    }


    return requirements;
};


/*
|--------------------------------------------------------------------------
| TOTAL REQUIRED HOURS
|--------------------------------------------------------------------------
*/

const calculateRequiredHours = requirements =>
    requirements.reduce(
        (
            total,
            requirement
        ) =>
            total +
            num(
                requirement.requiredHours
            ),
        0
    );


/*
|--------------------------------------------------------------------------
| MAX FLOW PROFESSOR ALLOCATION
|--------------------------------------------------------------------------
*/

const allocateProfessorHoursMaxFlow = ({
    requirements,
    professors
}) => {

    const activeRequirements =
        requirements.filter(
            requirement =>
                requirement.requiredHours > 0
        );


    if (
        activeRequirements.length === 0
    ) {

        return {

            feasible:
                true,

            requiredHours:
                0,

            allocatedHours:
                0,

            shortageHours:
                0,

            professorsUsed:
                0,

            allocations:
                [],

            requirementResults:
                [],

            allocatedByProfessor:
                new Map()

        };
    }


    const safeProfessors =
        Array.isArray(
            professors
        )
            ? professors
            : [];


    const usableProfessors =
        safeProfessors.filter(
            professor =>
                num(
                    professor.maxWeeklyHours
                ) > 0
        );


    /*
    |--------------------------------------------------------------------------
    | NODE INDEXING
    |--------------------------------------------------------------------------
    */

    const SOURCE = 0;

    const professorStart =
        1;

    const requirementStart =
        professorStart +
        usableProfessors.length;

    const SINK =
        requirementStart +
        activeRequirements.length;

    const nodeCount =
        SINK + 1;


    const flow =
        new Dinic(
            nodeCount
        );


    /*
    |--------------------------------------------------------------------------
    | PROFESSOR NODE MAP
    |--------------------------------------------------------------------------
    */

    const professorNodeMap =
        new Map();


    usableProfessors.forEach(
        (
            professor,
            index
        ) => {

            const node =
                professorStart +
                index;


            professorNodeMap.set(
                professor.professorId,
                node
            );


            flow.addEdge(
                SOURCE,
                node,
                Math.floor(
                    num(
                        professor.maxWeeklyHours
                    )
                )
            );
        }
    );


    /*
    |--------------------------------------------------------------------------
    | REQUIREMENT NODE MAP
    |--------------------------------------------------------------------------
    */

    const requirementNodeMap =
        new Map();


    activeRequirements.forEach(
        (
            requirement,
            index
        ) => {

            const node =
                requirementStart +
                index;


            requirementNodeMap.set(
                requirement.requirementKey,
                node
            );


            flow.addEdge(
                node,
                SINK,
                Math.floor(
                    num(
                        requirement.requiredHours
                    )
                )
            );
        }
    );


    /*
    |--------------------------------------------------------------------------
    | PROFESSOR -> REQUIREMENT
    |--------------------------------------------------------------------------
    |
    | ONLY QUALIFIED ACTIVE PROFESSORS.
    |
    |--------------------------------------------------------------------------
    */

    const professorRequirementEdges =
        [];


    for (
        const professor
        of usableProfessors
    ) {

        const professorNode =
            professorNodeMap.get(
                professor.professorId
            );


        for (
            const requirement
            of activeRequirements
        ) {

            if (
                !requirement
                    .qualifiedProfessorIds
                    .includes(
                        professor.professorId
                    )
            ) {

                continue;
            }


            const requirementNode =
                requirementNodeMap.get(
                    requirement.requirementKey
                );


            const edge =
                flow.addEdge(
                    professorNode,
                    requirementNode,
                    Math.min(
                        Math.floor(
                            num(
                                professor.maxWeeklyHours
                            )
                        ),
                        Math.floor(
                            num(
                                requirement.requiredHours
                            )
                        )
                    )
                );


            professorRequirementEdges.push({

                professorId:
                    professor.professorId,

                requirementKey:
                    requirement.requirementKey,

                subjectId:
                    requirement.subjectId,

                subjectCode:
                    requirement.subjectCode,

                subjectName:
                    requirement.subjectName,

                edge

            });
        }
    }


    /*
    |--------------------------------------------------------------------------
    | REQUIRED HOURS
    |--------------------------------------------------------------------------
    */

    const requiredHours =
        activeRequirements.reduce(
            (
                total,
                requirement
            ) =>
                total +
                Math.floor(
                    num(
                        requirement.requiredHours
                    )
                ),
            0
        );


    /*
    |--------------------------------------------------------------------------
    | RUN MAX FLOW
    |--------------------------------------------------------------------------
    */

    const allocatedHours =
        flow.maxFlow(
            SOURCE,
            SINK
        );


    const shortageHours =
        Math.max(
            0,
            requiredHours -
            allocatedHours
        );


    /*
    |--------------------------------------------------------------------------
    | READ ACTUAL ALLOCATION
    |--------------------------------------------------------------------------
    */

    const allocations = [];


    const allocatedByRequirement =
        new Map();


    const allocatedByProfessor =
        new Map();


    for (
        const item
        of professorRequirementEdges
    ) {

        const used =
            flow.getUsedCapacity(
                item.edge
            );


        if (
            used <= 0
        ) {

            continue;
        }


        allocations.push({

            professorId:
                item.professorId,

            requirementKey:
                item.requirementKey,

            subjectId:
                item.subjectId,

            subjectCode:
                item.subjectCode,

            subjectName:
                item.subjectName,

            hours:
                used

        });


        allocatedByRequirement.set(
            item.requirementKey,
            (
                allocatedByRequirement.get(
                    item.requirementKey
                ) || 0
            ) + used
        );


        allocatedByProfessor.set(
            item.professorId,
            (
                allocatedByProfessor.get(
                    item.professorId
                ) || 0
            ) + used
        );
    }


    /*
    |--------------------------------------------------------------------------
    | REQUIREMENT RESULTS
    |--------------------------------------------------------------------------
    */

    const requirementResults =
        activeRequirements.map(
            requirement => {

                const allocated =
                    allocatedByRequirement.get(
                        requirement.requirementKey
                    ) || 0;


                const shortage =
                    Math.max(
                        0,
                        requirement.requiredHours -
                        allocated
                    );


                return {

                    requirementKey:
                        requirement.requirementKey,

                    programId:
                        requirement.programId,

                    programName:
                        requirement.programName,

                    curriculumSubjectId:
                        requirement.curriculumSubjectId,

                    subjectId:
                        requirement.subjectId,

                    subjectCode:
                        requirement.subjectCode,

                    subjectName:
                        requirement.subjectName,

                    yearLevel:
                        requirement.yearLevel,

                    sectionCount:
                        requirement.sectionCount,

                    weeklyHoursPerSection:
                        requirement.weeklyHoursPerSection,

                    requiredHours:
                        requirement.requiredHours,

                    allocatedHours:
                        allocated,

                    shortageHours:
                        shortage,

                    qualifiedProfessorCount:
                        requirement.qualifiedProfessorCount,

                    feasible:
                        shortage <= 0,

                    reason:
                        requirement.qualifiedProfessorCount === 0

                            ? "NO_QUALIFIED_PROFESSOR"

                            : shortage > 0

                                ? "INSUFFICIENT_SHARED_QUALIFIED_CAPACITY"

                                : "ALLOCATED"

                };
            }
        );


    /*
    |--------------------------------------------------------------------------
    | PROFESSORS USED
    |--------------------------------------------------------------------------
    */

    const professorsUsed =
        allocatedByProfessor.size;


    return {

        feasible:
            allocatedHours >=
            requiredHours,

        requiredHours,

        allocatedHours,

        shortageHours,

        professorsUsed,

        allocations,

        requirementResults,

        allocatedByProfessor

    };
};


/*
|--------------------------------------------------------------------------
| SUBJECT BOTTLENECKS
|--------------------------------------------------------------------------
*/

const calculateSubjectBottlenecks = ({
    requirementResults
}) => {

    return requirementResults
        .filter(
            requirement =>
                requirement.requiredHours > 0 &&
                requirement.shortageHours > 0
        )
        .map(
            requirement => ({

                subjectId:
                    requirement.subjectId,

                subjectCode:
                    requirement.subjectCode,

                subjectName:
                    requirement.subjectName,

                programId:
                    requirement.programId,

                programName:
                    requirement.programName,

                yearLevel:
                    requirement.yearLevel,

                sectionCount:
                    requirement.sectionCount,

                weeklyHoursPerSection:
                    requirement.weeklyHoursPerSection,

                requiredHours:
                    requirement.requiredHours,

                allocatedHours:
                    requirement.allocatedHours,

                capacityShortage:
                    requirement.shortageHours,

                qualifiedProfessorCount:
                    requirement.qualifiedProfessorCount,

                reason:
                    requirement.reason

            })
        );
};


/*
|--------------------------------------------------------------------------
| PROFESSOR DETAILS
|--------------------------------------------------------------------------
*/

const calculateProfessorDetails = ({
    professors,
    requirements,
    allocationsByProfessor
}) => {

    const safeProfessors =
        Array.isArray(
            professors
        )
            ? professors
            : [];


    return safeProfessors.map(
        professor => {

            const qualifiedRequirements =
                requirements.filter(
                    requirement =>
                        requirement.requiredHours > 0 &&
                        requirement
                            .qualifiedProfessorIds
                            .includes(
                                professor.professorId
                            )
                );


            const potentialProgramHours =
                qualifiedRequirements.reduce(
                    (
                        total,
                        requirement
                    ) =>
                        total +
                        num(
                            requirement.requiredHours
                        ),
                    0
                );


            const allocatedHours =
                allocationsByProfessor?.get(
                    professor.professorId
                ) || 0;


            const maxWeeklyHours =
                Math.max(
                    0,
                    num(
                        professor.maxWeeklyHours
                    )
                );


            return {

                professorId:
                    professor.professorId,

                userId:
                    professor.userId,

                employeeId:
                    professor.employeeId,

                name:
                    professor.name,

                maxWeeklyHours,

                qualifiedSubjects:
                    professor
                        .qualifiedSubjectIds
                        instanceof Set

                        ? [
                            ...professor
                                .qualifiedSubjectIds
                        ]

                        : [],

                qualifiedSubjectsCount:
                    professor
                        .qualifiedSubjectIds
                        instanceof Set

                        ? professor
                            .qualifiedSubjectIds
                            .size

                        : 0,

                qualifiedForActiveSubjects:
                    qualifiedRequirements.length,

                potentialProgramHours,

                allocatedHours,

                remainingCapacity:
                    Math.max(
                        0,
                        maxWeeklyHours -
                        allocatedHours
                    ),

                utilization:
                    maxWeeklyHours > 0

                        ? round2(
                            (
                                allocatedHours /
                                maxWeeklyHours
                            ) * 100
                        )

                        : 0

            };
        }
    );
};


/*
|--------------------------------------------------------------------------
| YEAR LEVEL DEMAND
|--------------------------------------------------------------------------
*/

const calculateYearLevelDemand = ({
    curriculum,
    sectionsByYearLevel
}) => {

    const yearMap =
        new Map();


    for (
        const subject
        of curriculum
    ) {

        const yearKey =
            normalizeYearLevel(
                subject.yearLevel
            );


        if (
            !yearKey
        ) {

            continue;
        }


        if (
            !yearMap.has(
                yearKey
            )
        ) {

            yearMap.set(
                yearKey,
                {

                    yearLevel:
                        subject.yearLevel,

                    normalizedYearLevel:
                        yearKey,

                    sectionCount:
                        positiveInt(
                            sectionsByYearLevel.get(
                                yearKey
                            )
                        ),

                    subjectCount:
                        0,

                    activeSubjectCount:
                        0,

                    requiredHours:
                        0

                }
            );
        }


        const entry =
            yearMap.get(
                yearKey
            );


        const weekly =
            getSubjectWeeklyHours(
                subject
            );


        entry.subjectCount++;


        if (
            entry.sectionCount > 0 &&
            weekly.totalHours > 0
        ) {

            entry.activeSubjectCount++;


            entry.requiredHours +=
                entry.sectionCount *
                weekly.totalHours;
        }
    }


    return [
        ...yearMap.values()
    ].sort(
        (
            a,
            b
        ) =>
            a.normalizedYearLevel
                .localeCompare(
                    b.normalizedYearLevel
                )
    );
};


/*
|--------------------------------------------------------------------------
| CALCULATE PROGRAM CAPACITY
|--------------------------------------------------------------------------
*/

const calculateProgramCapacity = ({
    sections,
    curriculum,
    professors,
    qualificationsBySubject,
    academicSemester,
    programId,
    programName
}) => {

    const safeSections =
        sections || {

            sectionsByYearLevel:
                new Map(),

            totalSections:
                0

        };


    const safeCurriculum =
        Array.isArray(
            curriculum
        )
            ? curriculum
            : [];


    const safeProfessors =
        Array.isArray(
            professors
        )
            ? professors
            : [];


    /*
    |--------------------------------------------------------------------------
    | BUILD REQUIREMENTS
    |--------------------------------------------------------------------------
    */

    const requirements =
        buildSubjectRequirements({

            curriculum:
                safeCurriculum,

            sectionsByYearLevel:
                safeSections
                    .sectionsByYearLevel instanceof Map

                    ? safeSections
                        .sectionsByYearLevel

                    : new Map(),

            qualificationsBySubject,

            programId,

            programName

        });


    const activeRequirements =
        requirements.filter(
            requirement =>
                requirement.requiredHours > 0
        );


    const totalRequiredHours =
        calculateRequiredHours(
            requirements
        );


    /*
    |--------------------------------------------------------------------------
    | TOTAL ACTIVE PROFESSOR CAPACITY
    |--------------------------------------------------------------------------
    */

    const totalAvailableCapacity =
        safeProfessors.reduce(
            (
                total,
                professor
            ) =>
                total +
                Math.max(
                    0,
                    num(
                        professor.maxWeeklyHours
                    )
                ),
            0
        );


    /*
    |--------------------------------------------------------------------------
    | QUALIFIED PROFESSORS FOR PROGRAM
    |--------------------------------------------------------------------------
    */

    const qualifiedProfessors =
        safeProfessors.filter(
            professor =>
                activeRequirements.some(
                    requirement =>
                        requirement
                            .qualifiedProfessorIds
                            .includes(
                                professor.professorId
                            )
                )
        );


    const totalQualifiedProfessorCapacity =
        qualifiedProfessors.reduce(
            (
                total,
                professor
            ) =>
                total +
                Math.max(
                    0,
                    num(
                        professor.maxWeeklyHours
                    )
                ),
            0
        );


    /*
    |--------------------------------------------------------------------------
    | MAX FLOW
    |--------------------------------------------------------------------------
    */

    const allocation =
        allocateProfessorHoursMaxFlow({

            requirements,

            professors:
                qualifiedProfessors

        });


    /*
    |--------------------------------------------------------------------------
    | BOTTLENECKS
    |--------------------------------------------------------------------------
    */

    const subjectBottlenecks =
        calculateSubjectBottlenecks({

            requirementResults:
                allocation.requirementResults

        });


    /*
    |--------------------------------------------------------------------------
    | HOURS-ONLY LOWER BOUND
    |--------------------------------------------------------------------------
    */

    const maxProfessorHours =
        qualifiedProfessors.length > 0

            ? Math.max(
                ...qualifiedProfessors.map(
                    professor =>
                        Math.max(
                            0,
                            num(
                                professor.maxWeeklyHours
                            )
                        )
                )
            )

            : 0;


    const hoursOnlyLowerBound =
        totalRequiredHours > 0 &&
        maxProfessorHours > 0

            ? Math.ceil(
                totalRequiredHours /
                maxProfessorHours
            )

            : 0;


    /*
    |--------------------------------------------------------------------------
    | STATUS
    |--------------------------------------------------------------------------
    */

    let status =
        "SUFFICIENT";


    if (
        safeSections.totalSections === 0
    ) {

        status =
            "NO_SECTIONS";

    } else if (
        safeCurriculum.length === 0
    ) {

        status =
            "NO_ACTIVE_SUBJECTS";

    } else if (
        activeRequirements.length === 0
    ) {

        status =
            "NO_ACTIVE_SUBJECTS";

    } else if (
        !allocation.feasible
    ) {

        status =
            "INSUFFICIENT_QUALIFIED_CAPACITY";
    }


    /*
    |--------------------------------------------------------------------------
    | PROFESSOR DETAILS
    |--------------------------------------------------------------------------
    */

    const professorDetails =
        calculateProfessorDetails({

            professors:
                qualifiedProfessors,

            requirements,

            allocationsByProfessor:
                allocation.allocatedByProfessor

        });


    /*
    |--------------------------------------------------------------------------
    | YEAR LEVEL DEMAND
    |--------------------------------------------------------------------------
    */

    const yearLevelDemand =
        calculateYearLevelDemand({

            curriculum:
                safeCurriculum,

            sectionsByYearLevel:
                safeSections
                    .sectionsByYearLevel instanceof Map

                    ? safeSections
                        .sectionsByYearLevel

                    : new Map()

        });


    return {

        status,

        semester:
            academicSemester || null,

        sufficient:
            status === "SUFFICIENT" ||
            status === "NO_SECTIONS" ||
            status === "NO_ACTIVE_SUBJECTS",

        sectionCount:
            safeSections.totalSections,

        subjectsAnalyzed:
            safeCurriculum.length,

        activeSubjects:
            activeRequirements.length,

        requiredTeachingHours:
            totalRequiredHours,

        availableProfessorCapacity:
            totalAvailableCapacity,

        totalQualifiedProfessorCapacity,

        allocatableQualifiedCapacity:
            allocation.allocatedHours,

        allocationShortageHours:
            allocation.shortageHours,

        /*
        |--------------------------------------------------------------------------
        | PROFESSOR COUNTS
        |--------------------------------------------------------------------------
        */

        professorsAvailable:
            safeProfessors.length,

        qualifiedProfessorsAvailable:
            qualifiedProfessors.length,

        hoursOnlyLowerBound,

        minimumProfessorsNeeded:
            hoursOnlyLowerBound,

        professorsUsedByCapacityAllocation:
            allocation.professorsUsed,

        professorShortage:
            Math.max(
                0,
                hoursOnlyLowerBound -
                qualifiedProfessors.length
            ),

        subjectBottlenecks,

        allocationFeasible:
            allocation.feasible,

        allocationFailure:
            allocation.feasible

                ? null

                : {

                    shortageHours:
                        allocation.shortageHours,

                    requiredHours:
                        allocation.requiredHours,

                    allocatedHours:
                        allocation.allocatedHours

                },

        yearLevelDemand,

        professors:
            professorDetails,

        requirements:
            allocation.requirementResults,

        rawRequirements:
            requirements,

        allocations:
            allocation.allocations,

        sectionsByYearLevel:
            Object.fromEntries(
                safeSections
                    .sectionsByYearLevel instanceof Map

                    ? safeSections
                        .sectionsByYearLevel

                    : new Map()
            )

    };
};


/*
|--------------------------------------------------------------------------
| CHECK SINGLE PROGRAM
|--------------------------------------------------------------------------
*/

const checkProgram = async ({
    program,
    academicTermId,
    academicTerm,
    preloadedCurriculum = null,
    preloadedProfessorData = null
}) => {

    console.log(
        "\n----------------------------------------"
    );

    console.log(
        "PROGRAM CAPACITY CHECK"
    );

    console.log(
        `Program ID: ${program.id}`
    );

    console.log(
        `Program: ${program.name}`
    );

    console.log(
        `Academic Term: ${academicTermId}`
    );

    console.log(
        `Semester: ${
            normalizeSemester(
                academicTerm?.semester
            ) || "UNKNOWN"
        }`
    );

    console.log(
        "----------------------------------------"
    );


    try {

        /*
        |--------------------------------------------------------------------------
        | SECTIONS
        |--------------------------------------------------------------------------
        */

        const sections =
            await getProgramSections(
                program.id,
                academicTermId
            );


        if (
            sections.totalSections === 0
        ) {

            console.log(
                `[CAPACITY] ${program.name} | NO SECTIONS`
            );


            return {

                programId:
                    program.id,

                programName:
                    program.name,

                passed:
                    true,

                skipped:
                    true,

                reason:
                    "No sections found for this program in the selected academic term.",

                failureType:
                    null,

                sectionCount:
                    0,

                professorCapacity: {

                    status:
                        "NO_SECTIONS",

                    semester:
                        normalizeSemester(
                            academicTerm?.semester
                        ),

                    sufficient:
                        true,

                    sectionCount:
                        0,

                    subjectsAnalyzed:
                        0,

                    activeSubjects:
                        0,

                    requiredTeachingHours:
                        0,

                    availableProfessorCapacity:
                        0,

                    totalQualifiedProfessorCapacity:
                        0,

                    allocatableQualifiedCapacity:
                        0,

                    allocationShortageHours:
                        0,

                    professorsAvailable:
                        0,

                    qualifiedProfessorsAvailable:
                        0,

                    hoursOnlyLowerBound:
                        0,

                    minimumProfessorsNeeded:
                        0,

                    professorsUsedByCapacityAllocation:
                        0,

                    professorShortage:
                        0,

                    subjectBottlenecks:
                        [],

                    allocationFeasible:
                        true,

                    allocationFailure:
                        null,

                    yearLevelDemand:
                        [],

                    professors:
                        [],

                    requirements:
                        [],

                    rawRequirements:
                        [],

                    allocations:
                        [],

                    sectionsByYearLevel:
                        {}

                }

            };
        }


        /*
        |--------------------------------------------------------------------------
        | CURRICULUM
        |--------------------------------------------------------------------------
        */

        const curriculum =
            Array.isArray(
                preloadedCurriculum
            )

                ? preloadedCurriculum

                : await getProgramCurriculum(
                    program.id,
                    academicTerm
                );


        /*
        |--------------------------------------------------------------------------
        | PROFESSOR DATA
        |--------------------------------------------------------------------------
        */

        const qualificationData =
            preloadedProfessorData ||

            await getProfessorQualifications(
                curriculum
            );


        const professors =
            qualificationData.professors || [];


        /*
        |--------------------------------------------------------------------------
        | CALCULATE
        |--------------------------------------------------------------------------
        */

        const professorCapacity =
            calculateProgramCapacity({

                sections,

                curriculum,

                professors,

                qualificationsBySubject:
                    qualificationData
                        .qualificationsBySubject,

                academicSemester:
                    normalizeSemester(
                        academicTerm?.semester
                    ),

                programId:
                    program.id,

                programName:
                    program.name

            });


        /*
        |--------------------------------------------------------------------------
        | LOG
        |--------------------------------------------------------------------------
        */

        console.log(
            `\n[CAPACITY RESULT] ${program.name}`
        );

        console.log(
            `Semester: ${professorCapacity.semester}`
        );

        console.log(
            `Sections: ${professorCapacity.sectionCount}`
        );

        console.log(
            `Subjects analyzed: ${professorCapacity.subjectsAnalyzed}`
        );

        console.log(
            `Active subjects: ${professorCapacity.activeSubjects}`
        );

        console.log(
            `Required teaching hours: ${professorCapacity.requiredTeachingHours}`
        );

        console.log(
            `Available professor capacity: ${professorCapacity.availableProfessorCapacity}`
        );

        console.log(
            `Qualified professor capacity: ${professorCapacity.totalQualifiedProfessorCapacity}`
        );

        console.log(
            `Actually allocatable qualified capacity: ${professorCapacity.allocatableQualifiedCapacity}`
        );

        console.log(
            `Allocation shortage hours: ${professorCapacity.allocationShortageHours}`
        );

        console.log(
            `Active professors available: ${professorCapacity.professorsAvailable}`
        );

        console.log(
            `Qualified professors available: ${professorCapacity.qualifiedProfessorsAvailable}`
        );

        console.log(
            `Hours-only lower bound: ${professorCapacity.hoursOnlyLowerBound}`
        );

        console.log(
            `Professors used by capacity allocation: ${professorCapacity.professorsUsedByCapacityAllocation}`
        );

        console.log(
            `Professor shortage: ${professorCapacity.professorShortage}`
        );

        console.log(
            `Subject bottlenecks: ${professorCapacity.subjectBottlenecks.length}`
        );

        console.log(
            `Allocation feasible: ${professorCapacity.allocationFeasible}`
        );

        console.log(
            `Status: ${professorCapacity.status}`
        );


        /*
        |--------------------------------------------------------------------------
        | YEAR LEVEL LOG
        |--------------------------------------------------------------------------
        */

        if (
            professorCapacity.yearLevelDemand.length > 0
        ) {

            console.log(
                "[YEAR LEVEL DEMAND]"
            );


            for (
                const year
                of professorCapacity.yearLevelDemand
            ) {

                console.log(
                    `  ${year.yearLevel} ` +
                    `(${year.normalizedYearLevel}) | ` +
                    `Sections: ${year.sectionCount} | ` +
                    `Subjects: ${year.subjectCount} | ` +
                    `Active: ${year.activeSubjectCount} | ` +
                    `Hours: ${year.requiredHours}`
                );
            }
        }


        /*
        |--------------------------------------------------------------------------
        | BOTTLENECK LOG
        |--------------------------------------------------------------------------
        */

        if (
            professorCapacity.subjectBottlenecks.length > 0
        ) {

            console.log(
                "[SUBJECT BOTTLENECKS]"
            );


            for (
                const bottleneck
                of professorCapacity.subjectBottlenecks
            ) {

                console.log(
                    `  ${bottleneck.subjectCode} | ` +
                    `${bottleneck.subjectName} | ` +
                    `Required: ${bottleneck.requiredHours} | ` +
                    `Allocated: ${bottleneck.allocatedHours} | ` +
                    `Shortage: ${bottleneck.capacityShortage} | ` +
                    `Qualified: ${bottleneck.qualifiedProfessorCount}`
                );
            }
        }


        const passed =
            professorCapacity.sufficient;


        return {

            programId:
                program.id,

            programName:
                program.name,

            passed,

            skipped:
                false,

            reason:
                passed

                    ? professorCapacity.status ===
                      "NO_ACTIVE_SUBJECTS"

                        ? `No curriculum subjects found for ${professorCapacity.semester}.`

                        : "Professor capacity is sufficient based on active-professor qualification-aware global allocation."

                    : `Professor capacity check failed: ${professorCapacity.status}.`,

            failureType:
                passed
                    ? null
                    : "PROFESSOR_CAPACITY_FAILURE",

            sectionCount:
                professorCapacity.sectionCount,

            professorCapacity

        };

    } catch (
        error
    ) {

        console.error(
            `[PROGRAM ERROR] ${program.name}:`,
            error
        );


        return {

            programId:
                program.id,

            programName:
                program.name,

            passed:
                false,

            skipped:
                false,

            reason:
                error?.message ||
                String(error),

            failureType:
                "PROGRAM_CHECK_ERROR",

            sectionCount:
                0,

            professorCapacity:
                null

        };
    }
};


/*
|--------------------------------------------------------------------------
| BUILD UNIVERSITY REQUIREMENTS
|--------------------------------------------------------------------------
*/

const buildUniversityRequirements = ({
    programData,
    qualificationsBySubject
}) => {

    const requirements = [];


    for (
        const data
        of programData
    ) {

        const requirementsForProgram =
            buildSubjectRequirements({

                curriculum:
                    data.curriculum,

                sectionsByYearLevel:
                    data.sections
                        .sectionsByYearLevel,

                qualificationsBySubject,

                programId:
                    data.programId,

                programName:
                    data.programName

            });


        requirements.push(
            ...requirementsForProgram
        );
    }


    return requirements;
};


/*
|--------------------------------------------------------------------------
| CHECK UNIVERSITY CAPACITY
|--------------------------------------------------------------------------
|
| IMPORTANT:
|
| Argument is ONLY academicTermId.
|
| checkUniversityCapacity(1)
|
|--------------------------------------------------------------------------
*/

const checkUniversityCapacity = async academicTermId => {

    const termId =
        positiveInt(
            academicTermId
        );


    if (
        termId <= 0
    ) {

        throw new Error(
            "A valid academicTermId is required."
        );
    }


    /*
    |--------------------------------------------------------------------------
    | ACADEMIC TERM
    |--------------------------------------------------------------------------
    */

    const academicTerm =
        await getAcademicTerm(
            termId
        );


    const normalizedSemester =
        normalizeSemester(
            academicTerm.semester
        );


    if (
        !normalizedSemester
    ) {

        throw new Error(
            `Academic term ${termId} has an invalid or empty semester.`
        );
    }


    /*
    |--------------------------------------------------------------------------
    | PROGRAMS
    |--------------------------------------------------------------------------
    */

    const programs =
        await getPrograms();


    console.log(
        "\n========================================"
    );

    console.log(
        "UNIVERSITY PROFESSOR CAPACITY CHECK"
    );

    console.log(
        "========================================"
    );

    console.log(
        `Academic Term: ${termId}`
    );

    console.log(
        `Academic Term Semester: ${normalizedSemester}`
    );

    console.log(
        `Programs: ${programs.length}`
    );

    console.log(
        "Professor population: ACTIVE users with role PROFESSOR"
    );

    console.log(
        "Scheduler: NOT USED"
    );

    console.log(
        "Calculation: MAX-FLOW + CURRICULUM + SECTIONS + PROFESSOR QUALIFICATIONS"
    );


    /*
    |--------------------------------------------------------------------------
    | LOAD ALL PROGRAM DATA
    |--------------------------------------------------------------------------
    */

    const programData = [];


    for (
        const program
        of programs
    ) {

        const sections =
            await getProgramSections(
                program.id,
                termId
            );


        const curriculum =
            await getProgramCurriculum(
                program.id,
                academicTerm
            );


        programData.push({

            programId:
                program.id,

            programName:
                program.name,

            sections,

            curriculum

        });
    }


    /*
    |--------------------------------------------------------------------------
    | ALL CURRICULUM SUBJECTS
    |--------------------------------------------------------------------------
    */

    const allSubjects = [];


    for (
        const data
        of programData
    ) {

        allSubjects.push(
            ...data.curriculum
        );
    }


    /*
    |--------------------------------------------------------------------------
    | GLOBAL PROFESSOR QUALIFICATIONS
    |--------------------------------------------------------------------------
    |
    | PROFESSORS ARE LOADED ONCE.
    |
    | Only:
    |
    |   users.role = professor
    |   users.status = active
    |
    | are included.
    |
    |--------------------------------------------------------------------------
    */

    const globalQualificationData =
        await getProfessorQualifications(
            allSubjects
        );


    const globalProfessors =
        globalQualificationData.professors || [];


    /*
    |--------------------------------------------------------------------------
    | GLOBAL PROFESSOR DEBUG
    |--------------------------------------------------------------------------
    */

    const globalQualifiedForAnything =
        globalProfessors.filter(
            professor =>
                professor
                    .qualifiedSubjectIds
                    .size > 0
        );


    console.log(
        "\n[GLOBAL PROFESSOR POOL]"
    );

    console.log(
        `Active professors: ${globalProfessors.length}`
    );

    console.log(
        `Active professors qualified for at least one selected subject: ${globalQualifiedForAnything.length}`
    );


    /*
    |--------------------------------------------------------------------------
    | INDIVIDUAL PROGRAM RESULTS
    |--------------------------------------------------------------------------
    */

    const results = [];


    for (
        let index = 0;
        index < programs.length;
        index++
    ) {

        const program =
            programs[index];


        console.log(
            `\n[PROGRAM ${index + 1}/${programs.length}] ` +
            `${program.name}`
        );


        const data =
            programData.find(
                item =>
                    item.programId ===
                    program.id
            );


        const result =
            await checkProgram({

                program,

                academicTermId:
                    termId,

                academicTerm,

                preloadedCurriculum:
                    data?.curriculum || [],

                preloadedProfessorData:
                    globalQualificationData

            });


        results.push(
            result
        );
    }


    /*
    |--------------------------------------------------------------------------
    | GLOBAL REQUIREMENTS
    |--------------------------------------------------------------------------
    */

    const universityRequirements =
        buildUniversityRequirements({

            programData,

            qualificationsBySubject:
                globalQualificationData
                    .qualificationsBySubject

        });


    const activeUniversityRequirements =
        universityRequirements.filter(
            requirement =>
                requirement.requiredHours > 0
        );


    const totalUniversityRequiredHours =
        calculateRequiredHours(
            universityRequirements
        );


    /*
    |--------------------------------------------------------------------------
    | GLOBAL MAX FLOW
    |--------------------------------------------------------------------------
    |
    | EVERY ACTIVE PROFESSOR APPEARS ONLY ONCE.
    |
    | Their weekly capacity is shared between:
    |
    | BSCS
    | BSIT
    | BSN
    | BSIE
    | etc.
    |
    |--------------------------------------------------------------------------
    */

    const globalAllocation =
        allocateProfessorHoursMaxFlow({

            requirements:
                universityRequirements,

            professors:
                globalProfessors

        });


    /*
    |--------------------------------------------------------------------------
    | GLOBAL BOTTLENECKS
    |--------------------------------------------------------------------------
    */

    const globalBottlenecks =
        calculateSubjectBottlenecks({

            requirementResults:
                globalAllocation
                    .requirementResults

        });


    /*
    |--------------------------------------------------------------------------
    | GLOBAL PROFESSOR CAPACITY
    |--------------------------------------------------------------------------
    */

    const totalGlobalProfessorCapacity =
        globalProfessors.reduce(
            (
                total,
                professor
            ) =>
                total +
                Math.max(
                    0,
                    num(
                        professor.maxWeeklyHours
                    )
                ),
            0
        );


    /*
    |--------------------------------------------------------------------------
    | GLOBAL QUALIFIED PROFESSORS
    |--------------------------------------------------------------------------
    */

    const globalActiveRequirements =
        activeUniversityRequirements;


    const globalQualifiedProfessors =
        globalProfessors.filter(
            professor =>
                globalActiveRequirements.some(
                    requirement =>
                        requirement
                            .qualifiedProfessorIds
                            .includes(
                                professor.professorId
                            )
                )
        );


    const globalQualifiedProfessorCapacity =
        globalQualifiedProfessors.reduce(
            (
                total,
                professor
            ) =>
                total +
                Math.max(
                    0,
                    num(
                        professor.maxWeeklyHours
                    )
                ),
            0
        );


    /*
    |--------------------------------------------------------------------------
    | GLOBAL HOURS-ONLY LOWER BOUND
    |--------------------------------------------------------------------------
    */

    const maxGlobalProfessorHours =
        globalQualifiedProfessors.length > 0

            ? Math.max(
                ...globalQualifiedProfessors.map(
                    professor =>
                        Math.max(
                            0,
                            num(
                                professor.maxWeeklyHours
                            )
                        )
                )
            )

            : 0;


    const globalHoursOnlyLowerBound =
        totalUniversityRequiredHours > 0 &&
        maxGlobalProfessorHours > 0

            ? Math.ceil(
                totalUniversityRequiredHours /
                maxGlobalProfessorHours
            )

            : 0;


    /*
    |--------------------------------------------------------------------------
    | UNIVERSITY STATUS
    |--------------------------------------------------------------------------
    */

    const skipped =
        results.filter(
            result =>
                result.skipped === true
        );


    const failedProgramChecks =
        results.filter(
            result =>
                result.passed === false &&
                result.skipped === false
        );


    const passed =
        results.filter(
            result =>
                result.passed === true &&
                result.skipped === false
        );


    /*
    |--------------------------------------------------------------------------
    | GLOBAL CAPACITY
    |--------------------------------------------------------------------------
    */

    const globalCapacityPassed =
        globalAllocation.feasible;


    const universityPassed =
        failedProgramChecks.length === 0 &&
        globalCapacityPassed;


    /*
    |--------------------------------------------------------------------------
    | PROGRAM-SCOPED SUMMARY
    |--------------------------------------------------------------------------
    */

    const totalRequiredProfessorHours =
        results.reduce(
            (
                total,
                result
            ) =>
                total +
                num(
                    result
                        ?.professorCapacity
                        ?.requiredTeachingHours
                ),
            0
        );


    const totalProgramProfessorRequirement =
        results.reduce(
            (
                total,
                result
            ) =>
                total +
                num(
                    result
                        ?.professorCapacity
                        ?.hoursOnlyLowerBound
                ),
            0
        );


    const totalProgramProfessorShortage =
        results.reduce(
            (
                total,
                result
            ) =>
                total +
                num(
                    result
                        ?.professorCapacity
                        ?.professorShortage
                ),
            0
        );


    /*
    |--------------------------------------------------------------------------
    | GLOBAL LOG
    |--------------------------------------------------------------------------
    */

    console.log(
        "\n========================================"
    );

    console.log(
        "GLOBAL UNIVERSITY CAPACITY RESULT"
    );

    console.log(
        "========================================"
    );

    console.log(
        `Academic Term: ${termId}`
    );

    console.log(
        `Semester: ${normalizedSemester}`
    );

    console.log(
        `ACTIVE PROFESSORS: ${globalProfessors.length}`
    );

    console.log(
        `Globally qualified active professors: ${globalQualifiedProfessors.length}`
    );

    console.log(
        `Total required teaching hours: ${totalUniversityRequiredHours}`
    );

    console.log(
        `Total active professor capacity: ${totalGlobalProfessorCapacity}`
    );

    console.log(
        `Globally qualified professor capacity: ${globalQualifiedProfessorCapacity}`
    );

    console.log(
        `Actually allocatable capacity: ${globalAllocation.allocatedHours}`
    );

    console.log(
        `Global shortage hours: ${globalAllocation.shortageHours}`
    );

    console.log(
        `Hours-only lower bound: ${globalHoursOnlyLowerBound}`
    );

    console.log(
        `Professors used by global capacity allocation: ${globalAllocation.professorsUsed}`
    );

    console.log(
        `Global allocation feasible: ${globalAllocation.feasible}`
    );

    console.log(
        `Global subject bottlenecks: ${globalBottlenecks.length}`
    );

    console.log(
        `Program checks failed: ${failedProgramChecks.length}`
    );

    console.log(
        `University capacity status: ${
            universityPassed
                ? "SUFFICIENT"
                : "INSUFFICIENT"
        }`
    );


    /*
    |--------------------------------------------------------------------------
    | GLOBAL BOTTLENECK LOG
    |--------------------------------------------------------------------------
    */

    if (
        globalBottlenecks.length > 0
    ) {

        console.log(
            "\nGLOBAL SUBJECT BOTTLENECKS"
        );


        for (
            const bottleneck
            of globalBottlenecks
        ) {

            console.log(
                `- ${bottleneck.programName} | ` +
                `${bottleneck.subjectCode} | ` +
                `${bottleneck.subjectName} | ` +
                `Required: ${bottleneck.requiredHours} | ` +
                `Allocated: ${bottleneck.allocatedHours} | ` +
                `Shortage: ${bottleneck.capacityShortage} | ` +
                `Qualified: ${bottleneck.qualifiedProfessorCount}`
            );
        }
    }


    /*
    |--------------------------------------------------------------------------
    | FAILED PROGRAM LOG
    |--------------------------------------------------------------------------
    */

    if (
        failedProgramChecks.length > 0
    ) {

        console.log(
            "\nFAILED PROGRAM CHECKS"
        );


        for (
            const result
            of failedProgramChecks
        ) {

            console.log(
                `- ${result.programName} ` +
                `(${result.programId})`
            );


            console.log(
                `  Reason: ${result.reason}`
            );


            if (
                result.professorCapacity
            ) {

                console.log(
                    `  Required hours: ` +
                    `${result.professorCapacity.requiredTeachingHours}`
                );

                console.log(
                    `  Allocatable hours: ` +
                    `${result.professorCapacity.allocatableQualifiedCapacity}`
                );

                console.log(
                    `  Shortage hours: ` +
                    `${result.professorCapacity.allocationShortageHours}`
                );

                console.log(
                    `  Active professors: ` +
                    `${result.professorCapacity.professorsAvailable}`
                );

                console.log(
                    `  Qualified professors: ` +
                    `${result.professorCapacity.qualifiedProfessorsAvailable}`
                );

                console.log(
                    `  Subject bottlenecks: ` +
                    `${result.professorCapacity.subjectBottlenecks.length}`
                );
            }
        }
    }


    /*
    |--------------------------------------------------------------------------
    | RETURN
    |--------------------------------------------------------------------------
    */

    return {

        passed:
            universityPassed,

        academicTermId:
            termId,

        semester:
            normalizedSemester,

        totalPrograms:
            programs.length,

        checkedPrograms:
            passed.length,

        skippedPrograms:
            skipped.length,

        passedPrograms:
            passed.length,

        failedPrograms:
            failedProgramChecks.length,


        /*
        |--------------------------------------------------------------------------
        | PROGRAM SUMMARY
        |--------------------------------------------------------------------------
        */

        professorSummary: {

            semester:
                normalizedSemester,

            totalRequiredProfessorHours,

            totalProgramProfessorRequirement,

            totalProgramProfessorShortage,

            note:
                "Program-scoped professor capacities may contain the same active professor multiple times. Use globalProfessorSummary for university-wide capacity."

        },


        /*
        |--------------------------------------------------------------------------
        | GLOBAL SUMMARY
        |--------------------------------------------------------------------------
        */

        globalProfessorSummary: {

            semester:
                normalizedSemester,

            /*
             * THIS IS NOW THE ACTUAL ACTIVE PROFESSOR COUNT.
             */
            uniqueProfessors:
                globalProfessors.length,

            globallyQualifiedProfessors:
                globalQualifiedProfessors.length,

            totalRequiredTeachingHours:
                totalUniversityRequiredHours,

            totalProfessorCapacity:
                totalGlobalProfessorCapacity,

            totalQualifiedProfessorCapacity:
                globalQualifiedProfessorCapacity,

            allocatableQualifiedCapacity:
                globalAllocation.allocatedHours,

            shortageHours:
                globalAllocation.shortageHours,

            hoursOnlyLowerBound:
                globalHoursOnlyLowerBound,

            professorsUsedByCapacityAllocation:
                globalAllocation.professorsUsed,

            allocationFeasible:
                globalAllocation.feasible,

            subjectBottlenecks:
                globalBottlenecks.length,

            note:
                "uniqueProfessors contains only active users with role professor. Professors are counted once globally. Professor qualifications are taken from professor_subjects."

        },


        /*
        |--------------------------------------------------------------------------
        | GLOBAL ALLOCATION
        |--------------------------------------------------------------------------
        */

        globalAllocation: {

            requiredHours:
                globalAllocation.requiredHours,

            allocatedHours:
                globalAllocation.allocatedHours,

            shortageHours:
                globalAllocation.shortageHours,

            feasible:
                globalAllocation.feasible,

            professorsUsed:
                globalAllocation.professorsUsed,

            allocations:
                globalAllocation.allocations,

            requirementResults:
                globalAllocation.requirementResults

        },


        /*
        |--------------------------------------------------------------------------
        | GLOBAL BOTTLENECKS
        |--------------------------------------------------------------------------
        */

        globalSubjectBottlenecks:
            globalBottlenecks,


        /*
        |--------------------------------------------------------------------------
        | PROGRAM RESULTS
        |--------------------------------------------------------------------------
        */

        results,


        /*
        |--------------------------------------------------------------------------
        | FAILED
        |--------------------------------------------------------------------------
        */

        failed:
            failedProgramChecks.map(
                result => ({

                    programId:
                        result.programId,

                    programName:
                        result.programName,

                    reason:
                        result.reason,

                    failureType:
                        result.failureType,

                    sectionCount:
                        result.sectionCount,

                    professorCapacity:
                        result.professorCapacity

                })
            ),


        /*
        |--------------------------------------------------------------------------
        | SKIPPED
        |--------------------------------------------------------------------------
        */

        skipped:
            skipped.map(
                result => ({

                    programId:
                        result.programId,

                    programName:
                        result.programName,

                    reason:
                        result.reason,

                    sectionCount:
                        result.sectionCount,

                    professorCapacity:
                        result.professorCapacity

                })
            ),


        /*
        |--------------------------------------------------------------------------
        | PASSED
        |--------------------------------------------------------------------------
        */

        passed:
            passed.map(
                result => ({

                    programId:
                        result.programId,

                    programName:
                        result.programName,

                    sectionCount:
                        result.sectionCount,

                    professorCapacity:
                        result.professorCapacity

                })
            ),


        /*
        |--------------------------------------------------------------------------
        | FINAL MESSAGE
        |--------------------------------------------------------------------------
        */

        message:
            universityPassed

                ? skipped.length > 0

                    ? `University professor capacity is sufficient for ${normalizedSemester}. ` +
                      `${skipped.length} program(s) had no sections and were skipped.`

                    : `University professor capacity is sufficient for ${normalizedSemester}.`

                : globalBottlenecks.length > 0

                    ? `University professor capacity is insufficient for ${normalizedSemester}. ` +
                      `${globalBottlenecks.length} subject-level bottleneck(s) were detected.`

                    : `University professor capacity is insufficient for ${normalizedSemester}.`

    };
};


/*
|--------------------------------------------------------------------------
| EXPORTS
|--------------------------------------------------------------------------
*/

module.exports = {

    checkUniversityCapacity,

    /*
     * Backward compatibility.
     *
     * Existing code can still call:
     *
     * checkEnrollmentCapacity(academicTermId)
     */

    checkEnrollmentCapacity:
        checkUniversityCapacity,

    checkProgram,

    getPrograms

};