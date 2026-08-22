import { useEffect, useMemo, useState } from "react";
import "./styles/Student.css";

/*
|--------------------------------------------------------------------------
| API
|--------------------------------------------------------------------------
*/

const api = {

    /*
    |--------------------------------------------------------------------------
    | GET PROFESSORS
    |--------------------------------------------------------------------------
    */

    getProfessors: async () => {

        const token =
            localStorage.getItem("admin_token");

        const response = await fetch(
            "http://localhost:3000/api/auth/admin/getProfessor",
            {
                method: "GET",

                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                }
            }
        );

        const data =
            await response.json();

        if (!response.ok) {

            throw new Error(
                data.message ||
                `Failed to fetch professors. Status: ${response.status}`
            );

        }

        return Array.isArray(data.professor)
            ? data.professor
            : [];

    },


    /*
    |--------------------------------------------------------------------------
    | GET CURRICULUM SUBJECTS
    |--------------------------------------------------------------------------
    */

    getCurriculumSubjects: async (
        programId,
        professorId
    ) => {

        const token =
            localStorage.getItem("admin_token");

        if (!programId) {
            throw new Error("Program ID is required.");
        }

        if (!professorId) {
            throw new Error("Professor ID is required.");
        }

        const response = await fetch(
            `http://localhost:3000/api/auth/admin/getSubjectsByProgram?programId=${encodeURIComponent(
                programId
            )}&professorId=${encodeURIComponent(
                professorId
            )}`,
            {
                method: "GET",

                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                }
            }
        );

        const data =
            await response.json();

        if (!response.ok) {

            throw new Error(
                data.message ||
                `Failed to fetch curriculum subjects. Status: ${response.status}`
            );

        }

        if (Array.isArray(data)) {
            return data;
        }

        if (Array.isArray(data.subjects)) {
            return data.subjects;
        }

        if (Array.isArray(data.data)) {
            return data.data;
        }

        return [];

    },


    /*
    |--------------------------------------------------------------------------
    | ASSIGN PROFESSOR SUBJECTS
    |--------------------------------------------------------------------------
    |
    | EXISTING API.
    |
    | We intentionally do NOT create a new mass-assignment endpoint.
    |
    */

    saveProfessorSubjects: async (
        professorId,
        subjectIds
    ) => {

        const token =
            localStorage.getItem("admin_token");

        const response = await fetch(
            "http://localhost:3000/api/auth/admin/assignSubjectsToProfessor",
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },

                body: JSON.stringify({
                    professorId: Number(professorId),

                    subjectIds:
                        subjectIds.map(
                            id => Number(id)
                        )
                })
            }
        );

        const data =
            await response.json();

        if (!response.ok) {

            throw new Error(
                data.message ||
                `Failed to assign professor subjects. Status: ${response.status}`
            );

        }

        return data;

    }

};


/*
|--------------------------------------------------------------------------
| COMPONENT
|--------------------------------------------------------------------------
*/

