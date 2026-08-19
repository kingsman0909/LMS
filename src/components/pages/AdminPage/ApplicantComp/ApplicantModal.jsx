import React from 'react'
import './Modal.css';
const ApplicantModal = ({selectedStudent, setSelectedStudent, approved}) => {
    
    const approve = (student) => {
        setSelectedStudent(null);
        approved(student);
    }
  return (
    <div>
      
    <div className="applicant-model-overlay">

        <div className="applicant-model">

            <div className="applicant-model-header">
                <div>
                    <span className="applicant-label">
                        STUDENT APPLICATION
                    </span>

                    <h2>
                        {selectedStudent.firstname}{" "}
                        {selectedStudent.middlename}{" "}
                        {selectedStudent.lastname}
                    </h2>
                </div>

                <h2
                    className="close-model"
                    onClick={() => setSelectedStudent(null)}
                >
                    ×
                </h2>
            </div>

            <div className="applicant-profile">
                <div className="student-avatar">
                    {selectedStudent.firstname?.charAt(0)}
                    {selectedStudent.lastname?.charAt(0)}
                </div>

                <div>
                    <h3>
                        {selectedStudent.firstname}{" "}
                        {selectedStudent.lastname}
                    </h3>

                    <p>
                        @{selectedStudent.username}
                    </p>

                    <span
                        className={`status-badge ${selectedStudent.status}`}
                    >
                        {selectedStudent.status}
                    </span>
                </div>
            </div>

            {/* Personal Information */}
            <section className="applicant-section">
                <h3>Personal Information</h3>

                <div className="applicant-info-grid">

                    <div className="info-item">
                        <span>First Name</span>
                        <strong>
                            {selectedStudent.firstname}
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
                            {selectedStudent.lastname}
                        </strong>
                    </div>

                    <div className="info-item">
                        <span>Gender</span>
                        <strong>
                            {selectedStudent.gender}
                        </strong>
                    </div>

                    <div className="info-item">
                        <span>Birthdate</span>
                        <strong>
                            {new Date(
                                selectedStudent.birthdate
                            ).toLocaleDateString()}
                        </strong>
                    </div>

                    <div className="info-item">
                        <span>Address</span>
                        <strong>
                            {selectedStudent.address}
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
                            {selectedStudent.email}
                        </strong>
                    </div>

                    <div className="info-item">
                        <span>Phone</span>
                        <strong>
                            {selectedStudent.phone}
                        </strong>
                    </div>

                    <div className="info-item">
                        <span>Username</span>
                        <strong>
                            {selectedStudent.username}
                        </strong>
                    </div>

                </div>
            </section>

            {/* Academic Information */}
            <section className="applicant-section">
                <h3>Academic Information</h3>

                <div className="applicant-info-grid">

                    <div className="info-item">
                        <span>Course Code</span>
                        <strong>
                            {selectedStudent.course_code}
                        </strong>
                    </div>

                    <div className="info-item">
                        <span>Course</span>
                        <strong>
                            {selectedStudent.course_name}
                        </strong>
                    </div>

                    <div className="info-item">
                        <span>Year Level</span>
                        <strong>
                            Year {selectedStudent.year_level}
                        </strong>
                    </div>

                    <div className="info-item">
                        <span>Section</span>
                        <strong>
                            {selectedStudent.section}
                        </strong>
                    </div>

                </div>
            </section>

            {/* Actions */}
            <div className="applicant-model-actions">

                <button className="m-reject-btn">
                    Reject
                </button>

                <button className="m-approve-btn" onClick={()=>{approve(selectedStudent)}}>
                    Approve
                </button>

            </div>

        </div>

    </div>
    </div>
  )
}

export default ApplicantModal
