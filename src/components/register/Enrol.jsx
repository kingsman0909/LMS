import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Enrol.css';
import { API_BASE_URL } from "../../config";

const Enrol = () => {

    const navigate = useNavigate();

    const [loading, setLoading] = useState(false);
    const[programs, setPrograms] = useState([]);

    const [form, setForm] = useState({
        firstname: "",
        middlename: "",
        lastname: "",
        email: "",
        username: "",
        password: "",
        confirmPass: "",
        program_id: "",
        year_level: "",
        phone: "",
        gender: "",
        birthdate: "",
        address: ""
    });

    useEffect(() => {

         const fetchPrograms = async () => {

    try {

        const token = localStorage.getItem("student_token");

        const response = await fetch(`${API_BASE_URL}/api/auth/getPrograms`,
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.message || "Failed to fetch programs"
            );
        }

        setPrograms(data.programs);

    } catch (error) {

        console.error(
            "Failed to fetch programs:",
            error
        );

        alert(
            "Unable to load available programs."
        );
    }
};

        fetchPrograms();

    }, []);


    const handleChange = (e) => {

        const {
            name,
            value
        } = e.target;

        setForm((prevForm) => ({
            ...prevForm,
            [name]: value
        }));

    };


    const passwordMatch =
        form.password === form.confirmPass;


    const handleEnroll = async (e) => {

        e.preventDefault();


        if (form.password !== form.confirmPass) {

            alert("Passwords do not match.");

            return;

        }


        setLoading(true);


        try {

            const response = await fetch(`${API_BASE_URL}/api/auth/enroll`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({

                        firstname: form.firstname,

                        middlename: form.middlename,

                        lastname: form.lastname,

                        email: form.email,

                        username: form.username,

                        password: form.password,

                        program_id: form.program_id,

                        year_level: form.year_level,

                        phone: form.phone,

                        gender: form.gender,

                        birthdate: form.birthdate,

                        address: form.address

                    })

                }

            );


            const data = await response.json();


            if (!response.ok) {

                alert(
                    data.message ||
                    "Application failed."
                );

                return;

            }


            alert(
                data.message ||
                "Your enrollment application has been submitted."
            );


            setForm({

                firstname: "",
                middlename: "",
                lastname: "",
                email: "",
                username: "",
                password: "",
                confirmPass: "",
                program_id: "",
                year_level: "",
                phone: "",
                gender: "",
                birthdate: "",
                address: ""

            });


            navigate("/");


        } catch (error) {

            console.error(
                "Enrollment error:",
                error
            );

            alert(
                "Unable to connect to the server."
            );

        } finally {

            setLoading(false);

        }

    };


    return (

        <div className="enrol">

            <form
                className="enrol-container"
                onSubmit={handleEnroll}
            >

                <h1>
                    Student Application
                </h1>

                <p className="enrol-description">
                    Submit your information for admin approval.
                </p>


                <div className="e-input">


                    <input
                        type="text"
                        name="firstname"
                        placeholder="First Name"
                        value={form.firstname}
                        onChange={handleChange}
                        required
                    />


                    <input
                        type="text"
                        name="middlename"
                        placeholder="Middle Name"
                        value={form.middlename}
                        onChange={handleChange}
                    />


                    <input
                        type="text"
                        name="lastname"
                        placeholder="Last Name"
                        value={form.lastname}
                        onChange={handleChange}
                        required
                    />


                    <input
                        type="email"
                        name="email"
                        placeholder="Email"
                        value={form.email}
                        onChange={handleChange}
                        required
                    />


                    <input
                        type="text"
                        name="username"
                        placeholder="Username"
                        value={form.username}
                        onChange={handleChange}
                        required
                    />


                    <input
                        type="password"
                        name="password"
                        placeholder="Password"
                        value={form.password}
                        onChange={handleChange}
                        required
                    />


                    <input
                        type="password"
                        name="confirmPass"
                        placeholder="Confirm Password"
                        value={form.confirmPass}
                        onChange={handleChange}
                        required
                    />


                    {!passwordMatch && form.confirmPass && (

                        <p className="password-error">
                            Passwords don't match.
                        </p>

                    )}


                    <select
                        name="program_id"
                        value={form.program_id}
                        onChange={handleChange}
                        required
                    >

                        <option value="">
                            Select Course
                        </option>


                        {programs.map((program) => (

                            <option
                                key={program.id}
                                value={program.id}
                            >

                                {program.program_code}
                                {" - "}
                                {program.program_name}

                            </option>

                        ))}

                    </select>


                    <select
                        name="year_level"
                        value={form.year_level}
                        onChange={handleChange}
                        required
                    >

                        <option value="">
                            Select Year Level
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


                    <input
                        type="tel"
                        name="phone"
                        placeholder="Phone Number"
                        value={form.phone}
                        onChange={handleChange}
                    />


                    <select
                        name="gender"
                        value={form.gender}
                        onChange={handleChange}
                    >

                        <option value="">
                            Select Gender
                        </option>

                        <option value="Male">
                            Male
                        </option>

                        <option value="Female">
                            Female
                        </option>

                        <option value="Other">
                            Other
                        </option>

                    </select>


                    <input
                        type="date"
                        name="birthdate"
                        value={form.birthdate}
                        onChange={handleChange}
                    />


                    <textarea
                        name="address"
                        placeholder="Complete Address"
                        value={form.address}
                        onChange={handleChange}
                    />

                </div>


                <button
                    type="submit"
                    disabled={
                        loading ||
                        !passwordMatch
                    }
                >

                    {loading
                        ? "Submitting Application..."
                        : "Submit Application"
                    }

                </button>

            </form>

        </div>

    );

};

export default Enrol;