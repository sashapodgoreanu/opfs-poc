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
    action: "createFile" | "createFolder";
    title: string;
    placeholder: string;
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

  const handleAction = async (formValues: { [key: string]: any }) => {
    if (!directoryHandle || !modalOpen) return;

    try {
      const modalInput = formValues["Percorso"]; // Recupera il valore del campo "Percorso" dal form
      const pathParts = modalInput.split("/");
      const name = pathParts.pop()!;
      let currentHandle = directoryHandle;

      // Naviga nella struttura delle directory, creando directory intermedie se necessario
      for (const part of pathParts) {
        currentHandle = await currentHandle.getDirectoryHandle(part, {
          create: true,
        });
      }

      // Crea file o cartella a seconda dell'azione selezionata
      if (modalOpen.action === "createFile") {
        await currentHandle.getFileHandle(name, { create: true });
        setMessage(`File creato: ${modalInput}`);
      } else if (modalOpen.action === "createFolder") {
        await currentHandle.getDirectoryHandle(name, { create: true });
        setMessage(`Cartella creata: ${modalInput}`);
      }

      // Aggiorna il file system per riflettere i cambiamenti
      const contents = await fetchDirectoryContents(directoryHandle);
      setFileSystem(contents);
    } catch (error: any) {
      console.error("Errore durante l'azione:", error);
      setMessage(`Errore: ${error.message}`);
    } finally {
      setModalOpen(null);
    }
  };

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

  const renderTree = (nodes: FileSystemNode[]) => {
    return nodes.map((node) => (
      <li key={node.name}>
        {node.kind === "directory" ? (
          <>
            📁 {node.name.split("/").pop()}{" "}
            <button onClick={() => deleteEntry(node.name, "directory")}>
              Elimina
            </button>
            <ul>{node.children && renderTree(node.children)}</ul>
          </>
        ) : (
          <>
            📄 {node.name.split("/").pop()}{" "}
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

      {message && (
        <p style={{ marginTop: "10px", color: "#4caf50" }}>{message}</p>
      )}

      <ul style={{ listStyleType: "none", marginTop: "20px" }}>
        {renderTree(fileSystem)}
      </ul>

      {selectedFile && selectedFile.kind === "file" && (
        <div
          style={{
            marginTop: "20px",
            borderTop: "1px solid #ddd",
            paddingTop: "20px",
          }}
        >
          <h2>Modifica file: {selectedFile.name}</h2>
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
              backgroundColor: "#1a1a1a",
              color: "#fff",
              border: "1px solid #646cff",
              borderRadius: "4px",
            }}
          />
          <button
            onClick={saveFile}
            style={{
              padding: "10px 20px",
              backgroundColor: "#4caf50",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
            }}
          >
            Salva
          </button>
        </div>
      )}

      {modalOpen && (
        <Modal
          title={modalOpen.title}
          placeholder={modalOpen.placeholder}
          fields={[
            {
              name: "Percorso", // Nome del campo
              type: "text", // Tipo di input
              placeholder: modalOpen.placeholder, // Placeholder dinamico
            },
          ]}
          onConfirm={handleAction} // Passa la funzione handleAction
          onCancel={() => {
            setModalOpen(null); // Chiude il modal al click su "Annulla"
          }}
        />
      )}
    </div>
  );
};

export default FileSystemAccessAPI;
