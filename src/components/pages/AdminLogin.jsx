import React, { useState } from 'react';
import '../../styles/AdminLogin.css';

import {
    HiUser,
    HiLockClosed,
    HiEye,
    HiEyeOff
} from 'react-icons/hi';

import { useNavigate } from 'react-router-dom';

const AdminLogin = () => {

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const navigate = useNavigate();


    const handleLogin = async (e) => {

        e.preventDefault();

        setError('');
        setLoading(true);

        try {

            const response = await fetch(
                'http://localhost:3000/api/auth/admin/login',
                {
                    method: 'POST',

                    headers: {
                        'Content-Type': 'application/json'
                    },

                    body: JSON.stringify({
                        username,
                        password
                    })
                }
            );


            const data = await response.json();

            if (!response.ok) {

                setError(
                    data.message || 'Invalid admin credentials'
                );

                return;

            }


            // Important:
            // Verify that the account is really an admin

            if (data.user?.role !== 'admin') {

                setError(
                    'This account does not have administrator access.'
                );

                return;

            }


            console.log("log ", data.user.role);
            
            localStorage.setItem(`${data.user.role}_token`,data.token);

            navigate('/admin');


        } catch (error) {

            console.error(error);

            setError(
                'Unable to connect to the server.'
            );

        } finally {

            setLoading(false);

        }

    };


    return (

        <div className="admin-login">


            {/* BACKGROUND DECORATION */}

            <div className="admin-orb admin-orb-one"></div>

            <div className="admin-orb admin-orb-two"></div>


            {/* LOGIN CARD */}

            <div className="admin-login-card">


                {/* HEADER */}

                <div className="admin-login-header">

                    <div className="admin-login-logo">

                        LMS

                    </div>


                    <span className="admin-label">

                        ADMINISTRATOR ACCESS

                    </span>


                    <h1>

                        Welcome back

                    </h1>


                    <p>

                        Sign in to manage your learning system.

                    </p>

                </div>


                {/* ERROR */}

                {error && (

                    <div className="admin-login-error">

                        {error}

                    </div>

                )}


                {/* FORM */}

                <form
                    className="admin-login-form"
                    onSubmit={handleLogin}
                >


                    {/* USERNAME */}

                    <div className="admin-input-group">

                        <label>

                            Username

                        </label>


                        <div className="admin-input-wrapper">

                            <HiUser />


                            <input

                                type="text"

                                placeholder="Enter admin username"

                                value={username}

                                onChange={(e) =>
                                    setUsername(e.target.value)
                                }

                                required

                            />

                        </div>

                    </div>


                    {/* PASSWORD */}

                    <div className="admin-input-group">

                        <label>

                            Password

                        </label>


                        <div className="admin-input-wrapper">

                            <HiLockClosed />


                            <input

                                type={
                                    showPassword
                                        ? 'text'
                                        : 'password'
                                }

                                placeholder="Enter password"

                                value={password}

                                onChange={(e) =>
                                    setPassword(e.target.value)
                                }

                                required

                            />


                            <button

                                type="button"

                                className="show-password"

                                onClick={() =>
                                    setShowPassword(!showPassword)
                                }

                            >

                                {showPassword
                                    ? <HiEyeOff />
                                    : <HiEye />
                                }

                            </button>

                        </div>

                    </div>


                    {/* SUBMIT */}

                    <button

                        type="submit"

                        className="admin-login-button"

                        disabled={loading}

                    >

                        {loading
                            ? 'Authenticating...'
                            : 'Sign in as Administrator'
                        }

                    </button>


                </form>


                {/* FOOTER */}

                <div className="admin-login-footer">

                    <span>

                        Authorized personnel only

                    </span>


                    <button
                        onClick={() => navigate('/')}
                    >

                        Back to LMS

                    </button>

                </div>

            </div>

        </div>

    );

};

export default AdminLogin;