import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { API_BASE_URL } from "../../config";
import Loading from '../pages/LoadingComponent/Loading'

const ProtectedRoutes = (props) => {
    const [loading, setLoading] = useState(true);
    const [authenticated, setAuthenticated] = useState(false);
    const token = localStorage.getItem(`${props.allowedRole}_token`);
    useEffect(()=>{

        try{
            const verify = async ()=>{
            

            console.log(props.allowedRole, "Logging in");
            if(!token){
                
                
                    setLoading(false);
                    return;
                
            }

            const response = await fetch(`${API_BASE_URL}/api/auth/me`,
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
            alert(err.message)
            setLoading(false);

        }

    }, [props.allowedRole]);


    if(loading && token){
        console.log("loading", props.allowedRole)
        return <Loading text={`Loading ${props.allowedRole}`}/>
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