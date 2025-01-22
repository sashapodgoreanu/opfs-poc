import React, { useState, useEffect } from "react";

type FileSystemNode = {
  name: string;
  kind: "file" | "directory";
  children?: FileSystemNode[]; // Only for directories
};

const OPFSFileSystem: React.FC = () => {
  const [fileSystem, setFileSystem] = useState<FileSystemNode[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileSystemNode | null>(null);
  const [fileContent, setFileContent] = useState<string>("");
  const [message, setMessage] = useState<string | null>(null);

  // Fetch directory contents recursively
  const fetchDirectoryContents = async (
    directoryHandle: FileSystemDirectoryHandle,
    parentPath: string = ""
  ): Promise<FileSystemNode[]> => {
    const nodes: FileSystemNode[] = [];
    for await (const [name, handle] of directoryHandle.entries()) {
      const fullPath = parentPath ? `${parentPath}/${name}` : name;
      if (handle.kind === "directory") {
        nodes.push({
          name: fullPath,
          kind: "directory",
          children: await fetchDirectoryContents(
            handle as FileSystemDirectoryHandle,
            fullPath
          ),
        });
      } else {
        nodes.push({ name: fullPath, kind: "file" });
      }
    }
    return nodes;
  };

  // Load the root directory
  const loadFileSystem = async () => {
    try {
      const rootHandle = await navigator.storage.getDirectory();
      const rootContent = await fetchDirectoryContents(rootHandle);
      setFileSystem([
        { name: "Root", kind: "directory", children: rootContent },
      ]);
      setMessage("File system loaded successfully!");
    } catch (error: any) {
      console.error("Error loading file system:", error);
      setMessage(`Error: ${error.message}`);
    }
  };

  useEffect(() => {
    loadFileSystem();
  }, []);

  // Create a new file
  const createFile = async (fileName: string) => {
    try {
      const rootHandle = await navigator.storage.getDirectory();
      await rootHandle.getFileHandle(fileName, { create: true });
      loadFileSystem(); // Refresh the file system
      setMessage(`File created: ${fileName}`);
    } catch (error: any) {
      console.error("Error creating file:", error);
      setMessage(`Error: ${error.message}`);
    }
  };

  // Create a new folder
  const createFolder = async (folderName: string) => {
    try {
      const rootHandle = await navigator.storage.getDirectory();
      await rootHandle.getDirectoryHandle(folderName, { create: true });
      loadFileSystem(); // Refresh the file system
      setMessage(`Folder created: ${folderName}`);
    } catch (error: any) {
      console.error("Error creating folder:", error);
      setMessage(`Error: ${error.message}`);
    }
  };

  const createNestedFolder = async (folderPath: string) => {
    try {
      const rootHandle = await navigator.storage.getDirectory();
      const folders = folderPath.split("/");
      let currentHandle = rootHandle;

      for (const folder of folders) {
        currentHandle = await currentHandle.getDirectoryHandle(folder, {
          create: true,
        });
      }

      setMessage(`Folder created: ${folderPath}`);
      loadFileSystem(); // Refresh the file system
    } catch (error: any) {
      console.error("Error creating nested folder:", error);
      setMessage(`Error: ${error.message}`);
    }
  };

  const createFileInFolder = async (filePath: string) => {
    try {
      const rootHandle = await navigator.storage.getDirectory();
      const pathParts = filePath.split("/");
      const fileName = pathParts.pop()!;
      let currentHandle = rootHandle;

      for (const part of pathParts) {
        currentHandle = await currentHandle.getDirectoryHandle(part, {
          create: true,
        });
      }

      await currentHandle.getFileHandle(fileName, { create: true });
      setMessage(`File created: ${filePath}`);
      loadFileSystem(); // Refresh the file system
    } catch (error: any) {
      console.error("Error creating file in folder:", error);
      setMessage(`Error: ${error.message}`);
    }
  };

  const handleFileSelect = async (filePath: string) => {
    try {
      const rootHandle = await navigator.storage.getDirectory();
      const pathParts = filePath.split("/"); // Split the path into folders and file
      const fileName = pathParts.pop()!; // Extract the file name
      let currentHandle = rootHandle;

      // Traverse through the directories
      for (const part of pathParts) {
        currentHandle = await currentHandle.getDirectoryHandle(part);
      }

      // Get the file handle and read its content
      const fileHandle = await currentHandle.getFileHandle(fileName);
      const file = await fileHandle.getFile();
      const content = await file.text();

      // Update the selected file and content
      setSelectedFile({ name: filePath, kind: "file" });
      setFileContent(content);
      setMessage(`Loaded file: ${filePath}`);
    } catch (error: any) {
      console.error("Error loading file:", error);
      setMessage(`Error: ${error.message}`);
    }
  };

  const handleFileSave = async () => {
    if (!selectedFile || selectedFile.kind !== "file") return;
    try {
      const rootHandle = await navigator.storage.getDirectory();
      const fileHandle = await rootHandle.getFileHandle(selectedFile.name, {
        create: true,
      });
      const writable = await fileHandle.createWritable();
      await writable.write(fileContent);
      await writable.close();
      setMessage(`File saved: ${selectedFile.name}`);
    } catch (error: any) {
      console.error("Error saving file:", error);
      setMessage(`Error: ${error.message}`);
    }
  };

  const handleDelete = async (filePath: string, kind: "file" | "directory") => {
    try {
      const rootHandle = await navigator.storage.getDirectory();
      const pathParts = filePath.split("/"); // Split the full path into parts
      const itemName = pathParts.pop()!; // Extract the name of the file or folder
      let currentHandle = rootHandle;

      // Traverse to the parent directory
      for (const part of pathParts) {
        currentHandle = await currentHandle.getDirectoryHandle(part);
      }

      // Remove the file or folder
      await currentHandle.removeEntry(itemName, {
        recursive: kind === "directory",
      });
      loadFileSystem(); // Refresh the file system tree
      setMessage(
        `${kind === "directory" ? "Folder" : "File"} deleted: ${filePath}`
      );
    } catch (error: any) {
      console.error(`Error deleting ${kind}:`, error);
      setMessage(`Error deleting ${kind}: ${error.message}`);
    }
  };

  const renderTree = (nodes: FileSystemNode[]) => {
    return nodes.map((node) => {
      const displayName = node.name.split("/").pop(); // Display only the last segment of the path
      return (
        <li key={node.name}>
          {node.kind === "directory" ? (
            <>
              📁 {displayName}
              {/* Skip delete button for the root directory */}
              {node.name !== "Root" && (
                <button
                  onClick={() => handleDelete(node.name, "directory")}
                  style={{
                    marginLeft: "10px",
                    cursor: "pointer",
                    color: "red",
                  }}
                >
                  Delete
                </button>
              )}
              <ul>{node.children && renderTree(node.children)}</ul>
            </>
          ) : (
            <>
              📄 {displayName}
              <button
                onClick={() => handleFileSelect(node.name)}
                style={{ marginLeft: "10px", cursor: "pointer" }}
              >
                Open
              </button>
              <button
                onClick={() => handleDelete(node.name, "file")}
                style={{ marginLeft: "10px", cursor: "pointer", color: "red" }}
              >
                Delete
              </button>
            </>
          )}
        </li>
      );
    });
  };

  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h1>Origin Private File System</h1>
      {/* Buttons for creating folders and files */}
      <button
        onClick={() =>
          createNestedFolder(
            prompt("Enter folder path (e.g., folder1/folder2):") || ""
          )
        }
        style={{ marginRight: "10px", padding: "10px 20px" }}
      >
        Create Nested Folder
      </button>
      <button
        onClick={() =>
          createFileInFolder(
            prompt("Enter file path (e.g., folder1/file.txt):") || ""
          )
        }
        style={{ marginRight: "10px", padding: "10px 20px" }}
      >
        Create File in Folder
      </button>
      <button onClick={loadFileSystem} style={{ padding: "10px 20px" }}>
        Refresh
      </button>

      {message && (
        <p style={{ marginTop: "10px", color: "green" }}>{message}</p>
      )}

      {/* File system tree */}
      <ul style={{ listStyleType: "none", marginTop: "20px" }}>
        {renderTree(fileSystem)}
      </ul>

      {/* File editor */}
      {selectedFile && selectedFile.kind === "file" && (
        <div
          style={{
            marginTop: "20px",
            borderTop: "1px solid #ddd",
            paddingTop: "20px",
          }}
        >
          <h2>Edit File: {selectedFile.name}</h2>
          <textarea
            value={fileContent}
            onChange={(e) => setFileContent(e.target.value)}
            style={{
              width: "100%",
              height: "200px",
              marginBottom: "10px",
              padding: "10px",
              fontFamily: "monospace",
              fontSize: "14px",
            }}
          />
          <br />
          <button
            onClick={handleFileSave}
            style={{
              padding: "10px 20px",
              backgroundColor: "#4CAF50",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
            }}
          >
            Save
          </button>
        </div>
      )}
    </div>
  );
};

export default OPFSFileSystem;
