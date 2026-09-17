import { useState, useEffect } from "react";
import "./styles/Applicants.css";
import ApplicantModal from "./ApplicantComp/ApplicantModal";
import { API_BASE_URL } from "../../../config";
import { io } from "socket.io-client";

export default function AdminApplicants() {

    const [selectedStudent, setSelectedStudent] = useState(null);
    const [activeTab, setActiveTab] = useState("students");

    const [applicants, setApplicants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [bulkLoading, setBulkLoading] = useState(false);
    const [showCapacityModal, setShowCapacityModal] = useState(false);
    const [capacities, setCapacities] = useState([]);
    const [academicTerm, setAcademicTerm] = useState(null);
    const [bulkProgress, setBulkProgress] = useState({
        status: "idle",
        processed: 0,
        total: 0,
        approved: 0,
        failed: 0,
        percentage: 0
    });
    
    const [professors, setProfessors] = useState([
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

useEffect(() => {

    const token =
        localStorage.getItem("admin_token");

    const socket = io(API_BASE_URL, {
        auth: {
            token
        }
    });

    socket.on(
        "bulk_approval_progress",
        (progress) => {

            console.log(
                "Bulk approval progress:",
                progress
            );

            setBulkProgress(progress);
        }
    );

    return () => {

        socket.off(
            "bulk_approval_progress"
        );

        socket.disconnect();

    };

}, []);

const fetchAcademicTerm = async () => {

    try {

        const token =
            localStorage.getItem("admin_token");

        const response = await fetch(`${API_BASE_URL}/api/auth/getAcademicTerm`,
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

const [capacityLoading, setCapacityLoading] =
    useState(false);

const [capacityData, setCapacityData] =
    useState(null);


const SimulateStudents = async () => {
    try {
        console.log("Starting student capacity simulation...");

        const response = await fetch(`${API_BASE_URL}/api/auth/admin/SimulateStudents`,
            {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${localStorage.getItem("admin_token")}`
                }
            }
        );

        const data = await response.json();

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

        return data;

    } catch (error) {

        console.error(
            "SimulateStudents error:",
            error
        );

        throw error;
    }
};

const approvedApplicant = async (student) => {

    try {

        const token =   
            localStorage.getItem("admin_token");

        const response = await fetch(`${API_BASE_URL}/api/auth/admin/applicants/${student.id}/approvedApplicant`,
            {
                method: 'POST',

                headers: {
                    Authorization: `Bearer ${token}`
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

        console.log(data);
        alert("Approved.")
        fetchApplicants();

    } catch (error) {

        console.error(
            "Failed to fetch applicants:",
            error.message
        );

    } finally {

        setLoading(false);

    }

};


const approveAllApplicants = async () => {

    try {

        const token =
            localStorage.getItem("admin_token");

        const pendingCount =
            applicants.filter(
                student =>
                    student.status === "pending"
            ).length;

        if (pendingCount === 0) {
            alert(
                "No pending applicants to approve."
            );
            return;
        }

        setBulkLoading(true);

        setBulkProgress({
            status: "starting",
            processed: 0,
            total: pendingCount,
            approved: 0,
            failed: 0,
            percentage: 0
        });

        console.log(
            `Starting batch approval of ${pendingCount} applicants...`
        );

        const response = await fetch(
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

        await fetchApplicants();

        alert(
            `Finished approving applicants!\n\n` +
            `Approved: ${data.approved}\n` +
            `Failed: ${data.failed || 0}`
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


const fetchApplicants = async () => {

    try {

        const token =
            localStorage.getItem('admin_token');

        const response = await fetch(`${API_BASE_URL}/api/auth/applicants`,
            {
                method: 'GET',

                headers: {
                    Authorization: `Bearer ${token}`
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

        console.log(data);

        setApplicants(data.applicants);

    } catch (error) {

        console.error(
            "Failed to fetch applicants:",
            error.message
        );

    } finally {

        setLoading(false);

    }

};
    
    useEffect(() => {
    fetchApplicants();
    fetchAcademicTerm();
}, []);


//listener to update applicants realtime when someone enrolls
useEffect(() => {
    const token = localStorage.getItem("admin_token");

    const socket = io(API_BASE_URL, {
        auth: {
            token
        }
    });

    const handleNewApplication = (data) => {
        console.log("New application:", data);
        fetchApplicants();
    };

    socket.on("new_application", handleNewApplication);

    return () => {
        socket.off("new_application", handleNewApplication);
        socket.disconnect();
    };
}, []);

useEffect(() => {

    if (!academicTerm?.id) {
        return;
    }

    console.log(
        "term id:",
        academicTerm.id
    );

   //handleCheckCapacity();

}, [academicTerm]);
    

    const approveStudent = (id) => {

        

    };

    const rejectStudent = (id) => {

        

    };

    const approveProfessor = (id) => {

        setProfessors(prev =>
            prev.map(professor =>
                professor.id === id
                    ? {
                        ...professor,
                        status: "approved"
                    }
                    : professor
            )
        );

    };

    const rejectProfessor = (id) => {

        setProfessors(prev =>
            prev.map(professor =>
                professor.id === id
                    ? {
                        ...professor,
                        status: "rejected"
                    }
                    : professor
            )
        );

    };

    
    const pendingStudents = applicants.filter(
        applicant => applicant.status === "pending"
    );

    const pendingProfessors = professors.filter(
        professor => professor.status === "pending"
    );

    return (
<>
        {bulkLoading && (
            <div className="bulk-loading">

                <h2>
                    Approving Applicants...
                </h2>

                <p>
                    {bulkProgress.processed.toLocaleString()}
                    {" / "}
                    {bulkProgress.total.toLocaleString()}
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
                    {bulkProgress.approved.toLocaleString()}
                    {" | "}
                    Failed:{" "}
                    {bulkProgress.failed.toLocaleString()}
                </p>

            </div>
        )}


        <div className="applicants-page" style={{filter: capacityLoading && 'blur(6px)'}}>
            
            <div className="applicants-header">

                <div>
                    <h1>Applicants</h1>

                    <p>
                        Review student and professor applications
                    </p>
                </div>
                
                <div className="applicants-header-right">
                    <div className='a-h-btn'>
                        <button onClick={approveAllApplicants} className="approveAll">Approve All</button>
                        <button onClick={SimulateStudents} className="capacityBtn">Check Capacity</button>
                    </div>

                    <div className="applicant-count">
                    
                    {activeTab === "students"
                        ? pendingStudents.length
                        : pendingProfessors.length
                    }

                    <span> Pending</span>

                    </div>
                </div>

            </div>


            <div className="applicant-tabs">

                <button
                    className={
                        activeTab === "students"
                            ? "active"
                            : ""
                    }
                    onClick={() => setActiveTab("students")}
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
                    onClick={() => setActiveTab("professors")}
                >

                    Professors

                    <span>
                        {pendingProfessors.length}
                    </span>

                </button>

            </div>


            {activeTab === "students" && (

                <div className="applications-list">

                    {applicants.map(student => (


                        <div
                            className={`application-card ${student.status}`}
                            key={student.id}
                        >

                            <div className="applicant-info">

                                <div className="applicant-avatar">

                                    {student.firstname.charAt(0)}

                                </div>


                                <div>

                                    <h2>

                                        {student.firstname}

                                    </h2>

                                    <p>

                                        {student.email}

                                    </p>

                                    <small>

                                        Applied on {student.created_at}

                                    </small>

                                </div>

                            </div>


                            <div className="application-details">

                                <div>

                                    <span>Course</span>

                                    <strong>

                                        <p>{student.program_name}</p>

                                    </strong>

                                </div>


                                <div>

                                    <span>Year Level</span>

                                    <strong>

                                        {student.year_level}

                                    </strong>

                                </div>


                                <div>

                                    <span>Username</span>

                                    <strong>

                                        {student.username}

                                    </strong>

                                </div>

                            </div>


                            <div className="application-actions">

                                {student.status === "pending" && (

                                    <>

                                        <button
                                            className="approve-btn"
                                            onClick={() =>
                                            {
                                                approvedApplicant(student)
                                            }
                                            }
                                        >

                                            Approve & Enroll

                                        </button>


                                        <button
                                            className="reject-btn"
                                            onClick={() =>
                                                rejectStudent(applicants.id)
                                            }
                                        >

                                            Reject

                                        </button>

                                    </>

                                )}


                                {applicants.status === "approved" && (

                                    <span className="approved-status">

                                        ✓ Enrolled

                                    </span>

                                )}


                                {applicants.status === "rejected" && (

                                    <span className="rejected-status">

                                        ✕ Rejected

                                    </span>

                                )}

                                <button className="a-view-btn" onClick={
                                    ()=>setSelectedStudent(student)
                                    }>View</button>

                                

                            </div>

                        </div>

                    ))}

                </div>

            )}

            {selectedStudent && <ApplicantModal 
            selectedStudent={selectedStudent} setSelectedStudent={setSelectedStudent} approved={approvedApplicant}/>}



            {activeTab === "professors" && (

                <div className="applications-list">

                    {professors.map(professor => (

                        <div
                            className={`application-card ${professor.status}`}
                            key={professor.id}
                        >

                            <div className="applicant-info">

                                <div className="applicant-avatar professor">

                                    {professor.name.charAt(0)}

                                </div>


                                <div>

                                    <h2>

                                        {professor.name}

                                    </h2>

                                    <p>

                                        {professor.email}

                                    </p>

                                    <small>

                                        Applied on {professor.date}

                                    </small>

                                </div>

                            </div>


                            <div className="application-details">

                                <div>

                                    <span>Specialization</span>

                                    <strong>

                                        {professor.specialization}

                                    </strong>

                                </div>


                                <div>

                                    <span>Experience</span>

                                    <strong>

                                        {professor.experience}

                                    </strong>

                                </div>


                                <div>

                                    <span>Username</span>

                                    <strong>

                                        {professor.username}

                                    </strong>

                                </div>

                            </div>


                            <div className="application-actions">

                                {professor.status === "pending" && (

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


                                {professor.status === "approved" && (

                                    <span className="approved-status">

                                        ✓ Approved

                                    </span>

                                )}


                                {professor.status === "rejected" && (

                                    <span className="rejected-status">

                                        ✕ Rejected

                                    </span>

                                )}

                            </div>

                        </div>

                    ))}

                </div>

            )}

            
        </div>
    </>

    );

}