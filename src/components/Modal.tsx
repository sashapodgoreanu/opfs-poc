import React, { useState } from "react";

type ModalProps = {
  title: string;
  placeholder: string;
  onConfirm: (input: string) => void;
  onCancel: () => void;
};

const Modal: React.FC<ModalProps> = ({
  title,
  placeholder,
  onConfirm,
  onCancel,
}) => {
  const [input, setInput] = useState("");

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          backgroundColor: "white",
          padding: "20px",
          borderRadius: "8px",
          width: "300px",
          boxShadow: "0 2px 10px rgba(0, 0, 0, 0.2)",
        }}
      >
        <h3 style={{ marginBottom: "10px" }}>{title}</h3>
        <input
          type="text"
          placeholder={placeholder}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          style={{
            width: "100%",
            padding: "8px",
            marginBottom: "10px",
            border: "1px solid #ccc",
            borderRadius: "4px",
          }}
        />
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <button
            onClick={() => onConfirm(input)}
            style={{
              backgroundColor: "#4CAF50",
              color: "white",
              padding: "8px 12px",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Confirm
          </button>
          <button
            onClick={onCancel}
            style={{
              backgroundColor: "#f44336",
              color: "white",
              padding: "8px 12px",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default Modal;
