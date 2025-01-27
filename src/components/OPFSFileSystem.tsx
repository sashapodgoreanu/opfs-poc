import React, { useState, useEffect } from "react";
import Modal from "./Modal";

type FileSystemNode = {
  name: string;
  kind: "file" | "directory" | "bucket";
  children?: FileSystemNode[]; // Only for directories or buckets
  location: "bucket" | "root"; // Specifies whether the node belongs to a bucket or the root
};

type BucketOptions = {
  bucketName?: string;
  durability?: "strict" | "relaxed";
  quota?: number;
  expires?: number;
};

const OPFSFileSystem: React.FC = () => {
  const [fileSystem, setFileSystem] = useState<FileSystemNode[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileSystemNode | null>(null);
  const [fileContent, setFileContent] = useState<string>("");
  const [message, setMessage] = useState<string | null>(null);
  const [modalFields, setModalFields] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState<{
    action: "createFile" | "createFolder";
    title: string;
  } | null>(null);
  const [bucketModalOpen, setBucketModalOpen] = useState(false);
  const [buckets, setBuckets] = useState<string[]>([]);

  const fetchDirectoryContents = async (
    directoryHandle: FileSystemDirectoryHandle,
    parentPath: string = "",
    location: "bucket" | "root"
  ): Promise<FileSystemNode[]> => {
    const nodes: FileSystemNode[] = [];
    for await (const [name, handle] of directoryHandle.entries()) {
      const fullPath = parentPath ? `${parentPath}/${name}` : name;
      if (handle.kind === "directory") {
        nodes.push({
          name: fullPath,
          kind: "directory",
          location,
          children: await fetchDirectoryContents(
            handle as FileSystemDirectoryHandle,
            fullPath,
            location
          ),
        });
      } else {
        nodes.push({ name: fullPath, kind: "file", location });
      }
    }
    return nodes;
  };

  const fetchBucketContents = async (
    bucketName: string
  ): Promise<FileSystemNode[]> => {
    try {
      const bucketHandle = await navigator.storageBuckets.open(bucketName);
      const directoryHandle = await bucketHandle.getDirectory();
      return await fetchDirectoryContents(directoryHandle, "", "bucket");
    } catch (error: any) {
      console.error(
        `Errore durante il caricamento del bucket ${bucketName}:`,
        error
      );
      return [];
    }
  };

  const loadFileSystem = async () => {
    try {
      const rootHandle = await navigator.storage.getDirectory();
      const rootContent = await fetchDirectoryContents(rootHandle, "", "root");
      const existingBuckets = await navigator.storageBuckets.keys();

      const bucketContents = await Promise.all(
        existingBuckets.map(async (bucket) => {
          const children = await fetchBucketContents(bucket);
          return { name: bucket, kind: "bucket", location: "bucket", children };
        })
      );

      setBuckets(existingBuckets);
      setFileSystem([
        {
          name: "Root",
          kind: "directory",
          location: "root",
          children: rootContent,
        },
        ...bucketContents,
      ]);
      setMessage("File system caricato con successo!");
    } catch (error: any) {
      console.error("Errore durante il caricamento del file system:", error);
      setMessage(`Errore: ${error.message}`);
    }
  };

  useEffect(() => {
    loadFileSystem();
  }, []);

  const createBucket = async (name: string, options?: BucketOptions) => {
    try {
      await navigator.storageBuckets.open(name, {
        durability: options?.durability || "strict",
        expires: options?.expires
          ? Date.now() + options.expires * 1000
          : undefined,
        quota: options?.quota || undefined,
      });

      setBuckets((prev) => [...prev, name]);
      setMessage(`Bucket creato: ${name}`);
      loadFileSystem();
    } catch (error: any) {
      console.error("Errore durante la creazione del bucket:", error);
      setMessage(`Errore: ${error.message}`);
    }
  };

  const deleteEntry = async (
    fullPath: string,
    kind: "file" | "directory" | "bucket",
    location: "bucket" | "root"
  ) => {
    try {
      let rootHandle;

      if (kind === "bucket") {
        // Eliminazione di un bucket
        await navigator.storageBuckets.delete(fullPath);
        setBuckets((prev) => prev.filter((bucket) => bucket !== fullPath));
        setMessage(`Bucket eliminato: ${fullPath}`);
      } else {
        // Eliminazione di file o directory
        if (location === "bucket") {
          const bucketHandle = await navigator.storageBuckets.open(
            fullPath.split("/")[0]
          );
          rootHandle = await bucketHandle.getDirectory();
        } else {
          rootHandle = await navigator.storage.getDirectory();
        }

        const pathParts = fullPath.split("/");
        const entryName = pathParts.pop()!;
        let currentHandle = rootHandle;

        for (const part of pathParts) {
          currentHandle = await currentHandle.getDirectoryHandle(part);
        }

        await currentHandle.removeEntry(entryName, {
          recursive: kind === "directory",
        });
        setMessage(
          `${kind === "directory" ? "Cartella" : "File"} eliminato: ${fullPath}`
        );
      }

      loadFileSystem();
    } catch (error: any) {
      console.error(`Errore durante l'eliminazione di ${kind}:`, error);
      setMessage(`Errore: ${error.message}`);
    }
  };

  const openFile = async (filePath: string, location: "bucket" | "root") => {
    try {
      let rootHandle;
      if (location === "bucket") {
        const bucketHandle = await navigator.storageBuckets.open(
          filePath.split("/")[0]
        );
        rootHandle = await bucketHandle.getDirectory();
      } else {
        rootHandle = await navigator.storage.getDirectory();
      }

      const pathParts = filePath.split("/");
      const fileName = pathParts.pop()!;
      let currentHandle = rootHandle;

      for (const part of pathParts) {
        currentHandle = await currentHandle.getDirectoryHandle(part);
      }

      const fileHandle = await currentHandle.getFileHandle(fileName);
      const file = await fileHandle.getFile();
      const content = await file.text();

      setSelectedFile({ name: filePath, kind: "file", location });
      setFileContent(content);
      setMessage(`File aperto: ${filePath}`);
    } catch (error: any) {
      console.error("Errore durante l'apertura del file:", error);
      setMessage(`Errore: ${error.message}`);
    }
  };

  const saveFile = async (location: "bucket" | "root") => {
    if (!selectedFile || selectedFile.kind !== "file") return;
    try {
      let rootHandle;
      if (location === "bucket") {
        const bucketHandle = await navigator.storageBuckets.open(
          selectedFile.name.split("/")[0]
        );
        rootHandle = await bucketHandle.getDirectory();
      } else {
        rootHandle = await navigator.storage.getDirectory();
      }

      const pathParts = selectedFile.name.split("/");
      const fileName = pathParts.pop()!;
      let currentHandle = rootHandle;

      for (const part of pathParts) {
        currentHandle = await currentHandle.getDirectoryHandle(part);
      }

      const fileHandle = await currentHandle.getFileHandle(fileName);
      const writable = await fileHandle.createWritable();
      await writable.write(fileContent);
      await writable.close();

      setMessage(`File salvato: ${selectedFile.name}`);
    } catch (error: any) {
      console.error("Errore durante il salvataggio del file:", error);
      setMessage(`Errore: ${error.message}`);
    }
  };

  const handleModalAction = async (
    input: string,
    location: "bucket" | "root"
  ) => {
    try {
      let rootHandle;

      if (location === "bucket") {
        const bucketName = input.split("/")[0];
        if (!buckets.includes(bucketName)) {
          throw new Error(`Il bucket "${bucketName}" non esiste.`);
        }
        const bucketHandle = await navigator.storageBuckets.open(bucketName);
        rootHandle = await bucketHandle.getDirectory();
      } else {
        rootHandle = await navigator.storage.getDirectory();
      }

      const pathParts = input.split("/");
      const fileName = pathParts.pop()!;
      let currentHandle = rootHandle;

      for (const part of pathParts) {
        currentHandle = await currentHandle.getDirectoryHandle(part, {
          create: true,
        });
      }

      if (modalOpen?.action === "createFolder") {
        await currentHandle.getDirectoryHandle(fileName, { create: true });
        setMessage(`Cartella creata: ${input}`);
      } else if (modalOpen?.action === "createFile") {
        await currentHandle.getFileHandle(fileName, { create: true });
        setMessage(`File creato: ${input}`);
      }

      loadFileSystem();
    } catch (error: any) {
      console.error("Errore durante l'azione sulla modale:", error);
      setMessage(`Errore: ${error.message}`);
    } finally {
      setModalOpen(null);
    }
  };

  const renderTree = (nodes: FileSystemNode[]) => {
    return nodes.map((node) => {
      const displayName = node.name.split("/").pop();
      return (
        <li key={node.name}>
          {node.kind === "directory" ? (
            <>
              📁 {displayName}
              {node.name !== "Root" && (
                <button
                  onClick={() =>
                    deleteEntry(node.name, "directory", node.location)
                  }
                >
                  Elimina
                </button>
              )}
              <ul>{node.children && renderTree(node.children)}</ul>
            </>
          ) : node.kind === "bucket" ? (
            <>
              🗑️ {displayName}
              <button
                onClick={() => deleteEntry(node.name, "bucket", "bucket")}
              >
                Elimina
              </button>
              <ul>{node.children && renderTree(node.children)}</ul>
            </>
          ) : (
            <>
              📄 {displayName}
              <button onClick={() => openFile(node.name, node.location)}>
                Apri
              </button>
              <button
                onClick={() => deleteEntry(node.name, "file", node.location)}
              >
                Elimina
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
      <button
        onClick={() => {
          setModalFields([
            {
              name: "Bucket",
              type: "text",
              placeholder: "Nome del bucket (opzionale)",
            },
            {
              name: "Percorso",
              type: "text",
              placeholder: "Inserisci il percorso",
            },
          ]);
          setModalOpen({
            action: "createFolder",
            title: "Crea una nuova cartella",
          });
        }}
        style={{ marginRight: "10px", padding: "10px 20px" }}
      >
        Crea Cartella
      </button>
      <button
        onClick={() => {
          setModalFields([
            {
              name: "Bucket",
              type: "text",
              placeholder: "Nome del bucket (opzionale)",
            },
            {
              name: "Percorso",
              type: "text",
              placeholder: "Inserisci il percorso",
            },
          ]);
          setModalOpen({ action: "createFile", title: "Crea un nuovo file" });
        }}
        style={{ marginRight: "10px", padding: "10px 20px" }}
      >
        Crea File
      </button>
      <button
        onClick={() => {
          setModalFields([
            {
              name: "Nome",
              type: "text",
              placeholder: "Inserisci il nome del bucket",
            },
            { name: "Quota", type: "number", placeholder: "Quota in bytes" },
            {
              name: "Scadenza",
              type: "number",
              placeholder: "Scadenza in secondi",
            },
          ]);
          setBucketModalOpen(true);
        }}
        style={{ marginRight: "10px", padding: "10px 20px" }}
      >
        Crea Bucket
      </button>
      <button onClick={loadFileSystem} style={{ padding: "10px 20px" }}>
        Aggiorna
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
            onClick={() => saveFile(selectedFile.location)}
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

      {bucketModalOpen && (
        <Modal
          title="Crea un nuovo bucket"
          placeholder="Inserisci il nome del bucket"
          fields={modalFields}
          onConfirm={(values) => {
            createBucket(values.Nome, {
              durability: values.Durabilità,
              quota: values.Quota ? parseInt(values.Quota, 10) : undefined,
              expires: values.Scadenza
                ? parseInt(values.Scadenza, 10)
                : undefined,
            });
            setBucketModalOpen(false);
          }}
          onCancel={() => setBucketModalOpen(false)}
        />
      )}

      {modalOpen && (
        <Modal
          title={modalOpen.title}
          placeholder=""
          fields={modalFields}
          onConfirm={(values) =>
            handleModalAction(
              values.Percorso,
              values.Bucket ? "bucket" : "root"
            )
          }
          onCancel={() => setModalOpen(null)}
        />
      )}
    </div>
  );
};

export default OPFSFileSystem;
