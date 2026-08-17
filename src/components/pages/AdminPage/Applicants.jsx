import { useState, useEffect } from "react";
import "./styles/Applicants.css";
import ApplicantModal from "./ApplicantComp/ApplicantModal";

export default function AdminApplicants() {

    const [selectedStudent, setSelectedStudent] = useState(null);
    const [activeTab, setActiveTab] = useState("students");

    const [applicants, setApplicants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCapacityModal, setShowCapacityModal] =
    useState(false);
    const [capacities, setCapacities] = useState([]);
    const [capacityLoading, setCapacityLoading] = useState(true);
    const [academicTerm, setAcademicTerm] = useState(null);
    
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

    const fetchAcademicTerm = async () => {

    try {

        const token =
            localStorage.getItem("admin_token");

        const response = await fetch(
            "http://localhost:3000/api/auth/getAcademicTerm",
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

const handleCheckCapacity = async () => {

    if (!academicTerm?.id) {

        alert(
            "No active academic term found."
        );

        return;
    }

    try {

        setCapacityLoading(true);

        setShowCapacityModal(true);

        const token =
            localStorage.getItem("admin_token");

        const response = await fetch(
        `http://localhost:3000/api/auth/admin/checkEnrollmentCapacity?programId=${programId}&yearLevel=${yearLevel}&academicTermId=${academicTerm.id}&pendingApplicants=${pendingApplicants}`,
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
            "Enrollment capacities:",
            data
        );

        if (!response.ok) {
            throw new Error(
                data.message ||
                "Failed to fetch capacity."
            );
        }

        setCapacities(
            data.capacities || []
        );

    } catch (error) {

        console.error(
            "Capacity error:",
            error
        );

        setCapacities([]);

    } finally {

        setCapacityLoading(false);
    }
};
    const approvedApplicant = async (student) => {

    try {

        const token =   
            localStorage.getItem("admin_token");

        const response = await fetch(
            `http://localhost:3000/api/auth/admin/applicants/${student.id}/approvedApplicant`,
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

        // Get current applicants
        const applicantsToApprove = applicants.filter(
            student => student.status === "pending"
        );

        console.log(
            `Starting approval of ${applicantsToApprove.length} applicants...`
        );

        for (let i = 0; i < applicantsToApprove.length; i++) {

            const student = applicantsToApprove[i];

            console.log(
                `Approving ${i + 1}/${applicantsToApprove.length}:`,
                student.email
            );

            const response = await fetch(
                `http://localhost:3000/api/auth/admin/applicants/${student.id}/approvedApplicant`,
                {
                    method: "POST",

                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            const data = await response.json();

            if (!response.ok) {

                console.error(
                    `Failed applicant ${student.id}:`,
                    data.message
                );

                // Continue to next applicant
                continue;
            }

            console.log(
                `Approved ${i + 1}/${applicantsToApprove.length}`
            );
        }

        alert("Finished approving applicants!");

        fetchApplicants();

    } catch (error) {

        console.error(
            "Approve all error:",
            error
        );

    } finally {

        setLoading(false);

    }
};

    const fetchApplicants = async () => {

    try {

        const token =
            localStorage.getItem('admin_token');

        const response = await fetch(
            'http://localhost:3000/api/auth/applicants',
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

        <div className="applicants-page">

            <div className="applicants-header">

                <div>
                    <h1>Applicants</h1>

                    <p>
                        Review student and professor applications
                    </p>
                </div>
                <button onClick={approveAllApplicants}>Approve All</button>
                
                <div className="applicant-count">
                    
                    {activeTab === "students"
                        ? pendingStudents.length
                        : pendingProfessors.length
                    }

                    <span> Pending</span>

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

                                <button className="view-btn" onClick={
                                    ()=>setSelectedStudent(student)
                                    }>View</button>

                                

                            </div>

                        </div>

                    ))}

                </div>

            )}

            {selectedStudent && <ApplicantModal 
            selectedStudent={selectedStudent} setSelectedStudent={setSelectedStudent} />}



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

    );

}