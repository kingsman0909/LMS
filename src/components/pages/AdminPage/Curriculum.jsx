import { useEffect, useMemo, useState } from "react";
import "./styles/Curriculum.css";
import { API_BASE_URL } from "../../../config";

// =====================================================
// GET PROGRAMS
// =====================================================

const getPrograms = async () => {
    try {
        const token =
            localStorage.getItem("admin_token");

        const response = await fetch(`${API_BASE_URL}/api/auth/getPrograms`,
            {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        const data = await response.json();

        console.log(
            "getting programs",
            data
        );

        if (!response.ok) {
            throw new Error(
                data.message ||
                "Failed to get programs"
            );
        }

        return data.programs || [];

    } catch (error) {
        console.error(
            "Get programs error:",
            error
        );

        throw error;
    }
};


// =====================================================
// GET SUBJECTS
// programId ONLY
// =====================================================

const getSubjectsForCurriculum = async (
    programId
) => {
    try {
        const token =
            localStorage.getItem("admin_token");

        const response = await fetch(`${API_BASE_URL}/api/auth/admin/getSubjectsForCurriculum?programId=${programId}`,
            {
                method: "GET",
                headers: {
                    Authorization:
                        `Bearer ${token}`
                }
            }
        );

        const data =
            await response.json();

        console.log(
            "getting subjects for curriculum",
            data
        );

        if (!response.ok) {
            throw new Error(
                data.message ||
                "Failed to get subjects"
            );
        }

        return data.subjects || [];

    } catch (error) {
        console.error(
            "Get subjects error:",
            error
        );

        throw error;
    }
};


// =====================================================
// GET CURRICULUM
// programId + yearLevel + semester
// =====================================================

const getCurriculum = async (
    programId,
    yearLevel,
    semester
) => {
    try {
        const token =
            localStorage.getItem("admin_token");

        const response = await fetch(`${API_BASE_URL}/api/auth/admin/getCurriculum?programId=${programId}&yearLevel=${yearLevel}&semester=${semester}`,
            {
                method: "GET",
                headers: {
                    Authorization:
                        `Bearer ${token}`
                }
            }
        );

        const data =
            await response.json();

        console.log(
            "getting curriculum",
            data
        );

        if (!response.ok) {
            throw new Error(
                data.message ||
                "Failed to get curriculum"
            );
        }

        return data.curriculum || [];

    } catch (error) {
        console.error(
            "Get curriculum error:",
            error
        );

        throw error;
    }
};


// =====================================================
// CONSTANTS
// =====================================================

const YEARS = [
    {
        value: 1,
        label: "1st Year"
    },
    {
        value: 2,
        label: "2nd Year"
    },
    {
        value: 3,
        label: "3rd Year"
    },
    {
        value: 4,
        label: "4th Year"
    }
];

const SEMESTERS = [
    {
        value: 1,
        label: "1st Semester"
    },
    {
        value: 2,
        label: "2nd Semester"
    }
];


// =====================================================
// COMPONENT
// =====================================================

export default function Curriculum() {

    // =====================================================
    // STATE
    // =====================================================

    const [programs, setPrograms] =
        useState([]);

    const [subjects, setSubjects] =
        useState([]);

    const [curriculum, setCurriculum] =
        useState([]);

    const [loading, setLoading] =
        useState(true);

    const [selectedProgramId, setSelectedProgramId] =
        useState(null);

    const [selectedYear, setSelectedYear] =
        useState(1);

    const [selectedSemester, setSelectedSemester] =
        useState(1);

    const [search, setSearch] =
        useState("");

    const [showAddModal, setShowAddModal] =
        useState(false);

    const [subjectSearch, setSubjectSearch] =
        useState("");

    const [selectedSubjectIds, setSelectedSubjectIds] =
        useState([]);

    const [saving, setSaving] =
        useState(false);


    // =====================================================
    // NORMALIZE SUBJECT
    // =====================================================

    const normalizeSubject = (subject) => {

    const lectureUnits =
        Number(subject.lecture_units ?? 0);

    const labUnits =
        Number(subject.lab_units ?? 0);

    return {

        id:
            Number(
                subject.subject_id ??
                subject.id
            ),

        code:
            subject.subject_code ??
            subject.code ??
            "",

        name:
            subject.subject_name ??
            subject.name ??
            "",

        description:
            subject.description ?? "",

        units:
            Number(
                subject.units ??
                (lectureUnits + labUnits)
            ),

        lectureUnits,

        labUnits,

        programId:
            subject.program_id ??
            subject.programId
    };
};


    // =====================================================
    // NORMALIZE CURRICULUM
    // =====================================================

  const normalizeCurriculum = (curriculumData) => {

    return (curriculumData || []).map(item => {

        const lectureUnits =
            Number(item.lecture_units ?? 0);

        const labUnits =
            Number(item.lab_units ?? 0);

        return {

            id:
                Number(item.id),

            programId:
                item.program_id ??
                item.programId,

            yearLevel:
                item.year_level ??
                item.yearLevel,

            semester:
                item.semester,

            subjectId:
                Number(
                    item.subject_id ??
                    item.subjectId
                ),

            subject: {

                id:
                    Number(
                        item.subject_id ??
                        item.subjectId
                    ),

                code:
                    item.subject_code ??
                    "",

                name:
                    item.subject_name ??
                    "",

                description:
                    item.description ??
                    "",

                lectureUnits,

                labUnits,

                units:
                    Number(
                        item.units ??
                        (lectureUnits + labUnits)
                    )
            }
        };
    });
};

    // =====================================================
    // INITIAL LOAD
    // =====================================================

    useEffect(() => {
        loadPrograms();
    }, []);


    // =====================================================
    // LOAD PROGRAMS
    // =====================================================

    const loadPrograms = async () => {

        try {

            setLoading(true);

            const data =
                await getPrograms();

            setPrograms(data);

            if (data.length > 0) {

                const firstProgram =
                    data[0];

                setSelectedProgramId(
                    firstProgram.id
                );

                await loadProgramData(
                    firstProgram.id,
                    1,
                    1
                );
            }

        } catch (error) {

            console.error(
                "Load programs error:",
                error
            );

        } finally {

            setLoading(false);

        }
    };


    // =====================================================
    // LOAD PROGRAM DATA
    // =====================================================

    const loadProgramData = async (
        programId,
        yearLevel,
        semester
    ) => {

        try {

            console.log(
                "Loading program data:",
                programId,
                yearLevel,
                semester
            );

            // ---------------------------------------------
            // SUBJECTS
            // ---------------------------------------------

            const subjectData =
                await getSubjectsForCurriculum(
                    programId
                );

            setSubjects(
                subjectData.map(
                    normalizeSubject
                )
            );


            // ---------------------------------------------
            // CURRICULUM
            // ---------------------------------------------

            const curriculumData =
                await getCurriculum(
                    programId,
                    yearLevel,
                    semester
                );

            setCurriculum(
                normalizeCurriculum(
                    curriculumData
                )
            );

        } catch (error) {

            console.error(
                "Load program data error:",
                error
            );
        }
    };


    // =====================================================
    // PROGRAM CHANGE
    // =====================================================

    const handleProgramChange = async (
        programId
    ) => {

        setSelectedProgramId(
            programId
        );

        setSelectedYear(1);
        setSelectedSemester(1);

        setSearch("");

        await loadProgramData(
            programId,
            1,
            1
        );
    };


    // =====================================================
    // YEAR CHANGE
    // =====================================================

    const handleYearChange = async (
        year
    ) => {

        setSelectedYear(year);

        setSearch("");

        if (!selectedProgramId) {
            return;
        }

        await loadProgramData(
            selectedProgramId,
            year,
            selectedSemester
        );
    };


    // =====================================================
    // SEMESTER CHANGE
    // =====================================================

    const handleSemesterChange = async (
        semester
    ) => {

        setSelectedSemester(
            semester
        );

        setSearch("");

        if (!selectedProgramId) {
            return;
        }

        await loadProgramData(
            selectedProgramId,
            selectedYear,
            semester
        );
    };


    // =====================================================
    // SELECTED PROGRAM
    // =====================================================

    const selectedProgram =
        programs.find(
            program =>
                Number(program.id) ===
                Number(selectedProgramId)
        );


    // =====================================================
    // CURRENT CURRICULUM
    // =====================================================

    const currentCurriculum = useMemo(() => {

    const value =
        search
            .trim()
            .toLowerCase();

    return curriculum.filter(item => {

        if (!value) {
            return true;
        }

        const subject =
            item.subject;

        return (

            subject.code
                .toLowerCase()
                .includes(value) ||

            subject.name
                .toLowerCase()
                .includes(value) ||

            subject.description
                .toLowerCase()
                .includes(value)

        );
    });

}, [
    curriculum,
    search
]);

    // =====================================================
    // ALREADY ADDED
    // =====================================================

    const alreadyAddedIds =
        useMemo(() => {

            return new Set(
                curriculum.map(
                    item =>
                        Number(
                            item.subjectId
                        )
                )
            );

        }, [curriculum]);


    // =====================================================
    // SUBJECTS AVAILABLE FOR ADDING
    // =====================================================

    const addableSubjects =
        useMemo(() => {

            const value =
                subjectSearch
                    .trim()
                    .toLowerCase();

            return subjects
                .filter(
                    subject =>
                        !alreadyAddedIds.has(
                            Number(subject.id)
                        )
                )
                .filter(subject => {

                    if (!value) {
                        return true;
                    }

                    return (

                        subject.code
                            .toLowerCase()
                            .includes(value) ||

                        subject.name
                            .toLowerCase()
                            .includes(value) ||

                        subject.description
                            ?.toLowerCase()
                            .includes(value)

                    );

                });

        }, [
            subjects,
            alreadyAddedIds,
            subjectSearch
        ]);


    // =====================================================
    // TOTAL UNITS
    // =====================================================

    const totalUnits =
        currentCurriculum.reduce(
            (total, item) =>
                total +
                Number(
                    item.subject.units || 0
                ),
            0
        );


    // =====================================================
    // TOGGLE SUBJECT
    // =====================================================

    const toggleSubject = (
        subjectId
    ) => {

        const id =
            Number(subjectId);

        setSelectedSubjectIds(
            current => {

                if (
                    current.includes(id)
                ) {

                    return current.filter(
                        currentId =>
                            currentId !== id
                    );
                }

                return [
                    ...current,
                    id
                ];
            }
        );
    };


    // =====================================================
    // OPEN MODAL
    // =====================================================

    const openAddModal = () => {

        setSelectedSubjectIds([]);

        setSubjectSearch("");

        setShowAddModal(true);
    };


    // =====================================================
    // CLOSE MODAL
    // =====================================================

    const closeAddModal = () => {

        if (saving) {
            return;
        }

        setShowAddModal(false);
    };


    // =====================================================
    // ADD SUBJECTS
    // =====================================================

    const handleAddSubjects = async () => {

        if (
            selectedSubjectIds.length === 0
        ) {
            return;
        }

        if (!selectedProgramId) {

            alert(
                "Please select a program."
            );

            return;
        }

        try {

            setSaving(true);

            const token =
                localStorage.getItem(
                    "admin_token"
                );

            const response =
                await fetch(`${API_BASE_URL}/api/auth/admin/addCurriculum`,
                    {
                        method: "POST",

                        headers: {
                            Authorization:
                                `Bearer ${token}`,

                            "Content-Type":
                                "application/json"
                        },

                        body:
                            JSON.stringify({

                                programId:
                                    selectedProgramId,

                                yearLevel:
                                    selectedYear,

                                semester:
                                    selectedSemester,

                                subjectIds:
                                    selectedSubjectIds

                            })
                    }
                );

            const data =
                await response.json();

            if (!response.ok) {

                throw new Error(
                    data.message ||
                    "Failed to add subjects"
                );
            }


            // ---------------------------------------------
            // RELOAD CURRENT CURRICULUM
            // ---------------------------------------------

            const curriculumData =
                await getCurriculum(
                    selectedProgramId,
                    selectedYear,
                    selectedSemester
                );

            setCurriculum(
                normalizeCurriculum(
                    curriculumData
                )
            );

            setSelectedSubjectIds([]);

            setShowAddModal(false);

        } catch (error) {

            console.error(
                "Add curriculum error:",
                error
            );

            alert(
                error.message ||
                "Failed to add subjects."
            );

        } finally {

            setSaving(false);
        }
    };


    // =====================================================
    // REMOVE SUBJECT
    // =====================================================

    const handleRemoveSubject = async (
        curriculumId
    ) => {

        const confirmed =
            window.confirm(
                "Remove this subject from the curriculum?"
            );

        if (!confirmed) {
            return;
        }

        try {

            const token =
                localStorage.getItem(
                    "admin_token"
                );

            const response =
                await fetch(`${API_BASE_URL}/api/auth/admin/${curriculumId}/deleteCurriculum`,                    
                        {
                        method: "DELETE",

                        headers: {
                            Authorization:
                                `Bearer ${token}`
                        }
                    }
                );
            
            if (!response.ok) {

                throw new Error(
                    data.message ||
                    "Failed to remove subject"
                );
            }

            if(response.ok){
                alert("Deleted Curriculum Subject Successfully.");
            }

            setCurriculum(
                current =>
                    current.filter(
                        item =>
                            Number(item.id) !==
                            Number(curriculumId)
                    )
            );

        } catch (error) {

            console.error(
                "Remove curriculum error:",
                error
            );

            alert(
                error.message ||
                "Failed to remove subject."
            );
        }
    };


    // =====================================================
    // LOADING
    // =====================================================

    if (loading) {

        return (
            <div className="curriculum-page">

                <div className="curriculum-loading">
                    Loading curriculum...
                </div>

            </div>
        );
    }


    // =====================================================
    // UI
    // =====================================================

    return (

        <div className="curriculum-page">

            {/* HEADER */}

            <div className="curriculum-header">

                <div>

                    <h1>
                        Curriculum
                    </h1>

                    <p>
                        Manage subjects assigned
                        to each academic program
                        and year level.
                    </p>

                </div>

            </div>


            {/* PROGRAM SELECTOR */}

            <div className="program-panel">

                <div className="program-panel-header">

                    <div>

                        <span className="section-label">
                            PROGRAMS
                        </span>

                        <h2>
                            Select Program
                        </h2>

                    </div>

                    <div className="program-count">
                        {programs.length} programs
                    </div>

                </div>


                <div className="program-list">

                    {programs.map(
                        program => (

                            <button
                                key={program.id}

                                type="button"

                                className={`program-card ${
                                    Number(
                                        selectedProgramId
                                    ) ===
                                    Number(
                                        program.id
                                    )
                                        ? "active"
                                        : ""
                                }`}

                                onClick={() =>
                                    handleProgramChange(
                                        program.id
                                    )
                                }
                            >

                                <div className="program-code">
                                    {program.program_code}
                                </div>

                                <div className="program-name">
                                    {program.program_name}
                                </div>

                                {Number(
                                    selectedProgramId
                                ) ===
                                    Number(
                                        program.id
                                    ) && (

                                    <div className="program-active-indicator" />

                                )}

                            </button>

                        )
                    )}

                </div>

            </div>


            {/* WORKSPACE */}

            <div className="curriculum-workspace">

                <div className="workspace-header">

                    <div>

                        <div className="breadcrumb">

                            Curriculum

                            <span>
                                /
                            </span>

                            {selectedProgram?.program_code}

                        </div>

                        <h2>
                            {selectedProgram?.program_code}
                            {" "}
                            Curriculum
                        </h2>

                        <p>
                            {selectedProgram?.program_name}
                        </p>

                    </div>


                    <button
                        type="button"

                        className="add-subject-button"

                        onClick={
                            openAddModal
                        }
                    >

                        <span>
                            +
                        </span>

                        Add Subjects

                    </button>

                </div>


                {/* YEAR TABS */}

                <div className="year-tabs">

                    {YEARS.map(
                        year => (

                            <button
                                key={year.value}

                                type="button"

                                className={
                                    selectedYear ===
                                    year.value
                                        ? "active"
                                        : ""
                                }

                                onClick={() =>
                                    handleYearChange(
                                        year.value
                                    )
                                }
                            >

                                {year.label}

                            </button>

                        )
                    )}

                </div>


                {/* SEMESTER + SEARCH */}

                <div className="filters-row">

                    <div className="semester-tabs">

                        {SEMESTERS.map(
                            semester => (

                                <button
                                    key={
                                        semester.value
                                    }

                                    type="button"

                                    className={
                                        selectedSemester ===
                                        semester.value
                                            ? "active"
                                            : ""
                                    }

                                    onClick={() =>
                                        handleSemesterChange(
                                            semester.value
                                        )
                                    }
                                >

                                    {semester.label}

                                </button>

                            )
                        )}

                    </div>


                    <div className="subject-search">

                        <span>
                            ⌕
                        </span>

                        <input
                            type="text"

                            placeholder="Search subject..."

                            value={search}

                            onChange={event =>
                                setSearch(
                                    event.target.value
                                )
                            }
                        />

                    </div>

                </div>


                {/* SUMMARY */}

                <div className="curriculum-summary">

                    <div>

                        <span>
                            Subjects
                        </span>

                        <strong>
                            {
                                currentCurriculum.length
                            }
                        </strong>

                    </div>


                    <div>

                        <span>
                            Total Units
                        </span>

                        <strong>
                            {totalUnits}
                        </strong>

                    </div>


                    <div>

                        <span>
                            Year Level
                        </span>

                        <strong>
                            {
                                YEARS.find(
                                    year =>
                                        year.value ===
                                        selectedYear
                                )?.label
                            }
                        </strong>

                    </div>


                    <div>

                        <span>
                            Semester
                        </span>

                        <strong>
                            {
                                SEMESTERS.find(
                                    semester =>
                                        semester.value ===
                                        selectedSemester
                                )?.label
                            }
                        </strong>

                    </div>

                </div>


                {/* SUBJECT TABLE */}

                <div className="subjects-card">

                    <div className="subjects-card-header">

                        <div>

                            <span className="section-label">
                                CURRICULUM SUBJECTS
                            </span>

                            <h3>

                                {
                                    YEARS.find(
                                        year =>
                                            year.value ===
                                            selectedYear
                                    )?.label
                                }

                                <span>
                                    {" · "}
                                    {
                                        SEMESTERS.find(
                                            semester =>
                                                semester.value ===
                                                selectedSemester
                                        )?.label
                                    }
                                </span>

                            </h3>

                        </div>

                    </div>


                    {currentCurriculum.length ===
                    0 ? (

                        <div className="empty-state">

                            <div className="empty-icon">
                                +
                            </div>

                            <h3>
                                No subjects added yet
                            </h3>

                            <p>
                                Add subjects to this
                                curriculum for the
                                selected year and
                                semester.
                            </p>

                            <button
                                type="button"
                                onClick={
                                    openAddModal
                                }
                            >
                                Add Subjects
                            </button>

                        </div>

                    ) : (

                        <div className="subject-table">

                            <div className="table-header">

                                <span>
                                    SUBJECT
                                </span>

                                <span>
                                    SUBJECT CODE
                                </span>

                                <span>
                                    DESCRIPTION
                                </span>

                                <span>
                                    UNITS
                                </span>

                                <span>
                                    ACTION
                                </span>

                            </div>


                            {currentCurriculum.map(
                                (item, index) => (

                                    <div
                                        className="subject-row"
                                        key={
                                            item.id
                                        }
                                    >

                                        <div className="subject-number">

                                            {String(
                                                index + 1
                                            ).padStart(
                                                2,
                                                "0"
                                            )}

                                        </div>


                                        <div className="subject-info">

                                            <strong>
                                                {
                                                    item.subject.code
                                                }
                                            </strong>

                                            <span>
                                                {
                                                    item
                                                        .subject
                                                        .name
                                                }
                                            </span>

                                        </div>


                                        <div className="subject-description">

                                            {
                                                item
                                                    .subject
                                                    .description ||
                                                item
                                                    .subject
                                                    .name
                                            }

                                        </div>


                                        <div className="units">

                                            {
                                                item
                                                    .subject
                                                    .units
                                            }

                                        </div>


                                        <button
                                            type="button"

                                            className="remove-button"

                                            title="Remove from curriculum"

                                            onClick={() =>
                                                handleRemoveSubject(
                                                    item.id
                                                )
                                            }
                                        >

                                            ×

                                        </button>

                                    </div>
                                )
                            )}

                        </div>

                    )}

                </div>

            </div>


            {/* ADD MODAL */}

            {showAddModal && (

                <div
                    className="modal-backdrop"

                    onMouseDown={
                        closeAddModal
                    }
                >

                    <div
                        className="add-subject-modal"

                        onMouseDown={event =>
                            event.stopPropagation()
                        }
                    >

                        <div className="modal-header">

                            <div>

                                <span className="section-label">
                                    ADD TO CURRICULUM
                                </span>

                                <h2>
                                    Add Subjects
                                </h2>

                                <p>

                                    {selectedProgram?.program_code}

                                    {" · "}

                                    {
                                        YEARS.find(
                                            year =>
                                                year.value ===
                                                selectedYear
                                        )?.label
                                    }

                                    {" · "}

                                    {
                                        SEMESTERS.find(
                                            semester =>
                                                semester.value ===
                                                selectedSemester
                                        )?.label
                                    }

                                </p>

                            </div>


                            <button
                                type="button"

                                className="modal-close"

                                onClick={
                                    closeAddModal
                                }

                                disabled={
                                    saving
                                }
                            >

                                ×

                            </button>

                        </div>


                        <div className="modal-toolbar">

                            <div className="modal-search">

                                <span>
                                    ⌕
                                </span>

                                <input
                                    type="text"

                                    placeholder="Search available subjects..."

                                    value={
                                        subjectSearch
                                    }

                                    onChange={event =>
                                        setSubjectSearch(
                                            event.target.value
                                        )
                                    }

                                />

                            </div>


                            <span className="available-count">

                                {
                                    addableSubjects.length
                                }

                                {" "}
                                available

                            </span>

                        </div>


                        <div className="available-subjects">

                            {addableSubjects.length ===
                            0 ? (

                                <div className="modal-empty">

                                    <strong>
                                        No available subjects
                                    </strong>

                                    <span>

                                        There are no
                                        available subjects
                                        for{" "}

                                        <strong>
                                            {
                                                selectedProgram?.program_code
                                            }
                                        </strong>

                                        {" "}
                                        or all subjects
                                        are already added
                                        to this curriculum.

                                    </span>

                                </div>

                            ) : (

                                addableSubjects.map(
                                    subject => {

                                        const selected =
                                            selectedSubjectIds.includes(
                                                Number(
                                                    subject.id
                                                )
                                            );

                                        return (

                                            <button
                                                type="button"

                                                key={
                                                    subject.id
                                                }

                                                className={`available-subject ${
                                                    selected
                                                        ? "selected"
                                                        : ""
                                                }`}

                                                onClick={() =>
                                                    toggleSubject(
                                                        subject.id
                                                    )
                                                }
                                            >

                                                <div
                                                    className={`subject-checkbox ${
                                                        selected
                                                            ? "checked"
                                                            : ""
                                                    }`}
                                                >

                                                    {
                                                        selected
                                                            ? "✓"
                                                            : ""
                                                    }

                                                </div>


                                                <div className="available-subject-info">

                                                    <strong>
                                                        {
                                                            subject.code
                                                        }
                                                    </strong>

                                                    <span>
                                                        {
                                                            subject.name
                                                        }
                                                    </span>

                                                </div>


                                                <div className="available-units">

                                                    {
                                                        subject.units
                                                    }

                                                    {" "}
                                                    units

                                                </div>

                                            </button>

                                        );

                                    }
                                )

                            )}

                        </div>


                        <div className="modal-footer">

                            <div>

                                {selectedSubjectIds.length >
                                    0 && (

                                    <strong>

                                        {
                                            selectedSubjectIds.length
                                        }

                                        {" "}
                                        subject
                                        {
                                            selectedSubjectIds.length !==
                                            1
                                                ? "s"
                                                : ""
                                        }

                                        {" "}
                                        selected

                                    </strong>

                                )}

                            </div>


                            <div className="modal-actions">

                                <button
                                    type="button"

                                    className="cancel-button"

                                    onClick={
                                        closeAddModal
                                    }

                                    disabled={
                                        saving
                                    }
                                >

                                    Cancel

                                </button>


                                <button
                                    type="button"

                                    className="save-button"

                                    disabled={
                                        saving ||
                                        selectedSubjectIds.length ===
                                            0
                                    }

                                    onClick={
                                        handleAddSubjects
                                    }
                                >

                                    {saving
                                        ? "Adding..."
                                        : `Add ${
                                              selectedSubjectIds.length ||
                                              ""
                                          } Subject${
                                              selectedSubjectIds.length !==
                                              1
                                                  ? "s"
                                                  : ""
                                          }`}

                                </button>

                            </div>

                        </div>

                    </div>

                </div>

            )}

        </div>
    );
}