import React, { useState } from "react";
import OPFSFileSystem from "./components/OPFSFileSystem";
import FileSystemAccessAPI from "./components/FileSystemAccessAPI";

const App: React.FC = () => {
  const [mode, setMode] = useState<"opfs" | "fsapi">("opfs"); // Default to OPFS

  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h1>File System Explorer Web App</h1>
      <div style={{ marginBottom: "20px" }}>
        <button
          onClick={() => setMode("opfs")}
          style={{
            padding: "10px 20px",
            marginRight: "10px",
            backgroundColor: mode === "opfs" ? "#4CAF50" : "#f0f0f0",
            color: mode === "opfs" ? "white" : "black",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer",
          }}
        >
          Origin Private File System
        </button>
        <button
          onClick={() => setMode("fsapi")}
          style={{
            padding: "10px 20px",
            backgroundColor: mode === "fsapi" ? "#4CAF50" : "#f0f0f0",
            color: mode === "fsapi" ? "white" : "black",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer",
          }}
        >
          File System Access API
        </button>
      </div>

      {mode === "opfs" ? <OPFSFileSystem /> : <FileSystemAccessAPI />}
    </div>
  );
};

export default App;
