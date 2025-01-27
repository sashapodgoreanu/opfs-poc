import React, { useState, useEffect } from "react";
import Modal from "./Modal";
import { openDB } from "idb";

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
  const [modalOpen, setModalOpen] = useState<{
    action: "createFile" | "createFolder" | "openFile" | null;
    placeholder: string;
    title: string;
  } | null>(null);

  const DB_NAME = "fileSystemDB";
  const STORE_NAME = "handles";

  useEffect(() => {
    const loadDirectoryHandle = async () => {
      const db = await openDB(DB_NAME, 1, {
        upgrade(db) {
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME);
          }
        },
      });

      const storedHandle = await db.get(STORE_NAME, "directoryHandle");
      if (storedHandle) {
        try {
          const permission = await storedHandle.queryPermission();
          if (permission === "granted") {
            setDirectoryHandle(storedHandle);
            const contents = await fetchDirectoryContents(storedHandle);
            setFileSystem(contents);
          }
        } catch (error) {
          console.error("Errore nel recupero del handle:", error);
        }
      }
    };

    loadDirectoryHandle();
  }, []);

  // Save the directory handle in IndexedDB
  const saveDirectoryHandle = async (handle: FileSystemDirectoryHandle) => {
    const db = await openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      },
    });
    await db.put(STORE_NAME, handle, "directoryHandle");
  };

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
      saveDirectoryHandle(handle);
      const contents = await fetchDirectoryContents(handle);
      setFileSystem(contents);
      setMessage("Cartella caricata con successo!");
    } catch (error: any) {
      console.error("Errore nella selezione della cartella:", error);
      setMessage(`Errore: ${error.message}`);
    }
  };

  // Create a new file or folder
  const handleAction = async (input: string) => {
    if (!directoryHandle || !modalOpen) return;

    try {
      const pathParts = input.split("/");
      const name = pathParts.pop()!;
      let currentHandle = directoryHandle;

      for (const part of pathParts) {
        currentHandle = await currentHandle.getDirectoryHandle(part, {
          create: true,
        });
      }

      if (modalOpen.action === "createFile") {
        await currentHandle.getFileHandle(name, { create: true });
        setMessage(`File creato: ${input}`);
      } else if (modalOpen.action === "createFolder") {
        await currentHandle.getDirectoryHandle(name, { create: true });
        setMessage(`Cartella creata: ${input}`);
      }

      const contents = await fetchDirectoryContents(directoryHandle);
      setFileSystem(contents);
    } catch (error: any) {
      console.error("Errore durante l'azione:", error);
      setMessage(`Errore: ${error.message}`);
    } finally {
      setModalOpen(null);
    }
  };

  // Open a file
  const openFile = async (filePath: string) => {
    if (!directoryHandle) {
      setMessage("Nessuna cartella selezionata.");
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
      setMessage(`File aperto: ${filePath}`);
    } catch (error: any) {
      console.error("Errore nell'apertura del file:", error);
      setMessage(`Errore: ${error.message}`);
    }
  };

  // Save changes to a file
  const saveFile = async () => {
    if (!selectedFile || selectedFile.kind !== "file" || !directoryHandle) {
      setMessage("Nessun file selezionato.");
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
      setMessage(`File salvato: ${selectedFile.name}`);
    } catch (error: any) {
      console.error("Errore nel salvataggio del file:", error);
      setMessage(`Errore: ${error.message}`);
    }
  };

  // Delete a file or folder
  const deleteEntry = async (path: string, kind: "file" | "directory") => {
    if (!directoryHandle) {
      setMessage("Nessuna cartella selezionata.");
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
        `${kind === "directory" ? "Cartella" : "File"} eliminato: ${path}`
      );
    } catch (error: any) {
      console.error(`Errore durante l'eliminazione di ${kind}:`, error);
      setMessage(`Errore: ${error.message}`);
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
              Elimina
            </button>
            <ul>{node.children && renderTree(node.children)}</ul>
          </>
        ) : (
          <>
            📄 {node.name.split("/").pop()}{" "}
            {/* Display only the last part of the path */}
            <button onClick={() => openFile(node.name)}>Apri</button>
            <button onClick={() => deleteEntry(node.name, "file")}>
              Elimina
            </button>
          </>
        )}
      </li>
    ));
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1>File System Access API</h1>
      <button onClick={selectDirectory}>Seleziona cartella</button>
      <button
        onClick={() =>
          setModalOpen({
            action: "createFolder",
            title: "Crea una nuova cartella",
            placeholder:
              "Inserisci il percorso della cartella (es. folder1/folder2)",
          })
        }
      >
        Crea Cartella
      </button>
      <button
        onClick={() =>
          setModalOpen({
            action: "createFile",
            title: "Crea un nuovo file",
            placeholder:
              "Inserisci il percorso del file (es. folder1/folder2/file.txt)",
          })
        }
      >
        Crea File
      </button>
      {selectedFile && (
        <div>
          <h2>Modifica file: {selectedFile.name}</h2>
          <textarea
            value={fileContent}
            onChange={(e) => setFileContent(e.target.value)}
            style={{ width: "100%", height: "200px" }}
          />
          <button onClick={saveFile}>Salva File</button>
        </div>
      )}
      {message && <p>{message}</p>}
      <ul>{renderTree(fileSystem)}</ul>
      {modalOpen && (
        <Modal
          title={modalOpen.title}
          placeholder={modalOpen.placeholder}
          onConfirm={handleAction}
          onCancel={() => setModalOpen(null)}
        />
      )}
    </div>
  );
};

export default FileSystemAccessAPI;
