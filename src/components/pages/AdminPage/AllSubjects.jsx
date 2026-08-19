import './styles/allSubjects.css';
import { useState, useEffect } from "react";

const allSubjects = ({programs}) => {
    const [subjects, setSubjects] = useState([]);
    const [showModal, setShowModal] = useState(false);

    const [subject, setSubject] = useState({
        subject_code: "",
        subject_name: "",
        description: "",
        units: 3,
        lecture_units: 0,
        lab_units: 0,
        year_level: "",
        semester: "",
        programs: []
    });

    useEffect(() => {
        console.log("fetching subjects")
        fetchSubjects();
    }, []);

    const fetchSubjects = async () => {
        try {
        const token = localStorage.getItem('admin_token');

        const response = await fetch(
            'http://localhost:3000/api/auth/getSubjects',
            {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        const data = await response.json();

        console.log(data);
        if (!response.ok) {
            throw new Error(data.message);
        }
        setSubjects(data.subjects);
    } catch (error) {
        console.error("hello");
    }
    };

    const handleChange = (e) => {
        setSubject({
            ...subject,
            [e.target.name]: e.target.value
        });
    };

    const handleDelete = async (id) => {
        try{
            const token = localStorage.getItem('admin_token');

            const response = await fetch(`http://localhost:3000/api/auth/admin/${id}/deleteSubject`,
                {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`
                    },
                }
            );

            if(response.ok){
                alert("deleted succesfully!")
                fetchSubjects();
            }
        }
        catch(err){
            alert(err.message);
        }
    }

    const createSubject = async (e) => {
        e.preventDefault();
        console.log("creating subject data", subject)
        try {
        const token = localStorage.getItem('admin_token');

        const response = await fetch(
            'http://localhost:3000/api/auth/admin/createSubject',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(subject)
            }
        );

        const data = await response.json();

        alert(data.message);
        setShowModal(false);
        fetchSubjects();

        if (!response.ok) {
            throw new Error(data.message);
        }
    } catch (error) {
        alert(`Error in creating subjects: ${error.message}`);
    }
    };

    return (
        <div className="subjects-container">

            <div className="subjects-header">
                <h2>Subjects</h2>


                <div>
                    <button>
                        + Assign Professor
                    </button>
                    <button
                    onClick={() => setShowModal(true)}
                    >
                        + Add Subject
                    </button>
                </div>
            </div>

            <table>

                <thead>
                    <tr>
                        <th>Code</th>
                        <th>Name</th>
                        <th>Units</th>
                        <th>Year</th>
                        <th>Semester</th>
                        <th>Action</th>
                    </tr>
                </thead>

                <tbody>

                    {subjects.map((sub) => (

                        <tr key={sub.id}>
                            <td>{sub.subject_code}</td>
                            <td>{sub.subject_name}</td>
                            <td>{sub.units}</td>
                            <td>{sub.year_level}</td>
                            <td>{sub.semester}</td>

                            <td>
                                <button>Edit</button>
                                <button onClick={()=>{handleDelete(sub.id)}}>Delete</button>
                            </td>

                        </tr>

                    ))}

                </tbody>

            </table>

            {showModal && (

                <div className="modal">

                    <form
                        className="modal-content"
                        onSubmit={createSubject}
                    >

                        <h2>Add Subject</h2>

                        <input
                            name="subject_code"
                            placeholder="Subject Code"
                            onChange={handleChange}
                        />

                        <input
                            name="subject_name"
                            placeholder="Subject Name"
                            onChange={handleChange}
                        />

                        <textarea
                            name="description"
                            placeholder="Description"
                            onChange={handleChange}
                        />

                        <label>
                            <p>Lab Units</p>
                        </label>
                        <input
                            type="number"
                            name="lab_units"
                            value={subject.lab_units}
                            onChange={handleChange}
                        />

                        <label><p>Lecture Units</p></label>
                        <input
                            type="number"
                            name="lecture_units"
                            value={subject.lecture_units}
                            onChange={handleChange}
                        />

                        <select
                            name="year_level"
                            value={subject.year_level}
                            onChange={handleChange}
                        >
                            <option value="">Select Year Level</option>
                            <option value="1st Year">1st Year</option>
                            <option value="2nd Year">2nd Year</option>
                            <option value="3rd Year">3rd Year</option>
                            <option value="4th Year">4th Year</option>
                        </select>

                        <select
                            name="semester"
                            value={subject.semester}
                            onChange={handleChange}
                        >
                            <option value="">Select Semester</option>
                            <option value="1st Semester">1st Semester</option>
                            <option value="2nd Semester">2nd Semester</option>
                            <option value="Summer">Summer</option>
                        </select>

                        <label style={{color: 'black'}}>Programs</label>
                        <div className="program-checkboxes">
                            {programs.map((program) => (
                                <label key={program.id} className="program-option">
                                    <input
                                        type="checkbox"
                                        value={program.id}
                                        checked={subject.programs.includes(program.id)}
                                        onChange={(e) => {
                                            const programId = Number(e.target.value);

                                            setSubject((prev) => ({
                                                ...prev,
                                                programs: e.target.checked
                                                    ? [...prev.programs, programId]
                                                    : prev.programs.filter(
                                                        (id) => id !== programId
                                                    )
                                            }));
                                        }}
                                    />

                                    <span>{program.program_name}</span>
                                </label>
                            ))}
                        </div>

                        <div className="modal-buttons">

                            <button
                                type="submit"
                            >
                                Save
                            </button>

                            <button
                                type="button"
                                onClick={() => setShowModal(false)}
                            >
                                Cancel
                            </button>

                        </div>

                    </form>

                </div>

            )}

        </div>
    );
};

export default allSubjects;