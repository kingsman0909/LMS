
import React from "react";
import "./Modal.css";

const ApplicantModal = ({
    selectedStudent,
    onClose
}) => {
    console.log(selectedStudent);

    if (!selectedStudent) return null;

    const handleClose = () => {
        onClose();
    };

    // Handle section whether it's an object or a string
    const sectionName =
        typeof selectedStudent.section === "object" &&
        selectedStudent.section !== null
            ? selectedStudent.section.section_name || "N/A"
            : selectedStudent.section || "N/A"; 

    // Handle course data
    const course =
        selectedStudent.course ||
        selectedStudent.course_name ||
        selectedStudent.course_code ||
        "N/A";

    // Handle enrollment status
    const status =
        selectedStudent.enrollment_status ||
        selectedStudent.status ||
        "N/A";

    // Handle missing birthdate
    const birthdate = selectedStudent.birthdate
        ? new Date(
              selectedStudent.birthdate
          ).toLocaleDateString("en-PH", {
              year: "numeric",
              month: "long",
              day: "numeric"
          })
        : "N/A";

    // Handle profile picture
    const profilePicture =
        selectedStudent.profile_picture || null;

    // Handle student name
    const fullName = [
        selectedStudent.firstname,
        selectedStudent.middlename,
        selectedStudent.lastname
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <div className="applicant-model-overlay">
            <div className="applicant-model">

                {/* Header */}
                <div className="applicant-model-header">
                    <div>
                        <span className="applicant-label">
                            STUDENT INFORMATION
                        </span>

                        <h2>
                            {fullName || "Student Details"}
                        </h2>
                    </div>

                    <h2
                        className="close-model"
                        onClick={handleClose}
                    >
                        ×
                    </h2>
                </div>

                {/* Profile */}
                <div className="applicant-profile">

                    <div className="student-avatar">
                        {profilePicture ? (
                            <img
                                src={profilePicture}
                                alt="Student Profile"
                                className="student-profile-picture"
                            />
                        ) : (
                            <>
                                {selectedStudent.firstname?.charAt(0)}
                                {selectedStudent.lastname?.charAt(0)}
                            </>
                        )}
                    </div>

                    <div>
                        <h3>
                            {fullName || "N/A"}
                        </h3>

                        <p>
                            Student ID:{" "}
                            {selectedStudent.school_student_id ||
                                selectedStudent.student_id ||
                                "N/A"}
                        </p>

                        <span
                            className={`status-badge ${status}`}
                        >
                            {status}
                        </span>
                    </div>
                </div>

                {/* Student Information */}
                <section className="applicant-section">
                    <h3>Student Information</h3>

                    <div className="applicant-info-grid">

                        <div className="info-item">
                            <span>Student ID</span>
                            <strong>
                                {selectedStudent.school_student_id ||
                                    selectedStudent.student_id ||
                                    "N/A"}
                            </strong>
                        </div>

                        <div className="info-item">
                            <span>Enrollment ID</span>
                            <strong>
                                {selectedStudent.enrollment_id ||
                                    "N/A"}
                            </strong>
                        </div>

                        <div className="info-item">
                            <span>First Name</span>
                            <strong>
                                {selectedStudent.firstname || "N/A"}
                            </strong>
                        </div>

                        <div className="info-item">
                            <span>Middle Name</span>
                            <strong>
                                {selectedStudent.middlename || "N/A"}
                            </strong>
                        </div>

                        <div className="info-item">
                            <span>Last Name</span>
                            <strong>
                                {selectedStudent.lastname || "N/A"}
                            </strong>
                        </div>

                    </div>
                </section>

                {/* Academic Information */}
                <section className="applicant-section">
                    <h3>Academic Information</h3>

                    <div className="applicant-info-grid">

                        <div className="info-item">
                            <span>Course</span>
                            <strong>
                                {course}
                            </strong>
                        </div>

                        <div className="info-item">
                            <span>Year Level</span>
                            <strong>
                                {selectedStudent.year_level
                                    ? `Year ${selectedStudent.year_level}`
                                    : "N/A"}
                            </strong>
                        </div>

                        <div className="info-item">
                            <span>Section</span>
                            <strong>
                                {sectionName || student}
                            </strong>
                        </div>

                        <div className="info-item">
                            <span>Enrollment Status</span>
                            <strong>
                                {status}
                            </strong>
                        </div>

                    </div>
                </section>

                {/* Personal Information */}
                <section className="applicant-section">
                    <h3>Personal Information</h3>

                    <div className="applicant-info-grid">

                        <div className="info-item">
                            <span>Gender</span>
                            <strong>
                                {selectedStudent.gender || "N/A"}
                            </strong>
                        </div>

                        <div className="info-item">
                            <span>Birthdate</span>
                            <strong>
                                {birthdate}
                            </strong>
                        </div>

                        <div className="info-item">
                            <span>Address</span>
                            <strong>
                                {selectedStudent.address || "N/A"}
                            </strong>
                        </div>

                    </div>
                </section>

                {/* Contact Information */}
                <section className="applicant-section">
                    <h3>Contact Information</h3>

                    <div className="applicant-info-grid">

                        <div className="info-item">
                            <span>Email</span>
                            <strong>
                                {selectedStudent.email || "N/A"}
                            </strong>
                        </div>

                        <div className="info-item">
                            <span>Phone</span>
                            <strong>
                                {selectedStudent.phone || "N/A"}
                            </strong>
                        </div>

                        <div className="info-item">
                            <span>Username</span>
                            <strong>
                                {selectedStudent.username || "N/A"}
                            </strong>
                        </div>

                    </div>
                </section>

                {/* Actions */}
                <div className="applicant-model-actions">

                    <button
                        className="m-reject-btn"
                        onClick={handleClose}
                    >
                        Close
                    </button>

                </div>

            </div>
        </div>
    );
};

export default ApplicantModal;