const AllProfessor = () => {

    /*
    |--------------------------------------------------------------------------
    | MAIN DATA
    |--------------------------------------------------------------------------
    */

    const [professors, setProfessors] =
        useState([]);

    const [selectedProgram, setSelectedProgram] =
        useState("");

    const [search, setSearch] =
        useState("");

    const [loadingProfessors, setLoadingProfessors] =
        useState(true);


    /*
    |--------------------------------------------------------------------------
    | SELECTED PROFESSORS
    |--------------------------------------------------------------------------
    |
    | Used for mass assignment.
    |
    | Example:
    |
    | [1, 2, 3, 4, 5]
    |
    */

    const [selectedProfessorIds, setSelectedProfessorIds] =
        useState([]);


    /*
    |--------------------------------------------------------------------------
    | MASS ASSIGN MODAL
    |--------------------------------------------------------------------------
    */

    const [showMassAssignModal, setShowMassAssignModal] =
        useState(false);

    const [massAssignSubjects, setMassAssignSubjects] =
        useState([]);

    const [massAssignSubject, setMassAssignSubject] =
        useState("");

    const [massAssignSubjectSearch, setMassAssignSubjectSearch] =
        useState("");

    const [loadingMassSubjects, setLoadingMassSubjects] =
        useState(false);

    const [savingMassAssignment, setSavingMassAssignment] =
        useState(false);


    /*
    |--------------------------------------------------------------------------
    | ASSIGN SUBJECT MODAL
    |--------------------------------------------------------------------------
    */

    const [showAssignModal, setShowAssignModal] =
        useState(false);

    const [selectedProfessor, setSelectedProfessor] =
        useState(null);

    const [assignmentProgram, setAssignmentProgram] =
        useState(null);

    const [subjects, setSubjects] =
        useState([]);

    const [selectedSubjects, setSelectedSubjects] =
        useState([]);

    const [subjectSearch, setSubjectSearch] =
        useState("");

    const [loadingSubjects, setLoadingSubjects] =
        useState(false);

    const [savingSubjects, setSavingSubjects] =
        useState(false);


    /*
    |--------------------------------------------------------------------------
    | SUBJECT DISPLAY FILTER
    |--------------------------------------------------------------------------
    */

    const [subjectDisplayFilter, setSubjectDisplayFilter] =
        useState("no-professor");


    /*
    |--------------------------------------------------------------------------
    | VIEW MODAL
    |--------------------------------------------------------------------------
    */

    const [showViewModal, setShowViewModal] =
        useState(false);


    /*
    |--------------------------------------------------------------------------
    | LOAD PROFESSORS
    |--------------------------------------------------------------------------
    */

    const loadProfessors = async () => {

        setLoadingProfessors(true);

        try {

            const professorData =
                await api.getProfessors();

            setProfessors(
                Array.isArray(professorData)
                    ? professorData
                    : []
            );

        } catch (error) {

            console.error(
                "Failed to load professors:",
                error
            );

            alert(
                error.message ||
                "Failed to load professors."
            );

        } finally {

            setLoadingProfessors(false);

        }

    };


    /*
    |--------------------------------------------------------------------------
    | INITIAL LOAD
    |--------------------------------------------------------------------------
    */

    useEffect(() => {

        loadProfessors();

    }, []);


    /*
    |--------------------------------------------------------------------------
    | BUILD PROGRAM LIST
    |--------------------------------------------------------------------------
    */

    const programs = useMemo(() => {

        const programMap =
            new Map();

        professors.forEach(
            professor => {

                if (
                    !Array.isArray(
                        professor.programs
                    )
                ) {
                    return;
                }

                professor.programs.forEach(
                    program => {

                        if (
                            !program ||
                            !program.id
                        ) {
                            return;
                        }

                        if (
                            !programMap.has(
                                program.id
                            )
                        ) {

                            programMap.set(
                                program.id,
                                program
                            );

                        }

                    }
                );

            }
        );

        return Array.from(
            programMap.values()
        ).sort(
            (a, b) =>
                (
                    a.program_code || ""
                ).localeCompare(
                    b.program_code || ""
                )
        );

    }, [professors]);


    /*
    |--------------------------------------------------------------------------
    | SELECTED PROGRAM OBJECT
    |--------------------------------------------------------------------------
    */

    const selectedProgramObject =
        useMemo(() => {

            if (!selectedProgram) {
                return null;
            }

            return (
                programs.find(
                    program =>
                        Number(program.id) ===
                        Number(selectedProgram)
                ) || null
            );

        }, [
            programs,
            selectedProgram
        ]);


    /*
    |--------------------------------------------------------------------------
    | FILTER PROFESSORS
    |--------------------------------------------------------------------------
    */

    const filteredProfessors =
        useMemo(() => {

            const searchValue =
                search
                    .toLowerCase()
                    .trim();

            return professors.filter(
                professor => {

                    const professorPrograms =
                        Array.isArray(
                            professor.programs
                        )
                            ? professor.programs
                            : [];

                    const matchesProgram =
                        !selectedProgram ||
                        professorPrograms.some(
                            program =>
                                Number(
                                    program.id
                                ) ===
                                Number(
                                    selectedProgram
                                )
                        );

                    const fullName =
                        `${professor.firstname || ""} ${
                            professor.middlename || ""
                        } ${
                            professor.lastname || ""
                        }`
                            .toLowerCase()
                            .trim();

                    const employeeId =
                        (
                            professor.employee_id ||
                            ""
                        ).toLowerCase();

                    const matchesSearch =
                        !searchValue ||
                        fullName.includes(
                            searchValue
                        ) ||
                        employeeId.includes(
                            searchValue
                        );

                    return (
                        matchesProgram &&
                        matchesSearch
                    );

                }
            );

        }, [
            professors,
            selectedProgram,
            search
        ]);


    /*
    |--------------------------------------------------------------------------
    | ASSIGNED SUBJECT COUNT
    |--------------------------------------------------------------------------
    */

    const getAssignedSubjectCount = (
        professor
    ) => {

        if (!professor) {
            return 0;
        }

        const count =
            Number(
                professor.assigned_subject_count
            );

        return Number.isFinite(count)
            ? count
            : 0;

    };


    /*
    |--------------------------------------------------------------------------
    | ASSIGNMENT STATUS
    |--------------------------------------------------------------------------
    */

    const getAssignmentStatus = (
        professor
    ) => {

        const count =
            getAssignedSubjectCount(
                professor
            );

        if (count > 0) {

            return {
                assigned: true,
                count,
                label:
                    `${count} subject${
                        count !== 1
                            ? "s"
                            : ""
                    } assigned`
            };

        }

        return {
            assigned: false,
            count: 0,
            label: "No assignment"
        };

    };


    /*
    |--------------------------------------------------------------------------
    | SUBJECT PROFESSOR COUNT
    |--------------------------------------------------------------------------
    */

    const getSubjectProfessorCount = (
        subject
    ) => {

        const count =
            Number(
                subject?.professor_count
            );

        return Number.isFinite(count)
            ? count
            : 0;

    };


    /*
    |--------------------------------------------------------------------------
    | SUBJECT HAS PROFESSOR
    |--------------------------------------------------------------------------
    */

    const subjectHasProfessor = (
        subject
    ) => {

        return (
            getSubjectProfessorCount(
                subject
            ) > 0
        );

    };


    /*
    |--------------------------------------------------------------------------
    | SUBJECT FILTER COUNTS
    |--------------------------------------------------------------------------
    */

    const subjectsWithProfessor =
        useMemo(() => {

            return subjects.filter(
                subject =>
                    subjectHasProfessor(
                        subject
                    )
            );

        }, [subjects]);


    const subjectsWithoutProfessor =
        useMemo(() => {

            return subjects.filter(
                subject =>
                    !subjectHasProfessor(
                        subject
                    )
            );

        }, [subjects]);


    /*
    |--------------------------------------------------------------------------
    | FILTER SUBJECTS
    |--------------------------------------------------------------------------
    */

    const filteredSubjects =
        useMemo(() => {

            const searchValue =
                subjectSearch
                    .toLowerCase()
                    .trim();

            let displaySubjects =
                subjectDisplayFilter ===
                "has-professor"
                    ? subjectsWithProfessor
                    : subjectsWithoutProfessor;

            if (!searchValue) {
                return displaySubjects;
            }

            return displaySubjects.filter(
                subject => {

                    const code =
                        (
                            subject.subject_code ||
                            subject.code ||
                            ""
                        ).toLowerCase();

                    const name =
                        (
                            subject.subject_name ||
                            subject.name ||
                            ""
                        ).toLowerCase();

                    return (
                        code.includes(
                            searchValue
                        ) ||
                        name.includes(
                            searchValue
                        )
                    );

                }
            );

        }, [
            subjects,
            subjectsWithProfessor,
            subjectsWithoutProfessor,
            subjectDisplayFilter,
            subjectSearch
        ]);


    /*
    |--------------------------------------------------------------------------
    | TOGGLE PROFESSOR
    |--------------------------------------------------------------------------
    */

    const toggleProfessorSelection = (
        professorId
    ) => {

        const id =
            Number(professorId);

        setSelectedProfessorIds(
            prev => {

                const normalized =
                    prev.map(
                        value =>
                            Number(value)
                    );

                if (
                    normalized.includes(id)
                ) {

                    return normalized.filter(
                        value =>
                            value !== id
                    );

                }

                return [
                    ...normalized,
                    id
                ];

            }
        );

    };


    /*
    |--------------------------------------------------------------------------
    | SELECT ALL PROFESSORS
    |--------------------------------------------------------------------------
    |
    | Selects all professors currently visible after the program/search
    | filters. This keeps bulk selection predictable when the admin
    | is working with a filtered list.
    */

    const selectAllProfessors = () => {

        if (loadingProfessors || filteredProfessors.length === 0) {
            return;
        }

        const visibleProfessorIds =
            filteredProfessors.map(
                professor => Number(professor.id)
            );

        setSelectedProfessorIds(
            prev => {

                const normalized =
                    prev.map(id => Number(id));

                const combined =
                    new Set([
                        ...normalized,
                        ...visibleProfessorIds
                    ]);

                return Array.from(combined);

            }
        );

    };


    /*
    |--------------------------------------------------------------------------
    | CLEAR PROFESSOR SELECTION
    |--------------------------------------------------------------------------
    |
    | Clears every selected professor, including professors that may no
    | longer be visible because of the current search/filter.
    */

    const clearProfessorSelection = () => {

        if (loadingProfessors) {
            return;
        }

        setSelectedProfessorIds([]);

    };


    /*
    |--------------------------------------------------------------------------
    | IS PROFESSOR SELECTED
    |--------------------------------------------------------------------------
    */

    const isProfessorSelected = (
        professorId
    ) => {

        return selectedProfessorIds.some(
            id =>
                Number(id) ===
                Number(professorId)
        );

    };


    /*
    |--------------------------------------------------------------------------
    | PROGRAM CHANGE
    |--------------------------------------------------------------------------
    */

    const handleProgramChange = (
        event
    ) => {

        setSelectedProgram(
            event.target.value
        );

        setSearch("");

        /*
        | When program changes, old professor selections
        | should not remain selected.
        */

        setSelectedProfessorIds([]);

    };


    /*
    |--------------------------------------------------------------------------
    | OPEN INDIVIDUAL ASSIGN MODAL
    |--------------------------------------------------------------------------
    */

    const openAssignModal = async (
        professor
    ) => {

        if (!selectedProgram) {

            alert(
                "Please select a program first before assigning subjects."
            );

            return;

        }

        const professorProgram =
            Array.isArray(
                professor.programs
            )
                ? professor.programs.find(
                    program =>
                        Number(
                            program.id
                        ) ===
                        Number(
                            selectedProgram
                        )
                )
                : null;

        if (!professorProgram) {

            alert(
                "This professor is not assigned to the selected program."
            );

            return;

        }

        if (!professor.id) {

            alert(
                "Professor ID is missing."
            );

            return;

        }

        setSelectedProfessor(
            professor
        );

        setAssignmentProgram(
            professorProgram
        );

        setSubjects([]);

        setSelectedSubjects([]);

        setSubjectSearch("");

        setSubjectDisplayFilter(
            "no-professor"
        );

        setShowAssignModal(true);

        setLoadingSubjects(true);

        try {

            const programSubjects =
                await api.getCurriculumSubjects(
                    professorProgram.id,
                    professor.id
                );

            const normalizedSubjects =
                Array.isArray(programSubjects)
                    ? programSubjects.map(
                        subject => ({

                            ...subject,

                            id:
                                Number(
                                    subject.id
                                ),

                            professor_count:
                                Number(
                                    subject.professor_count
                                ) || 0

                        })
                    )
                    : [];

            setSubjects(
                normalizedSubjects
            );

        } catch (error) {

            console.error(
                "Failed to load curriculum subjects:",
                error
            );

            setSubjects([]);

            alert(
                error.message ||
                "Failed to load subjects for this professor."
            );

        } finally {

            setLoadingSubjects(false);

        }

    };


    /*
    |--------------------------------------------------------------------------
    | CLOSE INDIVIDUAL ASSIGN MODAL
    |--------------------------------------------------------------------------
    */

    const closeAssignModal = () => {

        if (
            loadingSubjects ||
            savingSubjects
        ) {
            return;
        }

        setShowAssignModal(false);

        setSelectedProfessor(null);

        setAssignmentProgram(null);

        setSubjects([]);

        setSelectedSubjects([]);

        setSubjectSearch("");

        setSubjectDisplayFilter(
            "no-professor"
        );

    };


    /*
    |--------------------------------------------------------------------------
    | TOGGLE SUBJECT
    |--------------------------------------------------------------------------
    */

    const toggleSubject = (
        subjectId
    ) => {

        if (
            loadingSubjects ||
            savingSubjects
        ) {
            return;
        }

        const normalizedId =
            Number(subjectId);

        setSelectedSubjects(
            prev => {

                const normalized =
                    prev.map(
                        id =>
                            Number(id)
                    );

                if (
                    normalized.includes(
                        normalizedId
                    )
                ) {

                    return normalized.filter(
                        id =>
                            id !==
                            normalizedId
                    );

                }

                return [
                    ...normalized,
                    normalizedId
                ];

            }
        );

    };


    /*
    |--------------------------------------------------------------------------
    | SELECT ALL SUBJECTS
    |--------------------------------------------------------------------------
    */

    const selectAllSubjects = () => {

        if (
            loadingSubjects ||
            savingSubjects
        ) {
            return;
        }

        const visibleIds =
            filteredSubjects.map(
                subject =>
                    Number(subject.id)
            );

        setSelectedSubjects(
            prev => {

                const combined =
                    new Set([
                        ...prev.map(
                            id =>
                                Number(id)
                        ),
                        ...visibleIds
                    ]);

                return Array.from(
                    combined
                );

            }
        );

    };


    /*
    |--------------------------------------------------------------------------
    | CLEAR SUBJECTS
    |--------------------------------------------------------------------------
    */

    const clearAllSubjects = () => {

        if (
            loadingSubjects ||
            savingSubjects
        ) {
            return;
        }

        const visibleIds =
            new Set(
                filteredSubjects.map(
                    subject =>
                        Number(subject.id)
                )
            );

        setSelectedSubjects(
            prev =>
                prev
                    .map(
                        id =>
                            Number(id)
                    )
                    .filter(
                        id =>
                            !visibleIds.has(id)
                    )
        );

    };


    /*
    |--------------------------------------------------------------------------
    | SAVE INDIVIDUAL ASSIGNMENTS
    |--------------------------------------------------------------------------
    */

    const saveAssignments = async () => {

        if (
            !selectedProfessor ||
            !assignmentProgram ||
            loadingSubjects ||
            savingSubjects
        ) {
            return;
        }

        const availableSubjectIds =
            new Set(
                subjects.map(
                    subject =>
                        Number(subject.id)
                )
            );

        const validSelectedSubjectIds =
            selectedSubjects
                .map(
                    id =>
                        Number(id)
                )
                .filter(
                    id =>
                        availableSubjectIds.has(id)
                );

        if (
            validSelectedSubjectIds.length ===
            0
        ) {

            alert(
                "Please select at least one subject."
            );

            return;

        }

        setSavingSubjects(true);

        try {

            const result =
                await api.saveProfessorSubjects(
                    selectedProfessor.id,
                    validSelectedSubjectIds
                );

            if (!result.success) {

                throw new Error(
                    result.message ||
                    "Failed to save subject assignments."
                );

            }

            await loadProfessors();

            alert(
                result.message ||
                "Subject assignments saved successfully."
            );

            closeAssignModal();

        } catch (error) {

            console.error(
                "Failed to save assignments:",
                error
            );

            alert(
                error.message ||
                "Failed to save subject assignments."
            );

        } finally {

            setSavingSubjects(false);

        }

    };


    /*
    |--------------------------------------------------------------------------
    | OPEN MASS ASSIGN MODAL
    |--------------------------------------------------------------------------
    */

    const openMassAssignModal = async () => {

        if (
            selectedProfessorIds.length ===
            0
        ) {
            return;
        }

        if (!selectedProgram) {

            alert(
                "Please select a program first."
            );

            return;

        }

        /*
        | Only selected professors that actually belong
        | to the selected program.
        */

        const validProfessors =
            professors.filter(
                professor =>
                    selectedProfessorIds.includes(
                        Number(professor.id)
                    ) &&
                    Array.isArray(
                        professor.programs
                    ) &&
                    professor.programs.some(
                        program =>
                            Number(program.id) ===
                            Number(selectedProgram)
                    )
            );

        if (
            validProfessors.length ===
            0
        ) {

            alert(
                "None of the selected professors belong to the selected program."
            );

            return;

        }

        /*
        | We use the first selected professor to retrieve
        | the program subjects.
        |
        | IMPORTANT:
        | This is still your EXISTING GET API.
        */

        const firstProfessor =
            validProfessors[0];

        setLoadingMassSubjects(true);

        setMassAssignSubjects([]);

        setMassAssignSubject("");

        setMassAssignSubjectSearch("");

        setShowMassAssignModal(true);

        try {

            const programSubjects =
                await api.getCurriculumSubjects(
                    selectedProgram,
                    firstProfessor.id
                );

            const normalizedSubjects =
                Array.isArray(programSubjects)
                    ? programSubjects.map(
                        subject => ({

                            ...subject,

                            id:
                                Number(
                                    subject.id
                                ),

                            professor_count:
                                Number(
                                    subject.professor_count
                                ) || 0

                        })
                    )
                    : [];

            setMassAssignSubjects(
                normalizedSubjects
            );

        } catch (error) {

            console.error(
                "Failed to load subjects for mass assignment:",
                error
            );

            setMassAssignSubjects([]);

            alert(
                error.message ||
                "Failed to load subjects."
            );

            setShowMassAssignModal(false);

        } finally {

            setLoadingMassSubjects(false);

        }

    };


    /*
    |--------------------------------------------------------------------------
    | CLOSE MASS ASSIGN MODAL
    |--------------------------------------------------------------------------
    */

    const closeMassAssignModal = () => {

        if (
            loadingMassSubjects ||
            savingMassAssignment
        ) {
            return;
        }

        setShowMassAssignModal(false);

        setMassAssignSubjects([]);

        setMassAssignSubject("");

        setMassAssignSubjectSearch("");

    };


    /*
    |--------------------------------------------------------------------------
    | MASS SUBJECT FILTER
    |--------------------------------------------------------------------------
    */

    const filteredMassAssignSubjects =
        useMemo(() => {

            const searchValue =
                massAssignSubjectSearch
                    .toLowerCase()
                    .trim();

            if (!searchValue) {
                return massAssignSubjects;
            }

            return massAssignSubjects.filter(
                subject => {

                    const code =
                        (
                            subject.subject_code ||
                            subject.code ||
                            ""
                        ).toLowerCase();

                    const name =
                        (
                            subject.subject_name ||
                            subject.name ||
                            ""
                        ).toLowerCase();

                    return (
                        code.includes(
                            searchValue
                        ) ||
                        name.includes(
                            searchValue
                        )
                    );

                }
            );

        }, [
            massAssignSubjects,
            massAssignSubjectSearch
        ]);


    /*
    |--------------------------------------------------------------------------
    | MASS ASSIGN SUBJECT
    |--------------------------------------------------------------------------
    */

    const saveMassAssignment = async () => {

        if (
            savingMassAssignment ||
            loadingMassSubjects
        ) {
            return;
        }

        if (
            selectedProfessorIds.length ===
            0
        ) {

            alert(
                "Please select at least one professor."
            );

            return;

        }

        if (!massAssignSubject) {

            alert(
                "Please select one subject."
            );

            return;

        }

        const subjectId =
            Number(
                massAssignSubject
            );

        /*
        | Only professors currently displayed/selected
        | and belonging to the selected program.
        */

        const validProfessorIds =
            professors
                .filter(
                    professor =>
                        selectedProfessorIds.includes(
                            Number(professor.id)
                        ) &&
                        Array.isArray(
                            professor.programs
                        ) &&
                        professor.programs.some(
                            program =>
                                Number(program.id) ===
                                Number(selectedProgram)
                        )
                )
                .map(
                    professor =>
                        Number(professor.id)
                );

        if (
            validProfessorIds.length ===
            0
        ) {

            alert(
                "No valid professors selected."
            );

            return;

        }

        setSavingMassAssignment(true);

        try {

            /*
            |--------------------------------------------------------------------------
            | USE EXISTING API
            |--------------------------------------------------------------------------
            |
            | We do NOT create:
            |
            | POST /massAssign
            |
            | Instead we simply call the existing endpoint
            | once for every selected professor.
            |
            | Example:
            |
            | professorId: 1 subjectIds: [1]
            | professorId: 2 subjectIds: [1]
            | professorId: 3 subjectIds: [1]
            | ...
            |
            */

            const results =
                await Promise.all(
                    validProfessorIds.map(
                        professorId =>
                            api.saveProfessorSubjects(
                                professorId,
                                [subjectId]
                            )
                    )
                );

            const failed =
                results.filter(
                    result =>
                        result &&
                        result.success === false
                );

            if (
                failed.length > 0
            ) {

                throw new Error(
                    failed[0].message ||
                    "Some professor assignments failed."
                );

            }

            /*
            | Refresh professor counts/status.
            */

            await loadProfessors();

            alert(
                `Subject assigned successfully to ${validProfessorIds.length} professor${
                    validProfessorIds.length !== 1
                        ? "s"
                        : ""
                }.`
            );

            /*
            | Clear selected professors after success.
            */

            setSelectedProfessorIds([]);

            closeMassAssignModal();

        } catch (error) {

            console.error(
                "Mass assignment failed:",
                error
            );

            alert(
                error.message ||
                "Failed to assign subject to selected professors."
            );

        } finally {

            setSavingMassAssignment(false);

        }

    };


    /*
    |--------------------------------------------------------------------------
    | VIEW PROFESSOR
    |--------------------------------------------------------------------------
    */

    const openViewModal = (
        professor
    ) => {

        setSelectedProfessor(
            professor
        );

        setShowViewModal(true);

    };


    const closeViewModal = () => {

        setShowViewModal(false);

        setSelectedProfessor(null);

    };


    /*
    |--------------------------------------------------------------------------
    | STATISTICS
    |--------------------------------------------------------------------------
    */

    const totalProfessors =
        professors.length;

    const filteredProfessorCount =
        filteredProfessors.length;

    const unassignedProfessorCount =
        professors.filter(
            professor =>
                getAssignedSubjectCount(
                    professor
                ) === 0
        ).length;


    /*
    |--------------------------------------------------------------------------
    | CURRENT SUBJECT FILTER COUNT
    |--------------------------------------------------------------------------
    */

    const currentSubjectFilterCount =
        subjectDisplayFilter ===
        "has-professor"
            ? subjectsWithProfessor.length
            : subjectsWithoutProfessor.length;


    /*
    |--------------------------------------------------------------------------
    | RENDER
    |--------------------------------------------------------------------------
    */

    return (

        <div className="student-dashboard">


            {/* =========================================================
                HEADER
            ========================================================= */}

            <div className="student-header">

                <div>

                    <h1>
                        Professors
                    </h1>

                    <p>
                        Manage professors and their teaching subjects
                    </p>

                </div>

                <button className="add-student-btn">
                    + Add Professor
                </button>

            </div>


            {/* =========================================================
                STATISTICS
            ========================================================= */}

            <div className="student-stats">

                <div className="student-stat-card">

                    <span>
                        Total Professor
                    </span>

                    <h2>
                        {totalProfessors}
                    </h2>

                </div>


                <div className="student-stat-card">

                    <span>
                        Selected Program
                    </span>

                    <h2>
                        {
                            selectedProgramObject
                                ? selectedProgramObject.program_code
                                : "All"
                        }
                    </h2>

                </div>


                <div className="student-stat-card">

                    <span>
                        Showing
                    </span>

                    <h2>
                        {filteredProfessorCount}
                    </h2>

                </div>


                <div className="student-stat-card">

                    <span>
                        Without Assignment
                    </span>

                    <h2
                        style={{
                            color:
                                unassignedProfessorCount > 0
                                    ? "#dc2626"
                                    : "#16803c"
                        }}
                    >
                        {
                            unassignedProfessorCount
                        }
                    </h2>

                </div>

            </div>


            {/* =========================================================
                CONTENT
            ========================================================= */}

            <div className="student-content">


                {/* =====================================================
                    FILTER BAR
                ===================================================== */}

                <div className="professor-filter-bar">

                    <select
                        value={selectedProgram}
                        onChange={
                            handleProgramChange
                        }
                        className="professor-program-select"
                    >

                        <option value="">
                            All Programs
                        </option>

                        {programs.map(
                            program => (

                                <option
                                    key={
                                        program.id
                                    }
                                    value={
                                        program.id
                                    }
                                >
                                    {
                                        program.program_code
                                    }{" "}
                                    —{" "}
                                    {
                                        program.program_name
                                    }
                                </option>

                            )
                        )}

                    </select>


                    <input
                        type="text"
                        placeholder="Search professor..."
                        value={search}
                        onChange={
                            e =>
                                setSearch(
                                    e.target.value
                                )
                        }
                        className="professor-search-input"
                    />

                </div>


                {/* =====================================================
                    PROFESSOR SELECTION ACTIONS
                ===================================================== */}

                <div className="professor-selection-action-bar">

                    <div className="professor-selection-actions-left">

                        <strong>
                            {selectedProfessorIds.length} professor
                            {selectedProfessorIds.length !== 1 ? "s" : ""} selected
                        </strong>

                        <span>
                            {filteredProfessors.length} professor
                            {filteredProfessors.length !== 1 ? "s" : ""} currently shown
                        </span>

                    </div>

                    <div className="professor-selection-actions">

                        <button
                            type="button"
                            className="professor-select-all-btn"
                            onClick={selectAllProfessors}
                            disabled={
                                loadingProfessors ||
                                filteredProfessors.length === 0
                            }
                        >
                            Select All Professors
                        </button>

                        <button
                            type="button"
                            className="professor-clear-btn"
                            onClick={clearProfessorSelection}
                            disabled={
                                loadingProfessors ||
                                selectedProfessorIds.length === 0
                            }
                        >
                            Clear
                        </button>

                    </div>

                </div>


                {/* =====================================================
                    MASS ASSIGN BUTTON
                ===================================================== */}

                {selectedProfessorIds.length > 0 && (
                    <div className="mass-professor-action-bar">

                        <div>

                            <strong>
                                {selectedProfessorIds.length} professor
                                {
                                    selectedProfessorIds.length !== 1
                                        ? "s"
                                        : ""
                                } selected
                            </strong>

                            <span>
                                Select one subject to assign to all
                                selected professors.
                            </span>

                        </div>

                        <button
                            type="button"
                            className="view-student-btn"
                            onClick={
                                openMassAssignModal
                            }
                            disabled={
                                !selectedProgram
                            }
                        >
                            Assign Subject
                        </button>

                    </div>
                )}


                {/* =====================================================
                    SELECTED PROGRAM
                ===================================================== */}

                {selectedProgramObject && (

                    <div className="selected-program-box">

                        <strong>
                            {
                                selectedProgramObject.program_code
                            }{" "}
                            —{" "}
                            {
                                selectedProgramObject.program_name
                            }
                        </strong>

                        {selectedProgramObject.description && (

                            <p>
                                {
                                    selectedProgramObject.description
                                }
                            </p>

                        )}

                    </div>

                )}


                {/* =====================================================
                    TABLE
                ===================================================== */}

                <div className="student-table-container">

                    <table>

                        <thead>

                            <tr>

                                <th>
                                    Professor ID
                                </th>

                                <th>
                                    Name
                                </th>

                                <th>
                                    Contact no.
                                </th>

                                <th>
                                    Department
                                </th>

                                <th>
                                    Programs
                                </th>

                                <th>
                                    Subject Assignment
                                </th>

                                <th>
                                    Action
                                </th>

                            </tr>

                        </thead>


                        <tbody>

                            {loadingProfessors ? (

                                <tr>

                                    <td
                                        colSpan="7"
                                        className="no-students"
                                    >
                                        Loading professors...
                                    </td>

                                </tr>

                            ) : filteredProfessors.length > 0 ? (

                                filteredProfessors.map(
                                    professor => {

                                        const assignmentStatus =
                                            getAssignmentStatus(
                                                professor
                                            );

                                        const selected =
                                            isProfessorSelected(
                                                professor.id
                                            );

                                        return (

                                            <tr
                                                key={
                                                    professor.id
                                                }
                                                className={
                                                    selected
                                                        ? "professor-row-selected"
                                                        : ""
                                                }
                                            >

                                                {/* =================================================
                                                    PROFESSOR ID
                                                    Clicking the column checks/unchecks.
                                                ================================================= */}

                                                <td
                                                    className="professor-selectable-cell"
                                                    onClick={() =>
                                                        toggleProfessorSelection(
                                                            professor.id
                                                        )
                                                    }
                                                >

                                                    <div className="professor-checkbox-wrapper">

                                                        <input
                                                            type="checkbox"
                                                            checked={
                                                                selected
                                                            }
                                                            onChange={() =>
                                                                toggleProfessorSelection(
                                                                    professor.id
                                                                )
                                                            }
                                                            onClick={e =>
                                                                e.stopPropagation()
                                                            }
                                                        />

                                                        <span>
                                                            {
                                                                professor.employee_id
                                                            }
                                                        </span>

                                                    </div>

                                                </td>


                                                {/* =================================================
                                                    NAME
                                                    Clicking the name column also checks/unchecks.
                                                ================================================= */}

                                                <td
                                                    className="professor-selectable-cell"
                                                    onClick={() =>
                                                        toggleProfessorSelection(
                                                            professor.id
                                                        )
                                                    }
                                                >

                                                    <div>

                                                        <div className="professor-name">

                                                            {
                                                                professor.firstname
                                                            }{" "}

                                                            {
                                                                professor.middlename
                                                                    ? `${professor.middlename} `
                                                                    : ""
                                                            }

                                                            {
                                                                professor.lastname
                                                            }

                                                        </div>


                                                        <div
                                                            className={`professor-assignment-indicator ${
                                                                assignmentStatus.assigned
                                                                    ? "assigned"
                                                                    : "unassigned"
                                                            }`}
                                                        >

                                                            <span />

                                                            {
                                                                assignmentStatus.label
                                                            }

                                                        </div>

                                                    </div>

                                                </td>


                                                <td>
                                                    {
                                                        professor.phone ||
                                                        "N/A"
                                                    }
                                                </td>


                                                <td>

                                                    <div>

                                                        <strong>
                                                            {
                                                                professor.department_code ||
                                                                "N/A"
                                                            }
                                                        </strong>

                                                        <div className="department-description">
                                                            {
                                                                professor.department_description ||
                                                                "N/A"
                                                            }
                                                        </div>

                                                    </div>

                                                </td>


                                                <td>

                                                    {Array.isArray(
                                                        professor.programs
                                                    ) &&
                                                    professor.programs.length >
                                                        0 ? (

                                                        <div className="program-tags">

                                                            {
                                                                professor.programs.map(
                                                                    program => (

                                                                        <span
                                                                            key={
                                                                                program.id
                                                                            }
                                                                        >
                                                                            {
                                                                                program.program_code
                                                                            }
                                                                        </span>

                                                                    )
                                                                )
                                                            }

                                                        </div>

                                                    ) : (

                                                        "N/A"

                                                    )}

                                                </td>


                                                <td>

                                                    <div
                                                        className={`subject-assignment-badge ${
                                                            assignmentStatus.assigned
                                                                ? "assigned"
                                                                : "unassigned"
                                                        }`}
                                                    >

                                                        <span />

                                                        {
                                                            assignmentStatus.label
                                                        }

                                                    </div>

                                                </td>


                                                <td>

                                                    <div className="professor-actions">

                                                        <button
                                                            className="view-student-btn"
                                                            onClick={() =>
                                                                openViewModal(
                                                                    professor
                                                                )
                                                            }
                                                        >
                                                            View
                                                        </button>


                                                        {/* =================================================
                                                            EXISTING ONE-BY-ONE ASSIGN BUTTON
                                                        ================================================= */}

                                                        <button
                                                            className="view-student-btn"
                                                            onClick={() =>
                                                                openAssignModal(
                                                                    professor
                                                                )
                                                            }
                                                            disabled={
                                                                !selectedProgram
                                                            }
                                                            title={
                                                                !selectedProgram
                                                                    ? "Select a program first"
                                                                    : "Assign subjects"
                                                            }
                                                        >
                                                            Assign Subject
                                                        </button>

                                                    </div>

                                                </td>

                                            </tr>

                                        );

                                    }
                                )

                            ) : (

                                <tr>

                                    <td
                                        colSpan="7"
                                        className="no-students"
                                    >
                                        No Professor found
                                    </td>

                                </tr>

                            )}

                        </tbody>

                    </table>

                </div>

            </div>


            {/* =========================================================
                MASS ASSIGN SUBJECT MODAL
            ========================================================= */}

            {showMassAssignModal && (

                <div
                    className="professor-modal-overlay"
                    onMouseDown={e => {

                        if (
                            e.target ===
                                e.currentTarget &&
                            !savingMassAssignment &&
                            !loadingMassSubjects
                        ) {

                            closeMassAssignModal();

                        }

                    }}
                >

                    <div className="professor-modal">


                        {/* HEADER */}

                        <div className="professor-modal-header">

                            <div>

                                <h2>
                                    Assign Subject
                                </h2>

                                <p>
                                    Assign one subject to{" "}
                                    {
                                        selectedProfessorIds.length
                                    }{" "}
                                    selected professor
                                    {
                                        selectedProfessorIds.length !== 1
                                            ? "s"
                                            : ""
                                    }
                                </p>

                            </div>


                            <button
                                className="professor-modal-close"
                                onClick={
                                    closeMassAssignModal
                                }
                                disabled={
                                    savingMassAssignment ||
                                    loadingMassSubjects
                                }
                            >
                                ×
                            </button>

                        </div>


                        {/* SELECTED PROFESSORS */}

                        <div className="professor-info-box">

                            <div>

                                <span>
                                    Selected Professors
                                </span>

                                <strong>
                                    {
                                        selectedProfessorIds.length
                                    }
                                </strong>

                            </div>


                            <div>

                                <span>
                                    Program
                                </span>

                                <strong>
                                    {
                                        selectedProgramObject
                                            ?.program_code ||
                                        "N/A"
                                    }
                                </strong>

                            </div>

                        </div>


                        {/* SELECTED PROFESSOR LIST */}

                        <div className="mass-selected-professor-list">

                            {
                                professors
                                    .filter(
                                        professor =>
                                            selectedProfessorIds.includes(
                                                Number(
                                                    professor.id
                                                )
                                            )
                                    )
                                    .map(
                                        professor => (

                                            <span
                                                key={
                                                    professor.id
                                                }
                                                className="mass-selected-professor-tag"
                                            >
                                                {
                                                    professor.firstname
                                                }{" "}
                                                {
                                                    professor.lastname
                                                }
                                            </span>

                                        )
                                    )
                            }

                        </div>


                        {/* SUBJECT HEADER */}

                        <div className="subject-assignment-header">

                            <div>

                                <h3>
                                    Select Subject
                                </h3>

                                <p>
                                    Only one subject can be selected for
                                    mass assignment.
                                </p>

                            </div>

                        </div>


                        {/* SEARCH */}

                        <input
                            type="text"
                            placeholder="Search subject..."
                            value={
                                massAssignSubjectSearch
                            }
                            onChange={
                                e =>
                                    setMassAssignSubjectSearch(
                                        e.target.value
                                    )
                            }
                            disabled={
                                loadingMassSubjects ||
                                savingMassAssignment
                            }
                            className="subject-search-input"
                        />


                        {/* SUBJECT LIST */}

                        <div className="subject-assignment-list">

                            {loadingMassSubjects ? (

                                <div className="subject-empty subject-loading-state">

                                    <div>
                                        Loading subjects...
                                    </div>

                                    <small>
                                        Fetching subjects for{" "}
                                        {
                                            selectedProgramObject
                                                ?.program_code
                                        }
                                    </small>

                                </div>

                            ) : filteredMassAssignSubjects.length >
                              0 ? (

                                filteredMassAssignSubjects.map(
                                    subject => {

                                        const subjectId =
                                            Number(
                                                subject.id
                                            );

                                        const checked =
                                            Number(
                                                massAssignSubject
                                            ) ===
                                            subjectId;

                                        const professorCount =
                                            getSubjectProfessorCount(
                                                subject
                                            );

                                        return (

                                            <label
                                                key={
                                                    subject.id
                                                }
                                                className={`subject-assignment-item ${
                                                    checked
                                                        ? "selected"
                                                        : ""
                                                }`}
                                            >

                                                <input
                                                    type="radio"
                                                    name="massAssignSubject"
                                                    checked={
                                                        checked
                                                    }
                                                    onChange={() =>
                                                        setMassAssignSubject(
                                                            String(
                                                                subjectId
                                                            )
                                                        )
                                                    }
                                                    disabled={
                                                        savingMassAssignment ||
                                                        loadingMassSubjects
                                                    }
                                                />


                                                <div className="subject-information">

                                                    <strong>
                                                        {
                                                            subject.subject_code ||
                                                            subject.code
                                                        }
                                                    </strong>

                                                    <span>
                                                        {
                                                            subject.subject_name ||
                                                            subject.name
                                                        }
                                                    </span>

                                                </div>


                                                <span
                                                    className={`subject-professor-count ${
                                                        professorCount >
                                                        0
                                                            ? "has-professor"
                                                            : "no-professor"
                                                    }`}
                                                >

                                                    <span className="subject-professor-count-dot" />

                                                    {
                                                        professorCount
                                                    }{" "}
                                                    professor
                                                    {
                                                        professorCount !==
                                                        1
                                                            ? "s"
                                                            : ""
                                                    }

                                                </span>


                                                <span className="subject-units">

                                                    {
                                                        subject.units
                                                    }{" "}
                                                    units

                                                </span>

                                            </label>

                                        );

                                    }
                                )

                            ) : (

                                <div className="subject-empty">

                                    No subjects found.

                                </div>

                            )}

                        </div>


                        {/* FOOTER */}

                        <div className="professor-modal-footer">

                            <button
                                type="button"
                                onClick={
                                    closeMassAssignModal
                                }
                                disabled={
                                    savingMassAssignment ||
                                    loadingMassSubjects
                                }
                            >
                                Cancel
                            </button>


                            <button
                                type="button"
                                onClick={
                                    saveMassAssignment
                                }
                                disabled={
                                    loadingMassSubjects ||
                                    savingMassAssignment ||
                                    selectedProfessorIds.length ===
                                        0 ||
                                    !massAssignSubject
                                }
                            >

                                {
                                    savingMassAssignment
                                        ? `Assigning to ${selectedProfessorIds.length} professors...`
                                        : `Assign Subject to ${selectedProfessorIds.length} Professors`
                                }

                            </button>

                        </div>

                    </div>

                </div>

            )}


            {/* =========================================================
                INDIVIDUAL ASSIGN SUBJECT MODAL
            ========================================================= */}

            {showAssignModal &&
                selectedProfessor && (

                    <div
                        className="professor-modal-overlay"
                        onMouseDown={e => {

                            if (
                                e.target ===
                                    e.currentTarget &&
                                !savingSubjects &&
                                !loadingSubjects
                            ) {

                                closeAssignModal();

                            }

                        }}
                    >

                        <div className="professor-modal">


                            {/* HEADER */}

                            <div className="professor-modal-header">

                                <div>

                                    <h2>
                                        Assign Subjects
                                    </h2>

                                    <p>

                                        {
                                            selectedProfessor.firstname
                                        }{" "}

                                        {
                                            selectedProfessor.lastname
                                        }

                                    </p>

                                </div>


                                <button
                                    className="professor-modal-close"
                                    onClick={
                                        closeAssignModal
                                    }
                                    disabled={
                                        savingSubjects ||
                                        loadingSubjects
                                    }
                                >
                                    ×
                                </button>

                            </div>


                            {/* PROFESSOR INFO */}

                            <div className="professor-info-box">

                                <div>

                                    <span>
                                        Professor ID
                                    </span>

                                    <strong>
                                        {
                                            selectedProfessor.employee_id
                                        }
                                    </strong>

                                </div>


                                <div>

                                    <span>
                                        Department
                                    </span>

                                    <strong>
                                        {
                                            selectedProfessor.department_code ||
                                            "N/A"
                                        }
                                    </strong>

                                </div>


                                <div>

                                    <span>
                                        Program
                                    </span>

                                    <strong>

                                        {
                                            assignmentProgram
                                                ?.program_code ||
                                            "N/A"
                                        }

                                        {" — "}

                                        {
                                            assignmentProgram
                                                ?.program_name ||
                                            ""
                                        }

                                    </strong>

                                </div>


                                <div>

                                    <span>
                                        Assigned Subjects
                                    </span>

                                    <strong>
                                        {
                                            getAssignedSubjectCount(
                                                selectedProfessor
                                            )
                                        }
                                    </strong>

                                </div>

                            </div>


                            {/* SUBJECT HEADER */}

                            <div className="subject-assignment-header">

                                <div>

                                    <h3>
                                        Subjects
                                    </h3>

                                    {loadingSubjects ? (

                                        <p>
                                            Loading subjects...
                                        </p>

                                    ) : (

                                        <p>
                                            {
                                                currentSubjectFilterCount
                                            }{" "}
                                            subject
                                            {
                                                currentSubjectFilterCount !==
                                                1
                                                    ? "s"
                                                    : ""
                                            }{" "}
                                            in this category
                                        </p>

                                    )}

                                </div>


                                <div className="subject-selection-actions">

                                    <button
                                        type="button"
                                        onClick={
                                            selectAllSubjects
                                        }
                                        disabled={
                                            loadingSubjects ||
                                            filteredSubjects.length ===
                                                0 ||
                                            savingSubjects
                                        }
                                        className="subject-select-all-btn"
                                    >
                                        Select All
                                    </button>


                                    <button
                                        type="button"
                                        onClick={
                                            clearAllSubjects
                                        }
                                        disabled={
                                            loadingSubjects ||
                                            filteredSubjects.length ===
                                                0 ||
                                            savingSubjects
                                        }
                                        className="subject-clear-btn"
                                    >
                                        Clear
                                    </button>

                                </div>

                            </div>


                            {/* STATUS FILTER */}

                            <div className="subject-status-filter">

                                <button
                                    type="button"
                                    className={`subject-status-filter-btn no-professor-btn ${
                                        subjectDisplayFilter ===
                                        "no-professor"
                                            ? "active"
                                            : ""
                                    }`}
                                    onClick={() => {

                                        if (
                                            savingSubjects ||
                                            loadingSubjects
                                        ) {
                                            return;
                                        }

                                        setSubjectDisplayFilter(
                                            "no-professor"
                                        );

                                        setSelectedSubjects(
                                            []
                                        );

                                    }}
                                    disabled={
                                        loadingSubjects ||
                                        savingSubjects
                                    }
                                >

                                    <span className="status-filter-dot" />

                                    <span>
                                        No Professor
                                    </span>

                                    <strong>
                                        {
                                            subjectsWithoutProfessor.length
                                        }
                                    </strong>

                                </button>


                                <button
                                    type="button"
                                    className={`subject-status-filter-btn has-professor-btn ${
                                        subjectDisplayFilter ===
                                        "has-professor"
                                            ? "active"
                                            : ""
                                    }`}
                                    onClick={() => {

                                        if (
                                            savingSubjects ||
                                            loadingSubjects
                                        ) {
                                            return;
                                        }

                                        setSubjectDisplayFilter(
                                            "has-professor"
                                        );

                                        setSelectedSubjects(
                                            []
                                        );

                                    }}
                                    disabled={
                                        loadingSubjects ||
                                        savingSubjects
                                    }
                                >

                                    <span className="status-filter-dot" />

                                    <span>
                                        Has Professor
                                    </span>

                                    <strong>
                                        {
                                            subjectsWithProfessor.length
                                        }
                                    </strong>

                                </button>

                            </div>


                            {/* DESCRIPTION */}

                            <div
                                className={`subject-category-description ${
                                    subjectDisplayFilter ===
                                    "no-professor"
                                        ? "no-professor"
                                        : "has-professor"
                                }`}
                            >

                                {subjectDisplayFilter ===
                                "no-professor" ? (

                                    <>
                                        <strong>
                                            Subjects without professor
                                        </strong>

                                        <span>
                                            These subjects currently have no
                                            professor assigned.
                                        </span>
                                    </>

                                ) : (

                                    <>
                                        <strong>
                                            Subjects with professor
                                        </strong>

                                        <span>
                                            These subjects already have at
                                            least one professor assigned.
                                        </span>
                                    </>

                                )}

                            </div>


                            {/* SEARCH */}

                            <input
                                type="text"
                                placeholder="Search subject..."
                                value={
                                    subjectSearch
                                }
                                onChange={
                                    e =>
                                        setSubjectSearch(
                                            e.target.value
                                        )
                                }
                                disabled={
                                    loadingSubjects ||
                                    savingSubjects
                                }
                                className="subject-search-input"
                            />


                            {/* SUBJECT LIST */}

                            <div className="subject-assignment-list">

                                {loadingSubjects ? (

                                    <div className="subject-empty subject-loading-state">

                                        <div>
                                            Loading subjects...
                                        </div>

                                        <small>
                                            Fetching subjects for{" "}
                                            {
                                                assignmentProgram
                                                    ?.program_code
                                            }
                                        </small>

                                    </div>

                                ) : filteredSubjects.length >
                                  0 ? (

                                    filteredSubjects.map(
                                        subject => {

                                            const subjectId =
                                                Number(
                                                    subject.id
                                                );

                                            const checked =
                                                selectedSubjects.some(
                                                    id =>
                                                        Number(
                                                            id
                                                        ) ===
                                                        subjectId
                                                );

                                            const professorCount =
                                                getSubjectProfessorCount(
                                                    subject
                                                );

                                            return (

                                                <label
                                                    key={
                                                        subject.id
                                                    }
                                                    className={`subject-assignment-item ${
                                                        checked
                                                            ? "selected"
                                                            : ""
                                                    }`}
                                                >

                                                    <input
                                                        type="checkbox"
                                                        checked={
                                                            checked
                                                        }
                                                        onChange={() =>
                                                            toggleSubject(
                                                                subject.id
                                                            )
                                                        }
                                                        disabled={
                                                            savingSubjects ||
                                                            loadingSubjects
                                                        }
                                                    />


                                                    <div className="subject-information">

                                                        <strong>
                                                            {
                                                                subject.subject_code ||
                                                                subject.code
                                                            }
                                                        </strong>

                                                        <span>
                                                            {
                                                                subject.subject_name ||
                                                                subject.name
                                                            }
                                                        </span>

                                                    </div>


                                                    <span
                                                        className={`subject-professor-count ${
                                                            professorCount >
                                                            0
                                                                ? "has-professor"
                                                                : "no-professor"
                                                        }`}
                                                    >

                                                        <span className="subject-professor-count-dot" />

                                                        {
                                                            professorCount
                                                        }{" "}
                                                        professor
                                                        {
                                                            professorCount !==
                                                            1
                                                                ? "s"
                                                                : ""
                                                        }

                                                    </span>


                                                    <span className="subject-units">

                                                        {
                                                            subject.units
                                                        }{" "}
                                                        units

                                                    </span>

                                                </label>

                                            );

                                        }
                                    )

                                ) : (

                                    <div className="subject-empty">

                                        {subjectDisplayFilter ===
                                        "no-professor"
                                            ? "No subjects without a professor found."
                                            : "No subjects with a professor found."
                                        }

                                    </div>

                                )}

                            </div>


                            {/* FOOTER */}

                            <div className="professor-modal-footer">

                                <button
                                    type="button"
                                    onClick={
                                        closeAssignModal
                                    }
                                    disabled={
                                        savingSubjects ||
                                        loadingSubjects
                                    }
                                >
                                    Cancel
                                </button>


                                <button
                                    type="button"
                                    onClick={
                                        saveAssignments
                                    }
                                    disabled={
                                        loadingSubjects ||
                                        savingSubjects ||
                                        !selectedProfessor ||
                                        !assignmentProgram ||
                                        selectedSubjects.length ===
                                            0
                                    }
                                >

                                    {
                                        savingSubjects
                                            ? "Assigning..."
                                            : `Assign Subjects (${selectedSubjects.length})`
                                    }

                                </button>

                            </div>

                        </div>

                    </div>

                )}


            {/* =========================================================
                VIEW PROFESSOR MODAL
            ========================================================= */}

            {showViewModal &&
                selectedProfessor && (

                    <div
                        className="professor-modal-overlay"
                        onMouseDown={e => {

                            if (
                                e.target ===
                                e.currentTarget
                            ) {

                                closeViewModal();

                            }

                        }}
                    >

                        <div className="professor-modal">


                            {/* HEADER */}

                            <div className="professor-modal-header">

                                <div>

                                    <h2>
                                        Professor Information
                                    </h2>

                                    <p>

                                        {
                                            selectedProfessor.firstname
                                        }{" "}

                                        {
                                            selectedProfessor.lastname
                                        }

                                    </p>

                                </div>


                                <button
                                    className="professor-modal-close"
                                    onClick={
                                        closeViewModal
                                    }
                                >
                                    ×
                                </button>

                            </div>


                            {/* DETAILS */}

                            <div className="professor-view-details">

                                <div>

                                    <span>
                                        Employee ID
                                    </span>

                                    <strong>
                                        {
                                            selectedProfessor.employee_id
                                        }
                                    </strong>

                                </div>


                                <div>

                                    <span>
                                        Full Name
                                    </span>

                                    <strong>

                                        {
                                            selectedProfessor.firstname
                                        }{" "}

                                        {
                                            selectedProfessor.middlename
                                                ? `${selectedProfessor.middlename} `
                                                : ""
                                        }

                                        {
                                            selectedProfessor.lastname
                                        }

                                    </strong>

                                </div>


                                <div>

                                    <span>
                                        Contact Number
                                    </span>

                                    <strong>
                                        {
                                            selectedProfessor.phone ||
                                            "N/A"
                                        }
                                    </strong>

                                </div>


                                <div>

                                    <span>
                                        Department Code
                                    </span>

                                    <strong>
                                        {
                                            selectedProfessor.department_code ||
                                            "N/A"
                                        }
                                    </strong>

                                </div>


                                <div>

                                    <span>
                                        Department
                                    </span>

                                    <strong>
                                        {
                                            selectedProfessor.department_name ||
                                            "N/A"
                                        }
                                    </strong>

                                </div>


                                <div>

                                    <span>
                                        Department Description
                                    </span>

                                    <strong>
                                        {
                                            selectedProfessor.department_description ||
                                            "N/A"
                                        }
                                    </strong>

                                </div>


                                <div>

                                    <span>
                                        Subject Assignment
                                    </span>

                                    <strong
                                        style={{
                                            color:
                                                getAssignedSubjectCount(
                                                    selectedProfessor
                                                ) > 0
                                                    ? "#16803c"
                                                    : "#dc2626"
                                        }}
                                    >

                                        {
                                            getAssignedSubjectCount(
                                                selectedProfessor
                                            ) > 0
                                                ? `${getAssignedSubjectCount(
                                                    selectedProfessor
                                                )} subject${
                                                    getAssignedSubjectCount(
                                                        selectedProfessor
                                                    ) !==
                                                    1
                                                        ? "s"
                                                        : ""
                                                } assigned`
                                                : "No assignment"
                                        }

                                    </strong>

                                </div>


                                <div>

                                    <span>
                                        Assigned Subjects
                                    </span>

                                    <strong>
                                        {
                                            getAssignedSubjectCount(
                                                selectedProfessor
                                            )
                                        }
                                    </strong>

                                </div>

                            </div>


                            {/* ASSIGNED PROGRAMS */}

                            <div className="professor-view-programs">

                                <div className="professor-view-programs-header">

                                    <div>

                                        <h3>
                                            Assigned Programs
                                        </h3>

                                        <p>

                                            {
                                                Array.isArray(
                                                    selectedProfessor.programs
                                                )
                                                    ? selectedProfessor.programs.length
                                                    : 0
                                            }{" "}
                                            program
                                            {
                                                Array.isArray(
                                                    selectedProfessor.programs
                                                ) &&
                                                selectedProfessor.programs.length !==
                                                    1
                                                    ? "s"
                                                    : ""
                                            }

                                        </p>

                                    </div>

                                </div>


                                {Array.isArray(
                                    selectedProfessor.programs
                                ) &&
                                selectedProfessor.programs.length >
                                    0 ? (

                                    <div className="professor-view-program-list">

                                        {
                                            selectedProfessor.programs.map(
                                                program => (

                                                    <div
                                                        key={
                                                            program.id
                                                        }
                                                        className="professor-view-program-card"
                                                    >

                                                        <div className="professor-view-program-card-header">

                                                            <div>

                                                                <strong>
                                                                    {
                                                                        program.program_code
                                                                    }
                                                                </strong>

                                                                <span>
                                                                    {
                                                                        program.program_name
                                                                    }
                                                                </span>

                                                            </div>


                                                            <span
                                                                className={`professor-program-status ${
                                                                    program.status ===
                                                                    "active"
                                                                        ? "active"
                                                                        : "inactive"
                                                                }`}
                                                            >
                                                                {
                                                                    program.status ||
                                                                    "N/A"
                                                                }
                                                            </span>

                                                        </div>


                                                        {program.description && (

                                                            <p className="professor-view-program-description">
                                                                {
                                                                    program.description
                                                                }
                                                            </p>

                                                        )}

                                                    </div>

                                                )
                                            )
                                        }

                                    </div>

                                ) : (

                                    <div className="professor-view-no-programs">

                                        No programs assigned.

                                    </div>

                                )}

                            </div>


                            {/* FOOTER */}

                            <div className="professor-modal-footer">

                                <button
                                    type="button"
                                    onClick={
                                        closeViewModal
                                    }
                                >
                                    Close
                                </button>

                            </div>

                        </div>

                    </div>

                )}

        </div>

    );

};

export default AllProfessor;
