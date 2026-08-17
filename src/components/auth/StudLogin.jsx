import React from 'react'
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import '../../styles/Landing.css';
const Stud = (props) => {

  const navigate = useNavigate();
  const [username,setUsername] = useState("");
  const [password,setPassword] = useState("");

  const loginStudent = async (e) => {

        e.preventDefault();
         try {


        const response = await fetch(
            "http://localhost:3000/api/auth/login",
            {
                method: "POST",
                headers:{
                    "Content-Type":"application/json"
                },
                body: JSON.stringify({
                    username: username,
                    password: password
                })
            }
        );


        
        const data = await response.json();
        console.log(data, "loging in student")
        if(response.ok){
          localStorage.setItem(`${data.user.role}_token`,data.token);

          const response = await fetch(
          "http://localhost:3000/api/auth/me",
          {
              headers: {
                  Authorization: `Bearer ${data.token}`
              }
          }
      );

      const meData = await response.json();
      
          navigate('/student');
        }
        else {
          alert("Invalid credentials!")
        }

    } catch(error){

        alert("Connection error!")

    }

    }
  return (
    <form className='login' onSubmit={loginStudent}>
        <h1 onClick={()=>{props.setLogin(false)}}>X</h1>
      <h2>Student</h2>
      <div className='l-input'>
        <label>Username</label>
        <input type='text' placeholder='username' value={username} onChange={(e)=>setUsername(e.target.value)} required/>
        <label>Password</label>
        <input type='password' placeholder='password' value={password} onChange={(e)=>setPassword(e.target.value)} required />
      </div>
      <button type='submit'>Login</button>
    </form>
  )
}

export default Stud
