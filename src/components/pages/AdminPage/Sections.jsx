import { useState, useEffect } from "react";
import './styles/Sections.css';

const Sections = ({term}) => {

    const [sections, setSections] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [subjects, setSubjects] = useState([]);

    const [section, setSection] = useState({
        subject_id: "",
        section_name: "",
        room: "",
        day: "Monday",
        start_time: "",
        end_time: "",
        capacity: 40
    });

    useEffect(() => {
        fetchSections();
        fetchSubjects();
    }, []);

    const fetchSections = async () => {
        try {
        const token = localStorage.getItem('admin_token');

        const response = await fetch(
            'http://localhost:3000/api/auth/admin/getSections',
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
        setSections(data.sections);
    } catch (error) {
        console.error("hello");
    }
    };

    const handleChange = (e) => {
        setSection({
            ...section,
            [e.target.name]: e.target.value
        });

        console.log("kainis na", section)
    };

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

    

    const createSection = async(e) => {
        e.preventDefault();

    try {
        const token = localStorage.getItem('admin_token');

        console.log("kapagod na", section)
        const response = await fetch(
            "http://localhost:3000/api/auth/admin/createSections",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(section),
            }
        );

        
        const data = await response.json();

        if (response.ok) {

            alert(data.message);

            setSection({
                subject_id: "",
                section_name: "",
                room: "",
                day: "Monday",
                start_time: "",
                end_time: "",
                capacity: 40
            });

            setShowModal(false);
            fetchSections();

        } else {

            alert(data.message, "haha");

        }

    } catch (error) {
        console.error(error);
        alert("Unable to connect to the server.");
    }

    };

    return (
        <div className="sections-container">

            <div className="sections-header">

                <h2>Sections</h2>

                <button
                    onClick={() => setShowModal(true)}
                >
                    + Create Section
                </button>

            </div>

            <table>

                <thead>

                    <tr>

                        <th>Subject</th>
                        <th>Section</th>
                        <th>Academic Term</th>
                        <th>Schedule</th>
                        <th>Room</th>
                        <th>Capacity</th>
                        <th>Status</th>
                        <th>Action</th>

                    </tr>

                </thead>

                <tbody>

                    {sections.map(section => (

                        <tr key={section.id}>

                            <td>{section.subject_name}</td>

                            <td>{section.section_name}</td>

                            <td>
                                {section.school_year}
                                <br />
                                {section.semester}
                            </td>

                            <td>
                                {section.day} <br />
                                {section.start_time} - {section.end_time}
                            </td>

                            <td>{section.room}</td>

                            <td>{section.capacity}</td>

                            <td>{section.status}</td>

                            <td>

                                <button>Edit</button>

                                <button>Delete</button>

                            </td>

                        </tr>

                    ))}

                </tbody>

            </table>

            {showModal && (

                <div className="modal">

                    <form
                        className="modal-content"
                        onSubmit={createSection}
                    >

                        <h2>Create Section</h2>

                        <select
                            name="subject_id"
                            value={section.subject_id}
                            onChange={handleChange}
                        >

                            <option value="">
                                Select Subject
                            </option>

                            {subjects.map(subject => (

                                <option
                                    key={subject.id}
                                    value={subject.id}
                                >
                                    {subject.subject_code} - {subject.subject_name}
                                </option>

                            ))}

                        </select>

                        <input
                            name="section_name"
                            placeholder="Section Name"
                            onChange={handleChange}
                        />

                        <input
                            name="room"
                            placeholder="Room"
                            onChange={handleChange}
                        />

                        <select
                            name="day"
                            onChange={handleChange}
                        >
                            <option>Monday</option>
                            <option>Tuesday</option>
                            <option>Wednesday</option>
                            <option>Thursday</option>
                            <option>Friday</option>
                            <option>Saturday</option>
                        </select>

                        <input
                            type="time"
                            name="start_time"
                            onChange={handleChange}
                        />

                        <input
                            type="time"
                            name="end_time"
                            onChange={handleChange}
                        />

                        <input
                            type="number"
                            name="capacity"
                            placeholder="capacity"
                            value={section.capacity}
                            onChange={handleChange}
                        />


                        <div className="modal-buttons">

                            <button type="submit">
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

export default Sections;