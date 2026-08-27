import React from 'react'
import '../../styles/Landing.css';
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { API_BASE_URL } from "../../config";

const Prof = (props) => {

  const navigate = useNavigate();
  const [username,setUsername] = useState("");
  const [password,setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const loginProf = async (e) => {
        
        e.preventDefault();
        setLoading(true);
         try {

        const response = await fetch(`${API_BASE_URL}/api/auth/login/prof`,
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

        if(response.ok){
          localStorage.setItem(`${data.user.role}_token`,data.token);

          const response = await fetch(`${API_BASE_URL}/api/auth/me`,
          {
              headers: {
                  Authorization: `Bearer ${data.token}`
              }
          }
      );

      const meData = await response.json();
      console.log("good response", meData.user.role);
          navigate('/profesor');
        }
        else {
          alert("Invalid credentials!")
        }

    } catch(error){
        setLoading(false);
        alert("Connection error!")

    }
    finally{
      setLoading(false);
    }
  }

  return (
    <form className='prof' onSubmit={loginProf}>
      <h1 onClick={()=>{props.setLogin(false)}}>X</h1>
      <h2>Profesor</h2>
      <div className='l-input'>
        <label>username</label>
        <input type='text' placeholder='username' value={username} onChange={(e)=>setUsername(e.target.value)} required/>
        <label>password</label>
        <input type='password' placeholder='password' value={password} onChange={(e)=>setPassword(e.target.value)} required/>
      </div>
      <button type='submit' disabled={loading} className={`${loading ? 'loading':''}`}>
        {
          loading ? 
          <span>Loading</span> :
          <span>Login</span>
        }
      </button>
    </form>
  )
}

export default Prof