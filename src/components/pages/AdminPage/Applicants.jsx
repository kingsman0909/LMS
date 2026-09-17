import {
    useState,
    useEffect,
    useRef,
    useCallback
} from "react";

import "./styles/Applicants.css";
import ApplicantModal from "./ApplicantComp/ApplicantModal";
import { API_BASE_URL } from "../../../config";
import { io } from "socket.io-client";

export default function AdminApplicants() {

    const [selectedStudent, setSelectedStudent] =
        useState(null);

    const [activeTab, setActiveTab] =
        useState("students");

    const [applicants, setApplicants] =
        useState([]);

    const [loading, setLoading] =
        useState(true);

    const [applicantsLoading, setApplicantsLoading] =
        useState(false);

    const [bulkLoading, setBulkLoading] =
        useState(false);

    const [hasMoreApplicants, setHasMoreApplicants] =
        useState(true);

    const [lastApplicantId, setLastApplicantId] =
        useState(0);

    const [showCapacityModal, setShowCapacityModal] =
        useState(false);

    const [capacities, setCapacities] =
        useState([]);

    const [academicTerm, setAcademicTerm] =
        useState(null);

    const [capacityLoading, setCapacityLoading] =
        useState(false);

    const [capacityData, setCapacityData] =
        useState(null);

    const [bulkProgress, setBulkProgress] = useState({
        status: "idle",
        processed: 0,
        total: 0,
        approved: 0,
        failed: 0,
        percentage: 0
    });

    const [professors, setProfessors] =
        useState([
            {
                id: 1,
                name: "Dr. Michael Reyes",
                email: "michael@gmail.com",
                username: "michaelreyes",
                specialization: "Computer Science",
                experience: "5 Years",
                date: "July 23, 2026",
                status: "pending"
            },
            {
                id: 2,
                name: "Prof. Ana Garcia",
                email: "ana@gmail.com",
                username: "anagarcia",
                specialization: "Information Technology",
                experience: "8 Years",
                date: "July 22, 2026",
                status: "pending"
            }
        ]);

    /*
    ==========================================
    PAGINATION SETTINGS
    ==========================================
    */

    const INITIAL_APPLICANTS_LIMIT = 1000;
    const APPLICANTS_BATCH_SIZE = 500;

    /*
    ==========================================
    REF FOR INFINITE SCROLL
    ==========================================
    */

    const loadMoreRef = useRef(null);

    /*
    ==========================================
    PREVENT DUPLICATE REQUESTS
    ==========================================
    */

    const applicantsLoadingRef =
        useRef(false);

    /*
    ==========================================
    FETCH ACADEMIC TERM
    ==========================================
    */

    const fetchAcademicTerm = async () => {

        try {

            const token =
                localStorage.getItem("admin_token");

            const response = await fetch(
                `${API_BASE_URL}/api/auth/getAcademicTerm`,
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

            if (!response.ok) {

                throw new Error(
                    data.message ||
                    "Failed to fetch academic term."
                );

            }

            setAcademicTerm(data.term);

        } catch (error) {

            console.error(
                "Academic term error:",
                error
            );

        }
    };

    /*
    ==========================================
    FETCH APPLICANTS
    ==========================================
    
    initial = true
        → fetch first 1000

    initial = false
        → fetch next 500
    */

    const fetchApplicants = useCallback(
        async (initial = false) => {

            if (applicantsLoadingRef.current) {
                return;
            }

            if (
                !initial &&
                !hasMoreApplicants
            ) {
                return;
            }

            try {

                applicantsLoadingRef.current = true;

                setApplicantsLoading(true);

                const token =
                    localStorage.getItem(
                        "admin_token"
                    );

                const limit = initial
                    ? INITIAL_APPLICANTS_LIMIT
                    : APPLICANTS_BATCH_SIZE;

                const lastId = initial
                    ? 0
                    : lastApplicantId;

                console.log(
                    `Fetching applicants: limit=${limit}, lastId=${lastId}`
                );

                const response = await fetch(
                    `${API_BASE_URL}/api/auth/applicants?limit=${limit}&lastId=${lastId}`,
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

                if (!response.ok) {

                    throw new Error(
                        data.message ||
                        "Failed to fetch applicants"
                    );

                }

                const newApplicants =
                    data.applicants || [];

                console.log(
                    `Fetched ${newApplicants.length} applicants`
                );

                /*
                ==========================================
                INITIAL LOAD
                ==========================================
                */

                if (initial) {

                    setApplicants(
                        newApplicants
                    );

                }

                /*
                ==========================================
                LOAD MORE
                ==========================================
                */

                else {

                    setApplicants(
                        previous => [
                            ...previous,
                            ...newApplicants
                        ]
                    );

                }

                /*
                ==========================================
                UPDATE LAST ID
                ==========================================
                */

                if (
                    newApplicants.length > 0
                ) {

                    const lastApplicant =
                        newApplicants[
                            newApplicants.length - 1
                        ];

                    setLastApplicantId(
                        lastApplicant.id
                    );

                }

                /*
                ==========================================
                HAS MORE
                ==========================================
                */

                setHasMoreApplicants(
                    Boolean(data.hasMore)
                );

            } catch (error) {

                console.error(
                    "Failed to fetch applicants:",
                    error.message
                );

            } finally {

                applicantsLoadingRef.current =
                    false;

                setApplicantsLoading(false);

                setLoading(false);

            }

        },
        [
            hasMoreApplicants,
            lastApplicantId
        ]
    );

    /*
    ==========================================
    INITIAL PAGE LOAD
    ==========================================
    */

    useEffect(() => {

        fetchApplicants(true);
        fetchAcademicTerm();

    }, []);

    /*
    ==========================================
    INFINITE SCROLL
    ==========================================
    */

    useEffect(() => {

        const observer =
            new IntersectionObserver(
                entries => {

                    const firstEntry =
                        entries[0];

                    if (
                        firstEntry.isIntersecting &&
                        hasMoreApplicants &&
                        !applicantsLoadingRef.current
                    ) {

                        fetchApplicants(false);

                    }

                },
                {
                    threshold: 0.1
                }
            );

        const currentRef =
            loadMoreRef.current;

        if (currentRef) {

            observer.observe(
                currentRef
            );

        }

        return () => {

            if (currentRef) {

                observer.unobserve(
                    currentRef
                );

            }

        };

    }, [
        fetchApplicants,
        hasMoreApplicants
    ]);

    /*
    ==========================================
    BULK APPROVAL SOCKET
    ==========================================
    */

    useEffect(() => {

        const token =
            localStorage.getItem(
                "admin_token"
            );

        const socket =
            io(API_BASE_URL, {
                auth: {
                    token
                }
            });

        socket.on(
            "bulk_approval_progress",
            progress => {

                console.log(
                    "Bulk approval progress:",
                    progress
                );

                setBulkProgress(
                    progress
                );

            }
        );

        return () => {

            socket.off(
                "bulk_approval_progress"
            );

            socket.disconnect();

        };

    }, []);

    /*
    ==========================================
    NEW APPLICATION SOCKET
    ==========================================
    */

    useEffect(() => {

        const token =
            localStorage.getItem(
                "admin_token"
            );

        const socket =
            io(API_BASE_URL, {
                auth: {
                    token
                }
            });

        const handleNewApplication =
            data => {

                console.log(
                    "New application:",
                    data
                );

                /*
                Reset pagination and
                reload first 1000.
                */

                setLastApplicantId(0);

                setHasMoreApplicants(
                    true
                );

                fetchApplicants(true);

            };

        socket.on(
            "new_application",
            handleNewApplication
        );

        return () => {

            socket.off(
                "new_application",
                handleNewApplication
            );

            socket.disconnect();

        };

    }, [fetchApplicants]);

    /*
    ==========================================
    SIMULATE STUDENTS
    ==========================================
    */

    const SimulateStudents = async () => {

        try {

            console.log(
                "Starting student capacity simulation..."
            );

            setCapacityLoading(true);

            const response =
                await fetch(
                    `${API_BASE_URL}/api/auth/admin/SimulateStudents`,
                    {
                        method: "GET",

                        headers: {
                            "Content-Type":
                                "application/json",

                            Authorization:
                                `Bearer ${
                                    localStorage.getItem(
                                        "admin_token"
                                    )
                                }`
                        }
                    }
                );

            const data =
                await response.json();

            if (!response.ok) {

                throw new Error(
                    data.message ||
                    "Failed to simulate student capacity."
                );

            }

            console.log(
                "Student capacity simulation completed:",
                data
            );

            setCapacityData(data);

            return data;

        } catch (error) {

            console.error(
                "SimulateStudents error:",
                error
            );

            throw error;

        } finally {

            setCapacityLoading(false);

        }
    };

    /*
    ==========================================
    SINGLE APPROVE
    ==========================================
    */

    const approvedApplicant =
        async student => {

            try {

                const token =
                    localStorage.getItem(
                        "admin_token"
                    );

                const response =
                    await fetch(
                        `${API_BASE_URL}/api/auth/admin/applicants/${student.id}/approvedApplicant`,
                        {
                            method: "POST",

                            headers: {
                                Authorization:
                                    `Bearer ${token}`
                            }
                        }
                    );

                const data =
                    await response.json();

                if (!response.ok) {

                    throw new Error(
                        data.message ||
                        "Failed to approve applicant."
                    );

                }

                console.log(data);

                alert(
                    "Approved."
                );

                /*
                Reload the first 1000.
                */

                setLastApplicantId(0);

                setHasMoreApplicants(
                    true
                );

                await fetchApplicants(true);

            } catch (error) {

                console.error(
                    "Failed to approve applicant:",
                    error.message
                );

                alert(
                    error.message ||
                    "Failed to approve applicant."
                );

            }
        };

    /*
    ==========================================
    APPROVE ALL
    ==========================================
    */

    const approveAllApplicants =
        async () => {

            try {

                const token =
                    localStorage.getItem(
                        "admin_token"
                    );

                /*
                Do NOT determine total applicants
                from the currently loaded 1000.

                Backend will determine the real
                pending count.
                */

                setBulkLoading(true);

                setBulkProgress({
                    status: "starting",
                    processed: 0,
                    total: 0,
                    approved: 0,
                    failed: 0,
                    percentage: 0
                });

                console.log(
                    "Starting bulk applicant approval..."
                );

                const response =
                    await fetch(
                        `${API_BASE_URL}/api/auth/admin/applicants/approveAll`,
                        {
                            method: "POST",

                            headers: {
                                Authorization:
                                    `Bearer ${token}`,

                                "Content-Type":
                                    "application/json"
                            }
                        }
                    );

                const data =
                    await response.json();

                if (!response.ok) {

                    throw new Error(
                        data.message ||
                        "Failed to approve applicants."
                    );

                }

                console.log(
                    "Batch approval result:",
                    data
                );

                /*
                Reload first page after
                bulk approval.
                */

                setLastApplicantId(0);

                setHasMoreApplicants(
                    true
                );

                await fetchApplicants(true);

                alert(
                    `Finished approving applicants!\n\n` +
                    `Approved: ${
                        data.approved || 0
                    }\n` +
                    `Failed: ${
                        data.failed || 0
                    }`
                );

            } catch (error) {

                console.error(
                    "Approve all error:",
                    error
                );

                alert(
                    error.message ||
                    "An error occurred while approving applicants."
                );

            } finally {

                setBulkLoading(false);

            }
        };

    /*
    ==========================================
    PROFESSOR ACTIONS
    ==========================================
    */

    const approveProfessor =
        id => {

            setProfessors(
                previous =>
                    previous.map(
                        professor =>
                            professor.id === id
                                ? {
                                    ...professor,
                                    status: "approved"
                                }
                                : professor
                    )
            );

        };

    const rejectProfessor =
        id => {

            setProfessors(
                previous =>
                    previous.map(
                        professor =>
                            professor.id === id
                                ? {
                                    ...professor,
                                    status: "rejected"
                                }
                                : professor
                    )
            );

        };

    /*
    ==========================================
    REJECT STUDENT
    ==========================================
    */

    const rejectStudent =
        id => {

            console.log(
                "Reject student:",
                id
            );

        };

    /*
    ==========================================
    PENDING COUNTS
    ==========================================
    */

    const pendingStudents =
        applicants.filter(
            applicant =>
                applicant.status === "pending"
        );

    const pendingProfessors =
        professors.filter(
            professor =>
                professor.status === "pending"
        );

    /*
    ==========================================
    RENDER
    ==========================================
    */

    return (
        <>

            {/* ======================================
                BULK APPROVAL LOADING
            ====================================== */}

            {bulkLoading && (

                <div className="bulk-loading">

                    <h2>
                        Approving Applicants...
                    </h2>

                    <p>

                        {bulkProgress.processed
                            .toLocaleString()}

                        {" / "}

                        {bulkProgress.total
                            ? bulkProgress.total
                                .toLocaleString()
                            : "..."}

                        {" applicants processed"}

                    </p>

                    <div className="progress-bar">

                        <div
                            className="progress-fill"
                            style={{
                                width:
                                    `${bulkProgress.percentage}%`
                            }}
                        />

                    </div>

                    <strong>
                        {bulkProgress.percentage}%
                    </strong>

                    <p>

                        Approved:{" "}

                        {bulkProgress.approved
                            .toLocaleString()}

                        {" | "}

                        Failed:{" "}

                        {bulkProgress.failed
                            .toLocaleString()}

                    </p>

                </div>

            )}

            {/* ======================================
                MAIN PAGE
            ====================================== */}

            <div
                className="applicants-page"
                style={{
                    filter:
                        capacityLoading
                            ? "blur(6px)"
                            : "none"
                }}
            >

                {/* ==================================
                    HEADER
                ================================== */}

                <div className="applicants-header">

                    <div>

                        <h1>
                            Applicants
                        </h1>

                        <p>
                            Review student and professor applications
                        </p>

                    </div>

                    <div className="applicants-header-right">

                        <div className="a-h-btn">

                            <button
                                onClick={
                                    approveAllApplicants
                                }
                                className="approveAll"
                                disabled={bulkLoading}
                            >
                                Approve All
                            </button>

                            <button
                                onClick={
                                    SimulateStudents
                                }
                                className="capacityBtn"
                                disabled={capacityLoading}
                            >
                                {capacityLoading
                                    ? "Checking..."
                                    : "Check Capacity"}
                            </button>

                        </div>

                        <div className="applicant-count">

                            {activeTab === "students"
                                ? pendingStudents.length
                                : pendingProfessors.length
                            }

                            <span>
                                {" "}Pending
                            </span>

                        </div>

                    </div>

                </div>

                {/* ==================================
                    TABS
                ================================== */}

                <div className="applicant-tabs">

                    <button
                        className={
                            activeTab === "students"
                                ? "active"
                                : ""
                        }
                        onClick={() =>
                            setActiveTab(
                                "students"
                            )
                        }
                    >

                        Students

                        <span>
                            {pendingStudents.length}
                        </span>

                    </button>

                    <button
                        className={
                            activeTab === "professors"
                                ? "active"
                                : ""
                        }
                        onClick={() =>
                            setActiveTab(
                                "professors"
                            )
                        }
                    >

                        Professors

                        <span>
                            {pendingProfessors.length}
                        </span>

                    </button>

                </div>

                {/* ==================================
                    STUDENTS
                ================================== */}

                {activeTab === "students" && (

                    <div className="applications-list">

                        {applicants.map(
                            student => (

                                <div
                                    className={`application-card ${student.status}`}
                                    key={student.id}
                                >

                                    {/* ==================
                                        STUDENT INFO
                                    ================== */}

                                    <div className="applicant-info">

                                        <div className="applicant-avatar">

                                            {student.firstname
                                                ?.charAt(0)
                                                ?.toUpperCase()}

                                        </div>

                                        <div>

                                            <h2>
                                                {student.firstname}
                                            </h2>

                                            <p>
                                                {student.email}
                                            </p>

                                            <small>
                                                Applied on{" "}
                                                {student.created_at}
                                            </small>

                                        </div>

                                    </div>

                                    {/* ==================
                                        DETAILS
                                    ================== */}

                                    <div className="application-details">

                                        <div>

                                            <span>
                                                Course
                                            </span>

                                            <strong>
                                                <p>
                                                    {
                                                        student.program_name
                                                    }
                                                </p>
                                            </strong>

                                        </div>

                                        <div>

                                            <span>
                                                Year Level
                                            </span>

                                            <strong>
                                                {
                                                    student.year_level
                                                }
                                            </strong>

                                        </div>

                                        <div>

                                            <span>
                                                Username
                                            </span>

                                            <strong>
                                                {
                                                    student.username
                                                }
                                            </strong>

                                        </div>

                                    </div>

                                    {/* ==================
                                        ACTIONS
                                    ================== */}

                                    <div className="application-actions">

                                        {student.status ===
                                            "pending" && (

                                            <>

                                                <button
                                                    className="approve-btn"
                                                    onClick={() =>
                                                        approvedApplicant(
                                                            student
                                                        )
                                                    }
                                                >
                                                    Approve & Enroll
                                                </button>

                                                <button
                                                    className="reject-btn"
                                                    onClick={() =>
                                                        rejectStudent(
                                                            student.id
                                                        )
                                                    }
                                                >
                                                    Reject
                                                </button>

                                            </>

                                        )}

                                        {student.status ===
                                            "approved" && (

                                            <span className="approved-status">

                                                ✓ Enrolled

                                            </span>

                                        )}

                                        {student.status ===
                                            "rejected" && (

                                            <span className="rejected-status">

                                                ✕ Rejected

                                            </span>

                                        )}

                                        <button
                                            className="a-view-btn"
                                            onClick={() =>
                                                setSelectedStudent(
                                                    student
                                                )
                                            }
                                        >
                                            View
                                        </button>

                                    </div>

                                </div>

                            )
                        )}

                        {/* ==================================
                            LOAD MORE TRIGGER
                        ================================== */}

                        {hasMoreApplicants && (

                            <div
                                ref={loadMoreRef}
                                className="load-more-trigger"
                            >

                                {applicantsLoading
                                    ? "Loading more applicants..."
                                    : "Scroll to load more"}

                            </div>

                        )}

                        {!hasMoreApplicants &&
                            applicants.length > 0 && (

                            <div className="load-more-trigger">

                                All applicants loaded.

                            </div>

                        )}

                        {loading &&
                            applicants.length === 0 && (

                            <div className="load-more-trigger">

                                Loading applicants...

                            </div>

                        )}

                    </div>

                )}

                {/* ======================================
                    APPLICANT MODAL
                ====================================== */}

                {selectedStudent && (

                    <ApplicantModal
                        selectedStudent={
                            selectedStudent
                        }
                        setSelectedStudent={
                            setSelectedStudent
                        }
                        approved={
                            approvedApplicant
                        }
                    />

                )}

                {/* ======================================
                    PROFESSORS
                ====================================== */}

                {activeTab === "professors" && (

                    <div className="applications-list">

                        {professors.map(
                            professor => (

                                <div
                                    className={`application-card ${professor.status}`}
                                    key={professor.id}
                                >

                                    <div className="applicant-info">

                                        <div className="applicant-avatar professor">

                                            {professor.name
                                                .charAt(0)}

                                        </div>

                                        <div>

                                            <h2>
                                                {professor.name}
                                            </h2>

                                            <p>
                                                {professor.email}
                                            </p>

                                            <small>
                                                Applied on{" "}
                                                {professor.date}
                                            </small>

                                        </div>

                                    </div>

                                    <div className="application-details">

                                        <div>

                                            <span>
                                                Specialization
                                            </span>

                                            <strong>
                                                {
                                                    professor.specialization
                                                }
                                            </strong>

                                        </div>

                                        <div>

                                            <span>
                                                Experience
                                            </span>

                                            <strong>
                                                {
                                                    professor.experience
                                                }
                                            </strong>

                                        </div>

                                        <div>

                                            <span>
                                                Username
                                            </span>

                                            <strong>
                                                {
                                                    professor.username
                                                }
                                            </strong>

                                        </div>

                                    </div>

                                    <div className="application-actions">

                                        {professor.status ===
                                            "pending" && (

                                            <>

                                                <button
                                                    className="approve-btn"
                                                    onClick={() =>
                                                        approveProfessor(
                                                            professor.id
                                                        )
                                                    }
                                                >
                                                    Approve
                                                </button>

                                                <button
                                                    className="reject-btn"
                                                    onClick={() =>
                                                        rejectProfessor(
                                                            professor.id
                                                        )
                                                    }
                                                >
                                                    Reject
                                                </button>

                                            </>

                                        )}

                                        {professor.status ===
                                            "approved" && (

                                            <span className="approved-status">

                                                ✓ Approved

                                            </span>

                                        )}

                                        {professor.status ===
                                            "rejected" && (

                                            <span className="rejected-status">

                                                ✕ Rejected

                                            </span>

                                        )}

                                    </div>

                                </div>

                            )
                        )}

                    </div>

                )}

            </div>

        </>
    );
}