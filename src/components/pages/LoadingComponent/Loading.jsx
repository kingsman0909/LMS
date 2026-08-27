import React from 'react';
import './Loading.css';

const Loading = (props) => {
  return (
    <div className="loading-wrapper">
      <div className="loading">
        {props.text === "" || props.text === undefined || props.text === null ? (
          <h1>Loading</h1>
        ) : (
          <h1>{props.text}</h1>
        )}

        <div className="loading-animate"></div>
      </div>
    </div>
  );
};

export default Loading;