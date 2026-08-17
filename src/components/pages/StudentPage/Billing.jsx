import React from "react";
import "../../../styles/StudentPage.css";
import {
  FiCreditCard,
  FiDollarSign,
  FiCheckCircle,
  FiClock,
} from "react-icons/fi";

const Billing = () => {
  return (
    <div className="billing-page">

      <div className="page-header">
        <div>
          <h1>Billing</h1>
          <p>Manage your tuition and payment information.</p>
        </div>

        <button className="payment-btn">
          Make Payment
        </button>
      </div>

      <div className="billing-summary">

        <div className="billing-card">
          <div className="billing-icon">
            <FiDollarSign />
          </div>

          <div>
            <span>Total Balance</span>
            <h2>₱25,000</h2>
          </div>
        </div>

        <div className="billing-card">
          <div className="billing-icon">
            <FiCheckCircle />
          </div>

          <div>
            <span>Amount Paid</span>
            <h2>₱15,000</h2>
          </div>
        </div>

        <div className="billing-card">
          <div className="billing-icon">
            <FiClock />
          </div>

          <div>
            <span>Remaining Balance</span>
            <h2>₱10,000</h2>
          </div>
        </div>

      </div>

      <div className="payment-history">

        <h2>Payment History</h2>

        <div className="payment-row">
          <div>
            <h3>Tuition Fee - 1st Installment</h3>
            <p>July 10, 2026</p>
          </div>

          <strong>₱15,000</strong>

          <span className="paid">
            Paid
          </span>
        </div>

      </div>

    </div>
  );
};

export default Billing;