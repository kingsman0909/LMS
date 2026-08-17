import React from 'react'
import './styles/AllPrograms.css';
import { useState, useEffect } from 'react';

const AllPrograms = () => {
  

const [programs, setPrograms] = useState([]);
const [program, setProgram] = useState({
  program_code: "",
  program_name: "",
  description: ""
});


const [showModal, setShowModal] = useState(false);


    const createProgram = async(e) => {
      e.preventDefault();

      console.log(program);
      if (
          program.program_code.trim() === ""||
          program.program_name.trim() === ""||
          program.description.trim()=== ""
      ) {
          alert("Please fill in all required fields.");
          return;
      }

      try{
        const token = localStorage.getItem("admin_token");

        const response = await fetch(
          "http://localhost:3000/api/auth/admin/createProgram",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(program)
          }
        );

        const data = await response.json();

        if(response.ok){
          alert(data.message);
            setProgram({
            program_code: "",
            program_name: "",
            description: ""
          })
          setShowModal(false);
          await getPrograms();
        }
        else{
          alert(data.message);
        }
      }
      catch(err){
        alert("Something went wrong in creating programs")
      }
    }


    const getPrograms = async () => {
      try{
        const response = await fetch(
        "http://localhost:3000/api/auth/getPrograms"
        );

        const data = await response.json();
        console.log("getting programs", data)
        if(response.ok){
          setPrograms(data.programs);
        }
        else{
          alert("error in getting programs");
        }
      }
      catch(err){
        alert("something went wrong in getting programs.");
      }
  }

  useEffect(()=>{
    getPrograms();
  }, []);

  const handleChange = (e) => {
        setProgram({
            ...program,
            [e.target.name]: e.target.value
        });
    };

  return (
    <div className='a-program'>
      <div className='program-top'>
        <h2>Programs</h2>
        <p>Manage all the programs</p>
        <div className='total-program'>
          <div className='total-card'>
            <p>Total Program</p>
            <h2>3</h2>
          </div>
          <button onClick={()=> setShowModal(true)}>+ Add Program</button>
        </div>
      </div>

      <div className='program-bot'>
        <section className='program-content'>
          <table className="program-table">
            <thead>
                <tr>
                    <th>Program Code</th>
                    <th>Program Name</th>
                    <th>Description</th>
                    <th>Status</th>
                    <th>Actions</th>
                </tr>
            </thead>

            <tbody>
                {programs.map((program) => (
                    <tr key={program.id}>
                        <td>{program.program_code}</td>
                        <td>{program.program_name}</td>
                        <td>{program.description}</td>
                        <td>
                            <span
                                className={
                                    program.status === "active"
                                        ? "status active"
                                        : "status inactive"
                                }
                            >
                                {program.status}
                            </span>
                        </td>

                        <td>
                            <button>View</button>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
        </section>
      </div>

      {showModal && (

                <div className="modal">

                    <form
                        className="modal-content"
                        onSubmit={createProgram}
                    >

                        <h2>Create Program</h2>

                        <input
                            name="program_code"
                            placeholder="Program Code"
                            onChange={handleChange}
                        />

                        <input
                            name="program_name"
                            placeholder="Program Name"
                            onChange={handleChange}
                        />

                        <textarea
                            name="description"
                            placeholder='Description'
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


  )
}

export default AllPrograms
