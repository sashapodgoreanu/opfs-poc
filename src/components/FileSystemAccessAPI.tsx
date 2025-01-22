import React, { useState } from "react";

type FileSystemNode = {
  name: string;
  kind: "file" | "directory";
  children?: FileSystemNode[];
};

const FileSystemAccessAPI: React.FC = () => {
  const [directoryHandle, setDirectoryHandle] =
    useState<FileSystemDirectoryHandle | null>(null);
  const [fileSystem, setFileSystem] = useState<FileSystemNode[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileSystemNode | null>(null);
  const [fileContent, setFileContent] = useState<string>("");
  const [message, setMessage] = useState<string | null>(null);

  // Traverse directory to get its contents
  const fetchDirectoryContents = async (
    directoryHandle: FileSystemDirectoryHandle,
    parentPath: string = ""
  ): Promise<FileSystemNode[]> => {
    const nodes: FileSystemNode[] = [];
    for await (const [name, handle] of directoryHandle.entries()) {
      const fullPath = parentPath ? `${parentPath}/${name}` : name; // Build the full path
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

  // Allow the user to select a directory
  const selectDirectory = async () => {
    try {
      const handle = await window.showDirectoryPicker();
      setDirectoryHandle(handle);
      const contents = await fetchDirectoryContents(handle);
      setFileSystem(contents);
      setMessage("Directory loaded successfully!");
    } catch (error: any) {
      console.error("Error selecting directory:", error);
      setMessage(`Error: ${error.message}`);
    }
  };

  // Create a new file
  const createFile = async (filePath: string) => {
    if (!directoryHandle) {
      setMessage("No directory selected.");
      return;
    }

    try {
      const pathParts = filePath.split("/");
      const fileName = pathParts.pop()!;
      let currentHandle = directoryHandle;

      for (const part of pathParts) {
        currentHandle = await currentHandle.getDirectoryHandle(part, {
          create: true,
        });
      }

      await currentHandle.getFileHandle(fileName, { create: true });

      const contents = await fetchDirectoryContents(directoryHandle);
      setFileSystem(contents);
      setMessage(`File created: ${filePath}`);
    } catch (error: any) {
      console.error("Error creating file:", error);
      setMessage(`Error: ${error.message}`);
    }
  };

  // Create a new directory
  const createFolder = async (folderPath: string) => {
    if (!directoryHandle) {
      setMessage("No directory selected.");
      return;
    }

    try {
      const folders = folderPath.split("/");
      let currentHandle = directoryHandle;

      for (const folder of folders) {
        currentHandle = await currentHandle.getDirectoryHandle(folder, {
          create: true,
        });
      }

      const contents = await fetchDirectoryContents(directoryHandle);
      setFileSystem(contents);
      setMessage(`Folder created: ${folderPath}`);
    } catch (error: any) {
      console.error("Error creating folder:", error);
      setMessage(`Error: ${error.message}`);
    }
  };

  // Open a file
  const openFile = async (filePath: string) => {
    if (!directoryHandle) {
      setMessage("No directory selected.");
      return;
    }

    try {
      const pathParts = filePath.split("/");
      const fileName = pathParts.pop()!;
      let currentHandle = directoryHandle;

      for (const part of pathParts) {
        currentHandle = await currentHandle.getDirectoryHandle(part);
      }

      const fileHandle = await currentHandle.getFileHandle(fileName);
      const file = await fileHandle.getFile();
      const content = await file.text();

      setSelectedFile({ name: filePath, kind: "file" });
      setFileContent(content);
      setMessage(`Opened file: ${filePath}`);
    } catch (error: any) {
      console.error("Error opening file:", error);
      setMessage(`Error: ${error.message}`);
    }
  };

  // Save changes to a file
  const saveFile = async () => {
    if (!selectedFile || selectedFile.kind !== "file" || !directoryHandle) {
      setMessage("No file selected.");
      return;
    }

    try {
      const pathParts = selectedFile.name.split("/");
      const fileName = pathParts.pop()!;
      let currentHandle = directoryHandle;

      for (const part of pathParts) {
        currentHandle = await currentHandle.getDirectoryHandle(part);
      }

      const fileHandle = await currentHandle.getFileHandle(fileName);
      const writable = await fileHandle.createWritable();
      await writable.write(fileContent);
      await writable.close();
      setMessage(`File saved: ${selectedFile.name}`);
    } catch (error: any) {
      console.error("Error saving file:", error);
      setMessage(`Error: ${error.message}`);
    }
  };

  // Delete a file or folder
  const deleteEntry = async (path: string, kind: "file" | "directory") => {
    if (!directoryHandle) {
      setMessage("No directory selected.");
      return;
    }

    try {
      const pathParts = path.split("/");
      const entryName = pathParts.pop()!;
      let currentHandle = directoryHandle;

      for (const part of pathParts) {
        currentHandle = await currentHandle.getDirectoryHandle(part);
      }

      await currentHandle.removeEntry(entryName, {
        recursive: kind === "directory",
      });

      const contents = await fetchDirectoryContents(directoryHandle);
      setFileSystem(contents);
      setMessage(
        `${kind === "directory" ? "Folder" : "File"} deleted: ${path}`
      );
    } catch (error: any) {
      console.error(`Error deleting ${kind}:`, error);
      setMessage(`Error: ${error.message}`);
    }
  };

  // Render the file system tree
  const renderTree = (nodes: FileSystemNode[]) => {
    return nodes.map((node) => (
      <li key={node.name}>
        {node.kind === "directory" ? (
          <>
            📁 {node.name.split("/").pop()}{" "}
            {/* Display only the last part of the path */}
            <button onClick={() => deleteEntry(node.name, "directory")}>
              Delete
            </button>
            <ul>{node.children && renderTree(node.children)}</ul>
          </>
        ) : (
          <>
            📄 {node.name.split("/").pop()}{" "}
            {/* Display only the last part of the path */}
            <button onClick={() => openFile(node.name)}>Open</button>
            <button onClick={() => deleteEntry(node.name, "file")}>
              Delete
            </button>
          </>
        )}
      </li>
    ));
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1>File System Access API</h1>
      <button onClick={selectDirectory}>Select Directory</button>
      <button
        onClick={() =>
          createFolder(
            prompt("Enter folder path (e.g., folder1/folder2):") || ""
          )
        }
      >
        Create Folder
      </button>
      <button
        onClick={() =>
          createFile(
            prompt("Enter file path (e.g., folder1/folder2/file.txt):") || ""
          )
        }
      >
        Create File
      </button>
      <button
        onClick={() =>
          openFile(
            prompt("Enter file path (e.g., folder1/folder2/file.txt):") || ""
          )
        }
      >
        Open File
      </button>
      {selectedFile && (
        <div>
          <h2>Editing File: {selectedFile.name}</h2>
          <textarea
            value={fileContent}
            onChange={(e) => setFileContent(e.target.value)}
            style={{ width: "100%", height: "200px" }}
          />
          <button onClick={saveFile}>Save File</button>
        </div>
      )}
      {message && <p>{message}</p>}
      <ul>{renderTree(fileSystem)}</ul>
    </div>
  );
};

export default FileSystemAccessAPI;
