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
    /*
    ==========================================
    BULK APPROVAL
    ==========================================
    */
   
    const [isApproving, setIsApproving] =
        useState(false);

    const [isMyBulkApproval, setIsMyBulkApproval] =
        useState(false);

    const [bulkProgress, setBulkProgress] =
        useState({
            status: "idle",
            processed: 0,
            total: 0,
            approved: 0,
            failed: 0,
            percentage: 0
        });


    /*
    ==========================================
    APPLICANT MODAL
    ==========================================
    */

    const [selectedStudent, setSelectedStudent] =
        useState(null);


    /*
    ==========================================
    TABS
    ==========================================
    */

    const [activeTab, setActiveTab] =
        useState("students");


    /*
    ==========================================
    APPLICANTS
    ==========================================
    */

    const [applicants, setApplicants] =
        useState([]);

    const [loading, setLoading] =
        useState(true);

    const [applicantsLoading, setApplicantsLoading] =
        useState(false);

    const [hasMoreApplicants, setHasMoreApplicants] =
        useState(true);

    const [lastApplicantId, setLastApplicantId] =
        useState(0);


    /*
    ==========================================
    PROFESSORS
    ==========================================
    */

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

    const INITIAL_APPLICANTS_LIMIT =
        1000;

    const APPLICANTS_BATCH_SIZE =
        500;


    /*
    ==========================================
    INFINITE SCROLL
    ==========================================
    */

    const loadMoreRef =
        useRef(null);


    /*
    ==========================================
    PREVENT DUPLICATE REQUESTS
    ==========================================
    */

    const applicantsLoadingRef =
        useRef(false);


    /*
    ==========================================
    CURRENT ADMIN ID
    ==========================================
    */

    const getCurrentAdminId =
        () => {

            try {

                const token =
                    localStorage.getItem(
                        "admin_token"
                    );

                if (!token) {
                    return null;
                }

                const parts =
                    token.split(".");

                if (parts.length !== 3) {
                    return null;
                }

                const payload =
                    JSON.parse(
                        atob(parts[1])
                    );

                return (
                    payload?.user?.id ??
                    payload?.id ??
                    null
                );

            } catch (error) {

                console.error(
                    "Failed to decode admin token:",
                    error
                );

                return null;
            }
        };


    /*
    ==========================================
    FETCH APPLICANTS
    ==========================================
    */

    const fetchApplicants =
        useCallback(
            async (initial = false) => {

                /*
                Prevent duplicate requests.
                */

                if (
                    applicantsLoadingRef.current
                ) {
                    return;
                }


                /*
                Stop loading more when
                there are no more applicants.
                */

                if (
                    !initial &&
                    !hasMoreApplicants
                ) {
                    return;
                }


                try {

                    applicantsLoadingRef.current =
                        true;

                    setApplicantsLoading(
                        true
                    );


                    const token =
                        localStorage.getItem(
                            "admin_token"
                        );


                    if (!token) {

                        throw new Error(
                            "Admin authentication token not found."
                        );
                    }


                    const limit =
                        initial
                            ? INITIAL_APPLICANTS_LIMIT
                            : APPLICANTS_BATCH_SIZE;


                    const lastId =
                        initial
                            ? 0
                            : lastApplicantId;


                    console.log(
                        `Fetching applicants: limit=${limit}, lastId=${lastId}`
                    );


                    const response =
                        await fetch(
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
                            "Failed to fetch applicants."
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
                        Boolean(
                            data.hasMore
                        )
                    );


                } catch (error) {

                    console.error(
                        "Failed to fetch applicants:",
                        error.message
                    );

                } finally {

                    applicantsLoadingRef.current =
                        false;

                    setApplicantsLoading(
                        false
                    );

                    setLoading(
                        false
                    );
                }

            },
            [
                hasMoreApplicants,
                lastApplicantId
            ]
        );


    /*
    ==========================================
    IMPORTANT:
    KEEP LATEST fetchApplicants IN REF
    ==========================================
    */

    const fetchApplicantsRef =
        useRef(fetchApplicants);


    useEffect(() => {

        fetchApplicantsRef.current =
            fetchApplicants;

    }, [
        fetchApplicants
    ]);


    /*
    ==========================================
    INITIAL PAGE LOAD
    ==========================================

    IMPORTANT:

    This effect intentionally has no
    fetchApplicants dependency.

    Otherwise every change to
    lastApplicantId would recreate
    fetchApplicants and trigger another
    initial request.
    ==========================================
    */

    useEffect(() => {

        fetchApplicantsRef.current(
            true
        );

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

                        fetchApplicantsRef.current(
                            false
                        );

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
        hasMoreApplicants
    ]);


    /*
    ==========================================
    SOCKET.IO
    ==========================================

    ONE SOCKET CONNECTION ONLY.

    It does NOT recreate itself whenever
    pagination changes.
    ==========================================
    */

    useEffect(() => {

        const token =
            localStorage.getItem(
                "admin_token"
            );


        if (!token) {

            console.warn(
                "Admin token not found. Socket not connected."
            );

            return;
        }


        /*
        ==========================================
        GET CURRENT ADMIN ID
        ==========================================
        */

        const currentAdminId =
            getCurrentAdminId();


        console.log(
            "👤 Current admin ID:",
            currentAdminId
        );


        /*
        ==========================================
        CONNECT SOCKET
        ==========================================
        */

        console.log(
            "🔌 Connecting admin Socket.IO..."
        );


        const socket =
            io(
                API_BASE_URL,
                {
                    auth: {
                        token
                    }
                }
            );


        /*
        ==========================================
        CONNECTED
        ==========================================
        */

        socket.on(
            "connect",
            () => {

                console.log(
                    "🔌 Admin socket connected:",
                    socket.id
                );

            }
        );


        /*
        ==========================================
        CONNECTION ERROR
        ==========================================
        */

        socket.on(
            "connect_error",
            error => {

                console.error(
                    "❌ Socket connection error:",
                    error.message
                );

            }
        );


        /*
        ==========================================
        GLOBAL BULK STATUS
        ==========================================

        Backend sends:

        {
            isApproving: true,
            adminId: 5
        }

        We compare:

        currentAdminId === adminId

        SAME ADMIN
            ↓
        Full overlay

        DIFFERENT ADMIN
            ↓
        Small indicator
        ==========================================
        */

        const handleBulkStatus =
            data => {

                console.log(
                    "🌐 Bulk approval status:",
                    data
                );


                const approving =
                    data?.isApproving === true;


                const ownerAdminId =
                    data?.adminId;


                /*
                ==========================================
                GLOBAL STATE
                ==========================================
                */

                setIsApproving(
                    approving
                );


                /*
                ==========================================
                OWNER CHECK
                ==========================================
                */

                if (
                    approving &&
                    ownerAdminId != null &&
                    currentAdminId != null
                ) {

                    const isOwner =
                        Number(
                            currentAdminId
                        ) === Number(
                            ownerAdminId
                        );


                    console.log(
                        "Bulk approval owner check:",
                        {
                            currentAdminId,
                            ownerAdminId,
                            isOwner
                        }
                    );


                    setIsMyBulkApproval(
                        isOwner
                    );


                    /*
                    If this admin is NOT
                    the owner, reset personal
                    progress state.
                    */

                    if (!isOwner) {

                        setBulkProgress(
                            previous => ({
                                ...previous,
                                status:
                                    "idle"
                            })
                        );

                    }

                }


                /*
                ==========================================
                BULK FINISHED
                ==========================================
                */

                if (!approving) {

                    setIsMyBulkApproval(
                        false
                    );

                    setBulkProgress(
                        previous => ({
                            ...previous,
                            status:
                                "idle"
                        })
                    );

                }

            };


        socket.on(
            "bulk_approval_status",
            handleBulkStatus
        );


        /*
        ==========================================
        PERSONAL BULK PROGRESS
        ==========================================

        Backend sends this ONLY to:

            admin:${adminId}

        Therefore this admin is already
        the owner.
        ==========================================
        */

        const handleBulkProgress =
            progress => {

                console.log(
                    "📊 My bulk approval progress:",
                    progress
                );


                setBulkProgress({

                    status:
                        progress.status ||
                        "processing",

                    processed:
                        Number(
                            progress.processed || 0
                        ),

                    total:
                        Number(
                            progress.total || 0
                        ),

                    approved:
                        Number(
                            progress.approved || 0
                        ),

                    failed:
                        Number(
                            progress.failed || 0
                        ),

                    percentage:
                        Number(
                            progress.percentage || 0
                        )

                });


                /*
                ==========================================
                THIS ADMIN IS THE OWNER
                ==========================================
                */

                if (
                    progress.status === "started" ||
                    progress.status === "processing"
                ) {

                    setIsMyBulkApproval(
                        true
                    );

                    setIsApproving(
                        true
                    );

                }


                /*
                ==========================================
                COMPLETED
                ==========================================
                */

                if (
                    progress.status === "completed"
                ) {

                    setIsMyBulkApproval(
                        false
                    );

                    setIsApproving(
                        false
                    );

                }

            };


        socket.on(
            "bulk_approval_progress",
            handleBulkProgress
        );

        
        /*
        ==========================================
        NEW APPLICATION
        ==========================================
        */

        const handleNewApplication =
            data => {

                console.log(
                    "📩 New application:",
                    data
                );


                /*
                Reset pagination.
                */

                setLastApplicantId(
                    0
                );

                setHasMoreApplicants(
                    true
                );


                /*
                Refresh first page.
                */

                fetchApplicantsRef.current(
                    true
                );

            };


        socket.on(
            "new_application",
            handleNewApplication
        );


        /*
        ==========================================
        CLEANUP
        ==========================================
        */

        return () => {

            console.log(
                "🔌 Disconnecting admin Socket.IO..."
            );


            socket.off(
                "connect"
            );

            socket.off(
                "connect_error"
            );

            socket.off(
                "bulk_approval_status",
                handleBulkStatus
            );

            socket.off(
                "bulk_approval_progress",
                handleBulkProgress
            );

            socket.off(
                "new_application",
                handleNewApplication
            );

            socket.disconnect();

        };

    }, []);


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


                if (!token) {

                    throw new Error(
                        "Admin authentication token not found."
                    );

                }


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


                console.log(
                    data
                );


                alert(
                    "Approved."
                );


                /*
                Reload first page.
                */

                setLastApplicantId(
                    0
                );

                setHasMoreApplicants(
                    true
                );


                await fetchApplicantsRef.current(
                    true
                );


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


    
        const handleReset = async () => {
            const token = localStorage.getItem("admin_token");
            if (!token) {
                alert("Please login as admin first.");
                return;
            }

            try{
                setLoading(true);
                const result = await fetch(`${API_BASE_URL}/api/auth/admin/resetStudent`,
                    {
                        method: "POST",
                        headers: {
                            Authorization: `Bearer ${token}`
                        }
                    }
                );
                
                const data = await result.json();

                if(result.ok){
                    alert(`Success: ${result.message}`)
                    setLoading(false);
                }
                else{
                    alert(`Error ${result.message}`)
                }
            }
            catch(err){
                alert(err.message || "there is error on reseting students")
            }
        }



    /*
    ==========================================
    APPROVE ALL APPLICANTS
    ==========================================
    */

    const approveAllApplicants =
        async () => {

            /*
            Frontend guard.

            Backend still has the real lock.
            This only prevents unnecessary
            requests from this browser.
            */

            if (isApproving) {

                return;

            }


            try {

                const token =
                    localStorage.getItem(
                        "admin_token"
                    );


                if (!token) {

                    throw new Error(
                        "Admin authentication token not found."
                    );

                }


                console.log(
                    "🚀 Starting bulk applicant approval..."
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


                /*
                ==========================================
                ANOTHER ADMIN ALREADY RUNNING
                ==========================================
                */

                if (
                    response.status === 409
                ) {

                    console.warn(
                        "Bulk approval already running."
                    );


                    alert(
                        data.message ||
                        "Bulk approval is already in progress."
                    );


                    return;

                }


                /*
                ==========================================
                OTHER ERROR
                ==========================================
                */

                if (!response.ok) {

                    throw new Error(
                        data.message ||
                        "Failed to approve applicants."
                    );

                }


                console.log(
                    "✅ Bulk approval completed:",
                    data
                );


                /*
                ==========================================
                REFRESH APPLICANTS
                ==========================================
                */

                setLastApplicantId(
                    0
                );

                setHasMoreApplicants(
                    true
                );


                await fetchApplicantsRef.current(
                    true
                );


                /*
                ==========================================
                RESULT
                ==========================================
                */

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
                    "❌ Approve all error:",
                    error
                );


                alert(
                    error.message ||
                    "An error occurred while approving applicants."
                );

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
                                    status:
                                        "approved"
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
                                    status:
                                        "rejected"
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
                applicant.status ===
                "pending"
        );


    const pendingProfessors =
        professors.filter(
            professor =>
                professor.status ===
                "pending"
        );


    /*
    ==========================================
    RENDER
    ==========================================
    */

    return (
        <>

            {/* ==================================================
                GLOBAL SMALL INDICATOR

                ONLY FOR OTHER ADMINS.

                isApproving = true
                isMyBulkApproval = false
            ================================================== */}

            {isApproving &&
                !isMyBulkApproval && (

                    <div className="global-bulk-status">

                        <span className="global-bulk-spinner"></span>

                        <div className="global-bulk-status-text">

                            <strong>
                                Approval in progress
                            </strong>

                            <span>
                                Another admin is approving applicants
                            </span>

                        </div>

                    </div>

                )}


            {/* ==================================================
                OWNER FULL OVERLAY

                ONLY THE ADMIN WHO STARTED
                THE BULK APPROVAL SEES THIS.
            ================================================== */}

            {isMyBulkApproval && (

                <div className="bulk-loading-overlay">

                    <div className="bulk-loading">

                        <div className="bulk-loading-icon">

                            <div className="bulk-spinner"></div>

                        </div>


                        <div className="bulk-loading-header">

                            <span className="bulk-live-dot"></span>

                            <span>
                                BULK APPROVAL IN PROGRESS
                            </span>

                        </div>


                        <h2>
                            Approving Applicants
                        </h2>


                        <p className="bulk-loading-description">

                            Please wait while the system
                            processes the applicants in batches.

                        </p>


                        <div className="bulk-progress-info">

                            <div>

                                <strong>
                                    {
                                        bulkProgress
                                            .processed
                                            .toLocaleString()
                                    }
                                </strong>

                                <span>

                                    {" / "}

                                    {
                                        bulkProgress.total
                                            ? bulkProgress
                                                .total
                                                .toLocaleString()
                                            : "..."
                                    }

                                    {" applicants"}

                                </span>

                            </div>


                            <strong className="bulk-percentage">

                                {
                                    bulkProgress
                                        .percentage
                                }%

                            </strong>

                        </div>


                        <div className="bulk-progress-bar">

                            <div
                                className="bulk-progress-fill"
                                style={{
                                    width:
                                        `${Math.min(
                                            Math.max(
                                                bulkProgress.percentage,
                                                0
                                            ),
                                            100
                                        )}%`
                                }}
                            />

                        </div>


                        <div className="bulk-progress-status">

                            {
                                bulkProgress.status ===
                                "started"

                                    ? "Preparing applicants..."

                                    : "Processing applicants..."
                            }

                        </div>


                        <div className="bulk-stats">

                            <div className="bulk-stat approved">

                                <span>
                                    APPROVED
                                </span>

                                <strong>
                                    {
                                        bulkProgress
                                            .approved
                                            .toLocaleString()
                                    }
                                </strong>

                            </div>


                            <div className="bulk-stat failed">

                                <span>
                                    FAILED
                                </span>

                                <strong>
                                    {
                                        bulkProgress
                                            .failed
                                            .toLocaleString()
                                    }
                                </strong>

                            </div>


                            <div className="bulk-stat processed">

                                <span>
                                    PROCESSED
                                </span>

                                <strong>
                                    {
                                        bulkProgress
                                            .processed
                                            .toLocaleString()
                                    }
                                </strong>

                            </div>

                        </div>


                        <div className="bulk-loading-footer">

                            <span></span>

                            <p>
                                Do not close this page until
                                the operation is complete.
                            </p>

                        </div>

                    </div>

                </div>

            )}


            {/* ==================================================
                MAIN PAGE
            ================================================== */}

            <div
                className="applicants-page"

            >

                {/* ==================================================
                    HEADER
                ================================================== */}

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
                            <button onClick={handleReset} className='a-h-reset'>Reset Student</button>

                            {/* ==================================
                                APPROVE ALL
                            ================================== */}

                            <button
                                onClick={
                                    approveAllApplicants
                                }
                                className={
                                    `approveAll ${
                                        isApproving
                                            ? "bulk-approval-active"
                                            : ""
                                    }`
                                }
                                disabled={
                                    isApproving
                                }
                            >

                                {isApproving ? (

                                    <>

                                        <span className="approve-all-spinner"></span>

                                        <span>
                                            Approval in progress...
                                        </span>

                                    </>

                                ) : (

                                    "Approve All"

                                )}

                            </button>


                        </div>


                        {/* ==================================
                            PENDING COUNT
                        ================================== */}

                        <div className="applicant-count">

                            {
                                activeTab ===
                                "students"

                                    ? pendingStudents.length

                                    : pendingProfessors.length
                            }

                            <span>
                                {" "}Pending
                            </span>

                        </div>

                    </div>

                </div>


                {/* ==================================================
                    TABS
                ================================================== */}

                <div className="applicant-tabs">

                    <button
                        className={
                            activeTab ===
                            "students"
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
                            {
                                pendingStudents.length
                            }
                        </span>

                    </button>


                    <button
                        className={
                            activeTab ===
                            "professors"
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
                            {
                                pendingProfessors.length
                            }
                        </span>

                    </button>

                </div>


                {/* ==================================================
                    STUDENTS
                ================================================== */}

                {
                    activeTab ===
                    "students" && (

                        <div className="applications-list">

                            {
                                applicants.map(
                                    student => (

                                        <div
                                            className={
                                                `application-card ${student.status}`
                                            }
                                            key={
                                                student.id
                                            }
                                        >

                                            <div className="applicant-info">

                                                <div className="applicant-avatar">

                                                    {
                                                        student
                                                            .firstname
                                                            ?.charAt(0)
                                                            ?.toUpperCase()
                                                    }

                                                </div>


                                                <div>

                                                    <h2>
                                                        {
                                                            student.firstname
                                                        }
                                                    </h2>

                                                    <p>
                                                        {
                                                            student.email
                                                        }
                                                    </p>

                                                    <small>

                                                        Applied on{" "}

                                                        {
                                                            student.created_at
                                                        }

                                                    </small>

                                                </div>

                                            </div>


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


                                            <div className="application-actions">

                                                {
                                                    student.status ===
                                                    "pending" && (

                                                        <>

                                                            <button
                                                                className="approve-btn"
                                                                onClick={() =>
                                                                    approvedApplicant(
                                                                        student
                                                                    )
                                                                }
                                                                disabled={
                                                                    isApproving
                                                                }
                                                            >

                                                                {
                                                                    isApproving
                                                                        ? "Approval in progress..."
                                                                        : "Approve & Enroll"
                                                                }

                                                            </button>


                                                            <button
                                                                className="reject-btn"
                                                                onClick={() =>
                                                                    rejectStudent(
                                                                        student.id
                                                                    )
                                                                }
                                                                disabled={
                                                                    isApproving
                                                                }
                                                            >

                                                                Reject

                                                            </button>

                                                        </>

                                                    )
                                                }


                                                {
                                                    student.status ===
                                                    "approved" && (

                                                        <span className="approved-status">

                                                            ✓ Enrolled

                                                        </span>

                                                    )
                                                }


                                                {
                                                    student.status ===
                                                    "rejected" && (

                                                        <span className="rejected-status">

                                                            ✕ Rejected

                                                        </span>

                                                    )
                                                }


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
                                )
                            }


                            {/* ==================================================
                                LOAD MORE
                            ================================================== */}

                            {
                                hasMoreApplicants && (

                                    <div
                                        ref={
                                            loadMoreRef
                                        }
                                        className="load-more-trigger"
                                    >

                                        {
                                            applicantsLoading
                                                ? "Loading more applicants..."
                                                : "Scroll to load more"
                                        }

                                    </div>

                                )
                            }


                            {/* ==================================================
                                ALL LOADED
                            ================================================== */}

                            {
                                !hasMoreApplicants &&
                                applicants.length > 0 && (

                                    <div className="load-more-trigger">

                                        All applicants loaded.

                                    </div>

                                )
                            }


                            {/* ==================================================
                                INITIAL LOADING
                            ================================================== */}

                            {
                                loading &&
                                applicants.length === 0 && (

                                    <div className="load-more-trigger">

                                        Loading applicants...

                                    </div>

                                )
                            }

                        </div>

                    )
                }


                {/* ==================================================
                    APPLICANT MODAL
                ================================================== */}

                {
                    selectedStudent && (

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

                    )
                }


                {/* ==================================================
                    PROFESSORS
                ================================================== */}

                {
                    activeTab ===
                    "professors" && (

                        <div className="applications-list">

                            {
                                professors.map(
                                    professor => (

                                        <div
                                            className={
                                                `application-card ${professor.status}`
                                            }
                                            key={
                                                professor.id
                                            }
                                        >

                                            <div className="applicant-info">

                                                <div className="applicant-avatar professor">

                                                    {
                                                        professor.name
                                                            .charAt(0)
                                                    }

                                                </div>


                                                <div>

                                                    <h2>
                                                        {
                                                            professor.name
                                                        }
                                                    </h2>

                                                    <p>
                                                        {
                                                            professor.email
                                                        }
                                                    </p>

                                                    <small>

                                                        Applied on{" "}

                                                        {
                                                            professor.date
                                                        }

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

                                                {
                                                    professor.status ===
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

                                                    )
                                                }


                                                {
                                                    professor.status ===
                                                    "approved" && (

                                                        <span className="approved-status">

                                                            ✓ Approved

                                                        </span>

                                                    )
                                                }


                                                {
                                                    professor.status ===
                                                    "rejected" && (

                                                        <span className="rejected-status">

                                                            ✕ Rejected

                                                        </span>

                                                    )
                                                }

                                            </div>

                                        </div>

                                    )
                                )
                            }

                        </div>

                    )
                }

            </div>

        </>
    );
}