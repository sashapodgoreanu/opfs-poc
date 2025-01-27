import React, { useState } from "react";

type ModalProps = {
  title: string;
  placeholder: string;
  fields: {
    name: string;
    type: "text" | "number" | "select";
    placeholder?: string;
    options?: string[]; // Only for select type
  }[];
  onConfirm: (input: { [key: string]: any }) => void;
  onCancel: () => void;
};

const Modal: React.FC<ModalProps> = ({
  title,
  fields,
  onConfirm,
  onCancel,
}) => {
  const [formValues, setFormValues] = useState<{ [key: string]: any }>({});

  const handleChange = (field: string, value: any) => {
    setFormValues((prev) => ({ ...prev, [field]: value }));
  };

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
          backgroundColor: "rgb(26, 27, 25)",
          padding: "20px",
          borderRadius: "8px",
          width: "300px",
          boxShadow: "0 2px 10px rgba(0, 0, 0, 0.2)",
        }}
      >
        <h3 style={{ marginBottom: "10px" }}>{title}</h3>

        {fields.map((field) => (
          <div key={field.name} style={{ marginBottom: "10px" }}>
            <label>{field.name}:</label>
            {field.type === "select" ? (
              <select
                value={formValues[field.name] || ""}
                onChange={(e) => handleChange(field.name, e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px",
                  marginTop: "5px",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                }}
              >
                <option value="">Seleziona un'opzione</option>
                {field.options?.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type={field.type}
                placeholder={field.placeholder}
                value={formValues[field.name] || ""}
                onChange={(e) => handleChange(field.name, e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px",
                  marginTop: "5px",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                }}
              />
            )}
          </div>
        ))}

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: "15px",
          }}
        >
          <button
            onClick={() => onConfirm(formValues)}
            style={{
              backgroundColor: "#4CAF50",
              color: "white",
              padding: "8px 12px",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Conferma
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
            Annulla
          </button>
        </div>
      </div>
    </div>
  );
};

export default Modal;
