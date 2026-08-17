import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

const ProtectedRoutes = (props) => {
    const [loading, setLoading] = useState(true);
    const [authenticated, setAuthenticated] = useState(false);

    useEffect(()=>{
        
        try{
            const verify = async ()=>{
            const token = localStorage.getItem(`${props.allowedRole}_token`);

            console.log(props.allowedRole, "Logging in");
            if(!token){
                
                
                    setLoading(false);
                    return;
                
            }

            const response = await fetch(
            "http://localhost:3000/api/auth/me",
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );
        
        const data = await response.json();
        if (response.ok && props.allowedRole === data.user.role) {
            setAuthenticated(true);
        } 
        
        else {
            setAuthenticated(false);
        }

        setLoading(false);
        }
        verify();
        }
        catch(err){
            console.log("error in verifying ", err.message);
        }

    }, [props.allowedRole]);

    if(loading){
        return <p>Loading</p>
    }

    if(!authenticated){
        if(props.allowedRole === "admin"){
            return <Navigate to="/admin/login" />
        }
        return <Navigate to='/'/>
    }

    return props.children;
    
}

export default ProtectedRoutes
