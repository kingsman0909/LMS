import { useState, useEffect } from "react";

import "../../../styles/Enrollment.css";


const Enrollment = (props) => {

    const [subjects, setSubjects] = useState([]);
    const [sections, setSections] = useState([]);
    const [selectedSubject, setSelectedSubject] = useState(null);
    const [openModal, setOpenModal] = useState(false);
    const [Enroll, setEnroll] = useState({

    });

    useEffect(() => {
        fetchSubjects();
    }, []);



    const fetchSubjects = async () => {
        console.log("getting subjects")
        try {

            const token = localStorage.getItem("student_token");

            const response = await fetch(
                "http://localhost:3000/api/auth/getSubjects",
                {
                    headers:{
                        Authorization:`Bearer ${token}`
                    }
                }
            );

            const data = await response.json();


            if(!response.ok){
                throw new Error(data.message);
            }


            setSubjects(data.subjects);


        } catch(err){

            console.error(err);
            setSubjects([]);

        }
    };



    const fetchSections = async (subjectId) => {

        try {

            const token = localStorage.getItem("student_token");

            const response = await fetch(
                `http://localhost:3000/api/auth/admin/getSectionById/${subjectId}`,
                {
                    headers:{
                        Authorization:`Bearer ${token}`
                    }
                }
            );


            const data = await response.json();

            if(!response.ok){
                throw new Error(data.message);
            }

            setSections(data.sections || []);

        } catch(err){

            console.error(err);

            setSections([]);

        }

    };



    const handleEnroll = async(subject)=>{

        setSelectedSubject(subject);
        await fetchSections(subject.id);

        setOpenModal(true);

    };

    const enrollStudent = async() => {
        try{
            
        }
        catch(err){
            alert("Something error in enrolling student!");
        }
    }



    return (

        <div className="enrollment-container">

            {
                openModal && (

                    <div className="modal-overlay">


                        <div className="modal-box">



                            <div className="modal-header">

                                <h2>
                                    Available Sections
                                </h2>


                                <button
                                    className="close-btn"
                                    onClick={()=>setOpenModal(false)}
                                >
                                    ✕
                                </button>


                            </div>



                            <p className="subject-title">

                                {selectedSubject?.subject_code}
                                {" - "}
                                {selectedSubject?.subject_name}

                            </p>





                            <table className="section-table">


                                <thead>

                                    <tr>

                                        <th>Course Name</th>
                                        <th>Section</th>
                                        <th>Professor</th>
                                        <th>Schedule</th>
                                        <th>Room</th>
                                        <th>Capacity</th>
                                        <th></th>

                                    </tr>


                                </thead>




                                <tbody>


                                    {
                                        sections?.length > 0 ?


                                        (

                                            sections.map(section=>(


                                                <tr key={section.id}>

                                                    <td>
                                                        {selectedSubject.subject_name}
                                                    </td>
                                                    <td>
                                                        {section.section_name}
                                                    </td>


                                                    <td>
                                                        {section.professor_name}
                                                    </td>



                                                    <td>

                                                        {section.day}

                                                        <br/>

                                                        {section.start_time}
                                                        {" - "}
                                                        {section.end_time}

                                                    </td>



                                                    <td>
                                                        {section.room}
                                                    </td>



                                                    <td>
                                                        {section.capacity}
                                                    </td>



                                                    <td>

                                                        <button
                                                            className="select-btn"
                                                            onClick={enrollStudent}
                                                        >
                                                            Select
                                                        </button>


                                                    </td>


                                                </tr>


                                            ))

                                        )


                                        :


                                        (

                                            <tr>

                                                <td colSpan="6">

                                                    No sections yet.
                                                    Please wait for section assignment.

                                                </td>

                                            </tr>


                                        )

                                    }


                                </tbody>


                            </table>


                        </div>


                    </div>


                )

            }






            <div className="enrollment-header">

                <h2>
                    Subject Enrollment
                </h2>


                <p>
                    Select the subjects you want to enroll in this semester.
                </p>


            </div>






            <div className="table-wrapper">


                <table className="subject-table">



                    <thead>

                        <tr>

                            <th>
                                Code
                            </th>

                            <th>
                                Subject
                            </th>

                            <th>
                                Units
                            </th>

                            <th>
                                Year
                            </th>

                            <th>
                                Semester
                            </th>

                            <th>
                                Action
                            </th>

                        </tr>


                    </thead>





                    <tbody>



                        {
                            subjects?.length > 0 ?


                            (

                                subjects.map(subject=>(


                                    <tr key={subject.id}>


                                        <td>
                                            {subject.subject_code}
                                        </td>



                                        <td>
                                            {subject.subject_name}
                                        </td>



                                        <td>
                                            {subject.units}
                                        </td>



                                        <td>
                                            {subject.year_level}
                                        </td>



                                        <td>
                                            {subject.semester}
                                        </td>




                                        <td>


                                            <button

                                                className="enroll-btn"

                                                onClick={()=>handleEnroll(subject)}

                                            >

                                                Enroll

                                            </button>


                                        </td>


                                    </tr>


                                ))


                            )



                            :


                            (

                                <tr>

                                    <td colSpan="6">

                                        No subjects available.

                                    </td>


                                </tr>


                            )


                        }



                    </tbody>



                </table>


            </div>

        </div>
    );

};


export default Enrollment;