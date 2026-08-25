import React, { useEffect, useState } from "react";
import "./styles/Schedule.css";
import { API_BASE_URL } from "../../../config";
import Loading from "../LoadingComponent/Loading";

const AdminSchedule = () => {

    // =========================
    // BASIC STATES
    // =========================

    const [search, setSearch] = useState("");
    const [yearFilter, setYearFilter] = useState("all");

    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [selectedSection, setSelectedSection] = useState(null);

    const [term, setTerm] = useState(null);
    const [programs, setPrograms] = useState([]);
    const [schedules, setSchedules] = useState([]);
    const [sections, setSections] = useState([]);
    const [students, setStudents] = useState([]);
    const [totalStudents, setTotalStudents] = useState(0);

    // =========================
    // CAPACITY STATES
    // =========================

    const [capacityLoading, setCapacityLoading] = useState(false);
    const [capacityData, setCapacityData] = useState(null);
    const [showCapacityModal, setShowCapacityModal] = useState(false);

    // =========================
    // GENERATE MODAL
    // =========================

    const [showGenerateModal, setShowGenerateModal] = useState(false);
    const [generateLoading, setGenerateLoading] = useState(false);

    const [loadText, setLoadText] = useState("");

    const [selectedProgram, setSelectedProgram] = useState("");

    const [selectedAcademicTerm, setSelectedAcademicTerm] = useState("");


    // =========================
    // FETCH CURRENT ACADEMIC TERM
    // =========================

    const fetchTerm = async () => {

        try {

            const token =
                localStorage.getItem("admin_token");

            const response = await fetch(`${API_BASE_URL}/api/auth/getAcademicTerm`,
                {
                    method: "GET",
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            const data = await response.json();

            console.log(
                "Academic Term:",
                data
            );

            if (!response.ok) {
                throw new Error(
                    data.message ||
                    "Failed to fetch academic term."
                );
            }

            setTerm(data.term);

        } catch (error) {

            console.error(
                "Failed to fetch academic term:",
                error
            );

        }
    };


    // =========================
    // FETCH TOTAL STUDENTS
    // =========================

    const fetchTotalStudents = async () => {

        try {

            const token =
                localStorage.getItem("admin_token");

            const response = await fetch(`${API_BASE_URL}/api/auth/admin/getTotalStudents`,
                {
                    method: "GET",
                    credentials: "include",
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            if (!response.ok) {

                const data = await response.json().catch(() => ({}));

                throw new Error(
                    data.message ||
                    "Failed to fetch total students"
                );
            }

            const data = await response.json();

            console.log(
                "Total students:",
                data
            );

            setTotalStudents(
                Number(data.totalStudents) || 0
            );

        } catch (error) {

            console.error(
                "Error fetching total students:",
                error
            );

        }
    };


    // =========================
    // CHECK UNIVERSITY CAPACITY
    // =========================

    const handleCheckCapacity = async () => {

        if (!term?.id) {

            alert(
                "Academic term is not available yet."
            );

            return;
        }

        try {

            setCapacityLoading(true);

            const token =
                localStorage.getItem("admin_token");

            const response = await fetch(`${API_BASE_URL}/api/auth/admin/checkUniversityCapacity?academicTermId=${term.id}`,
                {
                    method: "GET",

                    headers: {
                        Authorization:
                            `Bearer ${token}`
                    }
                }
            );

            const data = await response.json();

            console.log(
                "Capacity checker response:",
                data
            );

            if (!response.ok) {

                throw new Error(
                    data.message ||
                    "Failed to check capacity."
                );
            }

            /*
             * NEW API STRUCTURE
             *
             * data.data:
             *
             * {
             *   academicTermId,
             *   checkedPrograms,
             *   failed,
             *   failedPrograms,
             *   globalAllocation,
             *   globalProfessorSummary,
             *   globalSubjectBottlenecks,
             *   message,
             *   passed,
             *   passedPrograms,
             *   professorSummary,
             *   programProfessorCapacity
             * }
             */

            setCapacityData(
                data.data || null
            );

            setShowCapacityModal(true);

        } catch (error) {

            console.error(
                "Capacity check error:",
                error
            );

            alert(
                error.message ||
                "Failed to check professor capacity."
            );

        } finally {

            setCapacityLoading(false);
        }
    };


    // =========================
    // GET PROGRAMS WITH SECTIONS
    // =========================

    const getPrograms = async () => {

        if (!term?.id) return;

        try {

            const token =
                localStorage.getItem("admin_token");

            const response = await fetch(`${API_BASE_URL}/api/auth/admin/getProgramsWithSections?academicTermId=${term.id}`,
                {
                    method: "GET",
                    headers: {
                        Authorization:
                            `Bearer ${token}`
                    }
                }
            );

            const data = await response.json();

            console.log(
                "Programs:",
                data
            );

            if (!response.ok) {

                throw new Error(
                    data.message ||
                    "Failed to fetch programs."
                );
            }

            setPrograms(
                data.programs || []
            );

        } catch (error) {

            console.error(
                "Failed to fetch programs:",
                error
            );
        }
    };


    // =========================
    // GET SECTIONS
    // =========================

    const getSections = async () => {

        if (!term?.id) return;

        try {

            const token =
                localStorage.getItem("admin_token");

            const response = await fetch(`${API_BASE_URL}/api/auth/admin/getScheduleSections?academicTermId=${term.id}`,
                {
                    method: "GET",
                    headers: {
                        Authorization:
                            `Bearer ${token}`
                    }
                }
            );

            const data = await response.json();

            console.log(
                "Schedule Sections:",
                data
            );

            if (!response.ok) {

                throw new Error(
                    data.message ||
                    "Failed to fetch sections."
                );
            }

            setSections(
                data.sections || []
            );

        } catch (error) {

            console.error(
                "Failed to fetch sections:",
                error
            );
        }
    };


    // =========================
    // GET SCHEDULES
    // =========================

    const getSchedules = async () => {

        if (!term?.id) return;

        try {

            const token =
                localStorage.getItem("admin_token");

            const response = await fetch(`${API_BASE_URL}/api/auth/admin/getSchedules?academicTermId=${term.id}`,
                {
                    method: "GET",
                    headers: {
                        Authorization:
                            `Bearer ${token}`
                    }
                }
            );

            const data = await response.json();

            console.log(
                "Schedules:",
                data
            );

            if (!response.ok) {

                throw new Error(
                    data.message ||
                    "Failed to fetch schedules."
                );
            }

            setSchedules(
                data.schedules || []
            );

        } catch (error) {

            console.error(
                "Failed to fetch schedules:",
                error
            );
        }
    };


    // =========================
    // GET STUDENTS
    // =========================

    const fetchStudents = async () => {

        try {

            const token =
                localStorage.getItem("admin_token");

            const response = await fetch(`${API_BASE_URL}/api/auth/admin/getStudents`,
                {
                    method: "GET",
                    headers: {
                        Authorization:
                            `Bearer ${token}`
                    }
                }
            );

            const data = await response.json();

            if (response.ok) {

                setStudents(
                    data.students || []
                );
            }

        } catch (error) {

            console.error(
                "Failed to fetch students:",
                error
            );
        }
    };


    // =========================
    // INITIAL FETCH
    // =========================

    useEffect(() => {

        fetchTerm();
        fetchStudents();
        fetchTotalStudents();

    }, []);


    // =========================
    // FETCH AFTER TERM READY
    // =========================

    useEffect(() => {

        if (!term?.id) return;

        getPrograms();
        getSections();
        getSchedules();

    }, [term]);


    // =========================
    // FILTER SECTIONS
    // =========================

    const filteredSections =
        sections.filter(section => {

            const sectionText =
                `${section.program || ""} ${section.year || ""}-${section.section || ""}`;

            const matchesSearch =
                sectionText
                    .toLowerCase()
                    .includes(
                        search.toLowerCase()
                    );

            const matchesYear =
                yearFilter === "all" ||
                String(section.year) ===
                    yearFilter;

            return (
                matchesSearch &&
                matchesYear
            );
        });


    // =========================
    // STATISTICS
    // =========================

    const scheduledCount =
        sections.filter(
            section =>
                section.status ===
                "Scheduled"
        ).length;


    const pendingCount =
        sections.filter(
            section =>
                section.status ===
                "Pending"
        ).length;


    // =====================================================
    // NEW PROGRAM CAPACITY DATA
    // =====================================================

    const programProfessorCapacity =
        Array.isArray(
            capacityData?.programProfessorCapacity
        )
            ? capacityData.programProfessorCapacity
            : [];


    // =========================
    // CAPACITY PROGRAM COUNTS
    // =========================

    const capacitySufficientPrograms =
        programProfessorCapacity.filter(
            program =>
                String(program.status).toUpperCase() ===
                "SUFFICIENT"
        );


    const capacityInsufficientPrograms =
        programProfessorCapacity.filter(
            program =>
                String(program.status).toUpperCase() !==
                    "SUFFICIENT" &&
                program.sectionCount > 0
        );


    const capacitySkippedPrograms =
        programProfessorCapacity.filter(
            program =>
                Number(program.sectionCount) === 0
        );


    // =========================
    // GET PROGRAM STATUS
    // =========================

    const getProgramCapacityStatus =
        (program) => {

            const status =
                String(
                    program?.status || ""
                ).toUpperCase();


            if (
                Number(program?.sectionCount) === 0
            ) {

                return "SKIPPED";
            }


            if (
                status === "SUFFICIENT" ||
                program?.allocationFeasible === true
            ) {

                return "SUFFICIENT";
            }


            return "INSUFFICIENT";
        };


    // =========================
    // GET PROGRAM STATUS CLASS
    // =========================

    const getProgramCapacityClass =
        (program) => {

            const status =
                getProgramCapacityStatus(
                    program
                );

            if (status === "SKIPPED") {
                return "capacity-skipped";
            }

            if (status === "SUFFICIENT") {
                return "capacity-sufficient";
            }

            return "capacity-insufficient";
        };


    // =========================
    // GENERATE SCHEDULE
    // =========================

    const handleGenerateSchedule =
        async () => {

            if (
                !selectedProgram ||
                !selectedAcademicTerm
            ) {

                alert(
                    "Please select a program and academic term."
                );

                return;
            }

            setLoadText("Schedule")
            setGenerateLoading(true);
            setShowGenerateModal(false);

            try {

                const token =
                    localStorage.getItem(
                        "admin_token"
                    );

                console.log(
                    "Generating schedule:",
                    {
                        programId:
                            selectedProgram,

                        academicTermId:
                            selectedAcademicTerm
                    }
                );

                const response =
                    await fetch(`${API_BASE_URL}/api/auth/admin/schedule/generate`,
                        {
                            method: "POST",

                            headers: {
                                "Content-Type":
                                    "application/json",

                                Authorization:
                                    `Bearer ${token}`
                            },

                            body: JSON.stringify({

                                programId:
                                    Number(
                                        selectedProgram
                                    ),

                                academicTermId:
                                    Number(
                                        selectedAcademicTerm
                                    )

                            })
                        }
                    );                
                    
                    
                
                
                setGenerateLoading(false);


                

                const data =
                    await response.json();

                console.log(
                    "Generate Schedule Response:",
                    data
                );

                if (!response.ok) {

                    throw new Error(
                        data.message ||
                        "Failed to generate schedule."
                    );
                }

                alert(
                    data.message ||
                    "Schedule generated successfully."
                );

                
                await getSections();
                await getSchedules();

            } catch (error) {

                console.error(
                    "Generate schedule error:",
                    error
                );

                alert(
                    error.message ||
                    "Something went wrong while generating schedule."
                );
            }
        };



    // =========================
    // VIEW SECTION SCHEDULE
    // =========================

    const viewSchedule = (section) => {

        const sectionSchedules =
            schedules.filter(
                schedule =>
                    Number(schedule.section_id) ===
                    Number(section.id)
            );

        console.log(
            "Section:",
            section
        );

        console.log(
            "Section schedules:",
            sectionSchedules
        );

        if (
            sectionSchedules.length === 0
        ) {

            alert(
                `No schedule found for ${section.program} ${section.year}-${section.section}`
            );

            return;
        }

        setSelectedSection({
            ...section,
            schedules:
                sectionSchedules
        });

        setShowScheduleModal(true);
    };


    const closeScheduleModal = () => {

        setShowScheduleModal(false);

        setSelectedSection(null);
    };


    // =========================
    // CLOSE CAPACITY MODAL
    // =========================

    const closeCapacityModal = () => {

        setShowCapacityModal(false);
    };


    // =========================
    // YEAR LABEL
    // =========================

    const getYearLabel =
        (year) => {

            switch (
                Number(year)
            ) {

                case 1:
                    return "1st Year";

                case 2:
                    return "2nd Year";

                case 3:
                    return "3rd Year";

                case 4:
                    return "4th Year";

                default:
                    return `${year} Year`;
            }
        };


    // =====================================================
    // RENDER
    // =====================================================

    return (
        <>
        {generateLoading && 
            <Loading text={loadText} setGenerateLoading = {setGenerateLoading}/>
        }
        <div className="schedule-page">

            {/* ================= HEADER ================= */}

            <div className="schedule-header">

                <div>

                    <h1>
                        Schedule Management
                    </h1>

                    <p>
                        Manage and generate class schedules
                        for the academic term.
                    </p>

                </div>


                <div className="schedule-actions">

                    <button
                        className="capacity-btn"
                        onClick={
                            handleCheckCapacity
                        }
                        disabled={
                            capacityLoading
                        }
                    >

                        {capacityLoading
                            ? "Checking..."
                            : "Check Capacity"
                        }

                    </button>


                    <button
                        className="generate-btn"
                        onClick={() =>
                            setShowGenerateModal(
                                true
                            )
                        }
                    >
                        Generate Schedule
                    </button>

                </div>

            </div>


            {/* ================= STATISTICS ================= */}

            <div className="schedule-stats">

                <div className="stat-card">

                    <div className="stat-label">
                        Total Sections
                    </div>

                    <div className="stat-value">
                        {sections.length}
                    </div>

                </div>


                <div className="stat-card">

                    <div className="stat-label">
                        Total Students
                    </div>

                    <div className="stat-value">
                        {totalStudents}
                    </div>

                </div>


                <div className="stat-card">

                    <div className="stat-label">
                        Scheduled
                    </div>

                    <div className="stat-value scheduled-number">
                        {scheduledCount}
                    </div>

                </div>


                <div className="stat-card">

                    <div className="stat-label">
                        Pending
                    </div>

                    <div className="stat-value pending-number">
                        {pendingCount}
                    </div>

                </div>

            </div>


            {/* ================= SECTIONS ================= */}

            <div className="section-container">

                <div className="a-section-header">

                    <div>

                        <h2>
                            Sections
                        </h2>

                        <p>
                            View the scheduling status
                            of each section.
                        </p>

                    </div>


                    <div className="section-filters">

                        <input
                            type="text"
                            placeholder="Search section..."
                            value={search}
                            onChange={(e) =>
                                setSearch(
                                    e.target.value
                                )
                            }
                        />


                        <select
                            value={yearFilter}
                            onChange={(e) =>
                                setYearFilter(
                                    e.target.value
                                )
                            }
                        >

                            <option value="all">
                                All Years
                            </option>

                            <option value="1">
                                1st Year
                            </option>

                            <option value="2">
                                2nd Year
                            </option>

                            <option value="3">
                                3rd Year
                            </option>

                            <option value="4">
                                4th Year
                            </option>

                        </select>

                    </div>

                </div>


                {/* ================= TABLE ================= */}

                <div className="table-wrapper">

                    <table>

                        <thead>

                            <tr>

                                <th>
                                    Section
                                </th>

                                <th>
                                    Year Level
                                </th>

                                <th>
                                    Students
                                </th>

                                <th>
                                    Classes
                                </th>

                                <th>
                                    Status
                                </th>

                                <th>
                                    Action
                                </th>

                            </tr>

                        </thead>


                        <tbody>

                            {filteredSections.length > 0 ? (

                                filteredSections.map(
                                    section => (

                                        <tr
                                            key={
                                                section.id
                                            }
                                        >

                                            <td>

                                                <div className="section-name">

                                                    <strong>
                                                        {
                                                            section.program
                                                        }
                                                    </strong>

                                                    <span>
                                                        {
                                                            section.year
                                                        }
                                                        -
                                                        {
                                                            section.section
                                                        }
                                                    </span>

                                                </div>

                                            </td>


                                            <td>
                                                {
                                                    getYearLabel(
                                                        section.year
                                                    )
                                                }
                                            </td>


                                            <td>

                                                <div className="student-count">

                                                    <span>
                                                        {
                                                            section.students ||
                                                            0
                                                        }
                                                    </span>

                                                    <small>
                                                        /
                                                        {
                                                            section.maxStudents
                                                        }
                                                    </small>

                                                </div>

                                            </td>


                                            <td>
                                                {
                                                    section.classes ||
                                                    0
                                                }
                                            </td>


                                            <td>

                                                <span
                                                    className={
                                                        section.status ===
                                                        "Scheduled"
                                                            ? "status scheduled"
                                                            : "status pending"
                                                    }
                                                >

                                                    <span className="status-dot">
                                                    </span>

                                                    {
                                                        section.status ||
                                                        "Pending"
                                                    }

                                                </span>

                                            </td>


                                            <td>

                                                <button
                                                    className="view-btn"
                                                    onClick={() =>
                                                        viewSchedule(
                                                            section
                                                        )
                                                    }
                                                >
                                                    View Schedule
                                                </button>

                                            </td>

                                        </tr>

                                    )
                                )

                            ) : (

                                <tr>

                                    <td
                                        colSpan="6"
                                        className="empty-state"
                                    >
                                        No sections found.
                                    </td>

                                </tr>

                            )}

                        </tbody>

                    </table>

                </div>

            </div>


            {/* =====================================================
                PROFESSOR CAPACITY MODAL
            ===================================================== */}

            {showCapacityModal && capacityData && (

                <div
                    className="capacity-modal-overlay"
                    onClick={closeCapacityModal}
                >

                    <div
                        className="capacity-modal"
                        onClick={(e) =>
                            e.stopPropagation()
                        }
                    >

                        {/* ================= HEADER ================= */}

                        <div className="capacity-modal-header">

                            <div>

                                <div className="capacity-modal-title-row">

                                    <div className="capacity-title-icon">
                                        ✓
                                    </div>

                                    <div>

                                        <h2>
                                            Professor Capacity
                                        </h2>

                                        <p>
                                            {
                                                capacityData
                                                    .globalProfessorSummary
                                                    ?.semester ||
                                                capacityData
                                                    .professorSummary
                                                    ?.semester ||
                                                "Current Semester"
                                            }{" "}
                                            Professor Availability
                                        </p>

                                    </div>

                                </div>

                            </div>


                            <button
                                className="capacity-modal-close"
                                onClick={
                                    closeCapacityModal
                                }
                            >
                                ×
                            </button>

                        </div>


                        {/* ================= SUMMARY ================= */}

                        <div className="capacity-summary">

                            <div className="capacity-summary-card">

                                <span>
                                    Programs Checked
                                </span>

                                <strong>
                                    {
                                        capacityData.checkedPrograms ??
                                        programProfessorCapacity.filter(
                                            program =>
                                                Number(
                                                    program.sectionCount
                                                ) > 0
                                        ).length
                                    }
                                </strong>

                            </div>


                            <div className="capacity-summary-card sufficient">

                                <span>
                                    Sufficient
                                </span>

                                <strong>
                                    {
                                        capacitySufficientPrograms.length
                                    }
                                </strong>

                            </div>


                            <div className="capacity-summary-card insufficient">

                                <span>
                                    Insufficient
                                </span>

                                <strong>
                                    {
                                        capacityInsufficientPrograms.length
                                    }
                                </strong>

                            </div>

                        </div>


                        {/* =====================================================
                            PROGRAM LIST
                        ===================================================== */}

                        <div className="capacity-modal-body">

                            <div className="capacity-section-title">

                                <h3>
                                    Program Professor Capacity
                                </h3>

                                <span>
                                    {
                                        capacityData
                                            .globalProfessorSummary
                                            ?.semester ||
                                        capacityData
                                            .professorSummary
                                            ?.semester
                                    }
                                </span>

                            </div>


                            <div className="capacity-program-list">

                                {programProfessorCapacity.length > 0 ? (

                                    programProfessorCapacity.map(
                                        (program) => {

                                            const status =
                                                getProgramCapacityStatus(
                                                    program
                                                );

                                            const isSufficient =
                                                status ===
                                                "SUFFICIENT";

                                            const isSkipped =
                                                status ===
                                                "SKIPPED";

                                            const shortage =
                                                Number(
                                                    program.professorShortage
                                                ) || 0;

                                            const requiredHours =
                                                Number(
                                                    program.requiredTeachingHours
                                                ) || 0;

                                            const allocatedHours =
                                                Number(
                                                    program.allocatableQualifiedCapacity
                                                ) || 0;

                                            const professorsNeeded =
                                                Number(
                                                    program.professorsNeeded
                                                ) || 0;

                                            const professorsUsed =
                                                Number(
                                                    program.professorsUsed
                                                ) || 0;

                                            const qualifiedProfessors =
                                                Number(
                                                    program.qualifiedProfessors
                                                ) || 0;


                                            return (

                                                <div
                                                    className={
                                                        `capacity-program-card ${
                                                            getProgramCapacityClass(
                                                                program
                                                            )
                                                        }`
                                                    }
                                                    key={
                                                        program.programId
                                                    }
                                                >

                                                    {/* ================= PROGRAM INFO ================= */}

                                                    <div className="capacity-program-info">

                                                        <div className="capacity-status-icon">

                                                            {isSkipped
                                                                ? "–"
                                                                : isSufficient
                                                                    ? "✓"
                                                                    : "!"
                                                            }

                                                        </div>


                                                        <div>

                                                            <h4>
                                                                {
                                                                    program.programCode ||
                                                                    program.code ||
                                                                    `Program ${program.programId}`
                                                                }
                                                            </h4>

                                                            <p>
                                                                {
                                                                    program.programName
                                                                }
                                                            </p>

                                                        </div>

                                                    </div>


                                                    {/* ================= RESULT ================= */}

                                                    <div className="capacity-program-result">

                                                        {isSkipped ? (

                                                            <>

                                                                <span className="capacity-status-text skipped">
                                                                    No Sections
                                                                </span>

                                                                <strong>
                                                                    0
                                                                </strong>

                                                                <small>
                                                                    Sections
                                                                </small>

                                                            </>

                                                        ) : isSufficient ? (

                                                            <>

                                                                <span className="capacity-status-text sufficient">
                                                                    Sufficient
                                                                </span>

                                                                <strong>
                                                                    {
                                                                        professorsUsed
                                                                    }
                                                                    /
                                                                    {
                                                                        qualifiedProfessors
                                                                    }
                                                                </strong>

                                                                <small>
                                                                    Professors
                                                                </small>

                                                            </>

                                                        ) : (

                                                            <>

                                                                <span className="capacity-status-text insufficient">
                                                                    Insufficient
                                                                </span>

                                                                <strong>
                                                                    {
                                                                        shortage
                                                                    }
                                                                </strong>

                                                                <small>
                                                                    Professor
                                                                    {
                                                                        shortage === 1
                                                                            ? ""
                                                                            : "s"
                                                                    }
                                                                    {" "}needed
                                                                </small>

                                                            </>

                                                        )}

                                                    </div>


                                                    {/* ================= EXTRA PROGRAM DETAILS ================= */}

                                                    <div className="capacity-program-details">

                                                        <div>

                                                            <span>
                                                                Sections: <strong>
                                                                {
                                                                    program.sectionCount ??
                                                                    0
                                                                }
                                                            </strong>
                                                            </span>

                                                            

                                                        </div>


                                                        <div>

                                                            <span>
                                                                Required Hours: <strong>{requiredHours.toLocaleString()}</strong>
                                                            </span>

                                                        

                                                        </div>


                                                        <div>

                                                            <span>
                                                                Qualified: <strong>{qualifiedProfessors}</strong>
                                                            </span>

                                                        </div>


                                                        <div>

                                                            <span>
                                                                Capacity: <strong>{allocatedHours.toLocaleString()}</strong>
                                                            </span>
                                                        </div>

                                                    </div>

                                                </div>

                                            );

                                        }
                                    )

                                ) : (

                                    <div className="capacity-empty">

                                        No program professor capacity
                                        results found.

                                    </div>

                                )}

                            </div>


                            {/* =====================================================
                                PROGRAM PROFESSOR SUMMARY
                            ===================================================== */}

                            {capacityData.professorSummary && (

                                <div className="global-capacity-box">

                                    <div>

                                        <span>
                                            Required Professor Hours
                                        </span>

                                        <strong>
                                            {
                                                Number(
                                                    capacityData
                                                        .professorSummary
                                                        .totalRequiredProfessorHours
                                                ).toLocaleString()
                                            }
                                        </strong>

                                    </div>


                                    <div>

                                        <span>
                                            Program Professor Requirement
                                        </span>

                                        <strong>
                                            {
                                                Number(
                                                    capacityData
                                                        .professorSummary
                                                        .totalProgramProfessorRequirement
                                                ).toLocaleString()
                                            }
                                        </strong>

                                    </div>


                                    <div>

                                        <span>
                                            Program Professor Shortage
                                        </span>

                                        <strong className="global-shortage">
                                            {
                                                Number(
                                                    capacityData
                                                        .professorSummary
                                                        .totalProgramProfessorShortage
                                                ).toLocaleString()
                                            }
                                        </strong>

                                    </div>


                                    <div>

                                        <span>
                                            Checked Programs
                                        </span>

                                        <strong>
                                            {
                                                capacityData.checkedPrograms ??
                                                0
                                            }
                                        </strong>

                                    </div>

                                </div>

                            )}


                            {/* =====================================================
                                GLOBAL ALLOCATION
                            ===================================================== */}

                            {capacityData.globalAllocation && (

                                <div className="global-capacity-box">

                                    <div>

                                        <span>
                                            Required Hours
                                        </span>

                                        <strong>
                                            {
                                                Number(
                                                    capacityData
                                                        .globalAllocation
                                                        .requiredHours
                                                ).toLocaleString()
                                            }
                                        </strong>

                                    </div>


                                    <div>

                                        <span>
                                            Allocated Hours
                                        </span>

                                        <strong>
                                            {
                                                Number(
                                                    capacityData
                                                        .globalAllocation
                                                        .allocatedHours
                                                ).toLocaleString()
                                            }
                                        </strong>

                                    </div>


                                    <div>

                                        <span>
                                            Professors Used
                                        </span>

                                        <strong>
                                            {
                                                capacityData
                                                    .globalAllocation
                                                    .professorsUsed ??
                                                0
                                            }
                                        </strong>

                                    </div>


                                    <div>

                                        <span>
                                            Shortage Hours
                                        </span>

                                        <strong className="global-shortage">
                                            {
                                                Number(
                                                    capacityData
                                                        .globalAllocation
                                                        .shortageHours
                                                ).toLocaleString()
                                            }
                                        </strong>

                                    </div>

                                </div>

                            )}


                            {/* =====================================================
                                GLOBAL SUBJECT BOTTLENECKS
                            ===================================================== */}

                            {Array.isArray(
                                capacityData.globalSubjectBottlenecks
                            ) &&
                                capacityData.globalSubjectBottlenecks.length > 0 && (

                                    <div className="global-capacity-box">

                                        <div>

                                            <span>
                                                Subject Bottlenecks
                                            </span>

                                            <strong className="global-shortage">
                                                {
                                                    capacityData
                                                        .globalSubjectBottlenecks
                                                        .length
                                                }
                                            </strong>

                                        </div>


                                        <div>

                                            <span>
                                                University Capacity
                                            </span>

                                            <strong>
                                                {
                                                    capacityData
                                                        .globalAllocation
                                                        ?.feasible
                                                            ? "Feasible"
                                                            : "Insufficient"
                                                }
                                            </strong>

                                        </div>

                                    </div>

                                )}

                        </div>


                        {/* ================= FOOTER ================= */}

                        <div className="capacity-modal-footer">

                            <div className="capacity-footer-message">

                                {
                                    capacityInsufficientPrograms.length >
                                    0
                                ? (

                                    <>

                                        <span className="footer-warning-icon">
                                            !
                                        </span>

                                        <span>
                                            {
                                                capacityData.message ||
                                                `${capacityInsufficientPrograms.length} program(s) have insufficient professor capacity.`
                                            }
                                        </span>

                                    </>

                                ) : (

                                    <>

                                        <span className="footer-success-icon">
                                            ✓
                                        </span>

                                        <span>
                                            All checked programs have
                                            sufficient professor capacity.
                                        </span>

                                    </>

                                )}

                            </div>


                            <button
                                className="capacity-modal-done"
                                onClick={
                                    closeCapacityModal
                                }
                            >
                                Close
                            </button>

                        </div>

                    </div>

                </div>

            )}


            {/* =====================================================
                GENERATE MODAL
            ===================================================== */}

            {showGenerateModal && (

                <div className="modal-overlay">

                    <div className="generate-modal">

                        <div className="modal-header">

                            <div>

                                <h2>
                                    Generate Schedule
                                </h2>

                                <p>
                                    Select the program and
                                    academic term.
                                </p>

                            </div>


                            <button
                                className="modal-close"
                                onClick={() =>
                                    setShowGenerateModal(
                                        false
                                    )
                                }
                            >
                                ×
                            </button>

                        </div>


                        <div className="modal-body">

                            <div className="form-group">

                                <label>
                                    Program
                                </label>

                                <select
                                    value={
                                        selectedProgram
                                    }
                                    onChange={(e) =>
                                        setSelectedProgram(
                                            e.target.value
                                        )
                                    }
                                >

                                    <option value="">
                                        Select Program
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
                                                }

                                                {" — "}

                                                {
                                                    program.program_name
                                                }

                                            </option>

                                        )
                                    )}

                                </select>

                            </div>


                            <div className="form-group">

                                <label>
                                    Academic Term
                                </label>

                                <select
                                    value={
                                        selectedAcademicTerm
                                    }
                                    onChange={(e) =>
                                        setSelectedAcademicTerm(
                                            e.target.value
                                        )
                                    }
                                >

                                    <option value="">
                                        Select Academic Term
                                    </option>


                                    {term && (

                                        <option
                                            value={
                                                term.id
                                            }
                                        >

                                            {
                                                term.school_year
                                            }

                                            {" — "}

                                            {
                                                term.semester
                                            }

                                        </option>

                                    )}

                                </select>

                            </div>

                        </div>


                        <div className="modal-footer">

                            <button
                                className="cancel-btn"
                                onClick={() =>
                                    setShowGenerateModal(
                                        false
                                    )
                                }
                            >
                                Cancel
                            </button>


                            <button
                                className="generate-btn"
                                onClick={
                                    handleGenerateSchedule
                                }
                            >
                                Generate Schedule
                            </button>

                        </div>

                    </div>

                </div>

            )}


            {/* =====================================================
                SCHEDULE MODAL
            ===================================================== */}

            {showScheduleModal &&
                selectedSection && (

                    <div className="schedule-modal-overlay">

                        <div className="schedule-modal">

                            <div className="schedule-modal-header">

                                <div>

                                    <h2>
                                        {
                                            selectedSection.program
                                        }{" "}
                                        {
                                            selectedSection.year
                                        }-
                                        {
                                            selectedSection.section
                                        }
                                    </h2>

                                    <p>
                                        Class Schedule
                                    </p>

                                </div>


                                <button
                                    className="schedule-modal-close"
                                    onClick={
                                        closeScheduleModal
                                    }
                                >
                                    ×
                                </button>

                            </div>


                            <div className="schedule-modal-body">

                                {
                                    selectedSection.schedules.map(
                                        (schedule) => (

                                            <div
                                                className="schedule-card"
                                                key={
                                                    schedule.id
                                                }
                                            >

                                                <div className="schedule-card-header">

                                                    <div>

                                                        <strong>
                                                            {
                                                                schedule.subject_code
                                                            }
                                                        </strong>

                                                        <span>
                                                            {" - "}
                                                            {
                                                                schedule.subject_name
                                                            }
                                                        </span>

                                                    </div>


                                                    <span
                                                        className={
                                                            schedule.room_type ===
                                                            "laboratory"
                                                                ? "schedule-type lab"
                                                                : "schedule-type lecture"
                                                        }
                                                    >
                                                        {
                                                            schedule.room_type?.toUpperCase()
                                                        }
                                                    </span>

                                                </div>


                                                <div className="schedule-card-details">

                                                    <div>

                                                        <span className="detail-label">
                                                            Day
                                                        </span>

                                                        <span>
                                                            {
                                                                schedule.day
                                                            }
                                                        </span>

                                                    </div>


                                                    <div>

                                                        <span className="detail-label">
                                                            Time
                                                        </span>

                                                        <span>
                                                            {
                                                                schedule.start_time?.slice(
                                                                    0,
                                                                    5
                                                                )
                                                            }
                                                            {" - "}
                                                            {
                                                                schedule.end_time?.slice(
                                                                    0,
                                                                    5
                                                                )
                                                            }
                                                        </span>

                                                    </div>


                                                    <div>

                                                        <span className="detail-label">
                                                            Room
                                                        </span>

                                                        <span>
                                                            {
                                                                schedule.room_name
                                                            }
                                                        </span>

                                                    </div>


                                                    <div>

                                                        <span className="detail-label">
                                                            Professor
                                                        </span>

                                                        <span>
                                                            {
                                                                schedule.professor_name
                                                            }
                                                        </span>

                                                    </div>

                                                </div>

                                            </div>

                                        )
                                    )
                                }

                            </div>


                            <div className="schedule-modal-footer">

                                <span>
                                    {
                                        selectedSection.schedules.length
                                    }{" "}
                                    schedule entries
                                </span>

                                <button
                                    onClick={
                                        closeScheduleModal
                                    }
                                    className="schedule-modal-done"
                                >
                                    Close
                                </button>

                            </div>

                        </div>

                    </div>

                )}

        </div>
        </>
    );
};

export default AdminSchedule;