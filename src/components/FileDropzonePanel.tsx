import React, { useRef, useState, DragEvent, ChangeEvent } from 'react';
import {
  FilePlus,
  FolderPlus,
  Upload,
  MessageSquare,
  ArrowRight,
  PlusCircle,
  X,
  CheckCircle2,
  Download,
  Copy,
  Check,
  HardDrive,
  FileText,
  FileImage,
  FileVideo,
  FileAudio,
  FileArchive,
  FileCode,
} from 'lucide-react';
import { FileItem, SpeedSample } from '../services/peerService';
import { formatBytes, formatSpeed, formatEta } from '../services/cryptoService';
import { TransferSpeedChart } from './TransferSpeedChart';

interface FileDropzonePanelProps {
  files: FileItem[];
  speedSamples: SpeedSample[];
  onAddFiles: (files: File[]) => void;
  onRemoveFile: (id: string) => void;
  onClearFiles: () => void;
  onOpenTextRelay: () => void;
  isConnected: boolean;
  isTransferring: boolean;
}

export const FileDropzonePanel: React.FC<FileDropzonePanelProps> = ({
  files,
  speedSamples,
  onAddFiles,
  onRemoveFile,
  onClearFiles,
  onOpenTextRelay,
  isConnected,
  isTransferring,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [copiedHashId, setCopiedHashId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const getFileIcon = (name: string, mime: string) => {
    const ext = name.split('.').pop()?.toLowerCase() || '';
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext) || mime.startsWith('image/')) {
      return <FileImage className="w-5 h-5 text-indigo-400" />;
    }
    if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext) || mime.startsWith('video/')) {
      return <FileVideo className="w-5 h-5 text-rose-400" />;
    }
    if (['mp3', 'wav', 'ogg', 'flac', 'm4a'].includes(ext) || mime.startsWith('audio/')) {
      return <FileAudio className="w-5 h-5 text-amber-400" />;
    }
    if (['zip', 'rar', 'tar', 'gz', '7z', 'iso'].includes(ext)) {
      return <FileArchive className="w-5 h-5 text-purple-400" />;
    }
    if (['ts', 'tsx', 'js', 'jsx', 'py', 'json', 'html', 'css', 'go', 'rs', 'cpp'].includes(ext)) {
      return <FileCode className="w-5 h-5 text-emerald-400" />;
    }
    return <FileText className="w-5 h-5 text-zinc-400" />;
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const items = e.dataTransfer.items;
    const collectedFiles: File[] = [];

    if (items && items.length > 0) {
      const promises: Promise<void>[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (typeof (item as any).webkitGetAsEntry === 'function') {
          const entry = (item as any).webkitGetAsEntry();
          if (entry) {
            promises.push(traverseEntry(entry, collectedFiles));
          }
        } else {
          const file = item.getAsFile();
          if (file) collectedFiles.push(file);
        }
      }
      await Promise.all(promises);
    } else if (e.dataTransfer.files) {
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        collectedFiles.push(e.dataTransfer.files[i]);
      }
    }

    if (collectedFiles.length > 0) {
      onAddFiles(collectedFiles);
    }
  };

  const traverseEntry = async (entry: any, outList: File[], pathPrefix = ''): Promise<void> => {
    if (entry.isFile) {
      return new Promise((resolve) => {
        entry.file(
          (file: File) => {
            Object.defineProperty(file, 'webkitRelativePath', {
              value: pathPrefix ? `${pathPrefix}/${file.name}` : file.name,
              writable: false,
            });
            outList.push(file);
            resolve();
          },
          () => resolve()
        );
      });
    } else if (entry.isDirectory) {
      const dirReader = entry.createReader();
      return new Promise((resolve) => {
        const readEntries = () => {
          dirReader.readEntries(
            async (entries: any[]) => {
              if (entries.length === 0) {
                resolve();
              } else {
                for (const subEntry of entries) {
                  await traverseEntry(subEntry, outList, pathPrefix ? `${pathPrefix}/${entry.name}` : entry.name);
                }
                readEntries();
              }
            },
            () => resolve()
          );
        };
        readEntries();
      });
    }
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onAddFiles(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  const handleCopyHash = (id: string, hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHashId(id);
    setTimeout(() => setCopiedHashId(null), 2000);
  };

  const totalBytes = files.reduce((acc, f) => acc + f.size, 0);

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Hidden native file inputs */}
      <input ref={fileInputRef} type="file" multiple onChange={handleFileInputChange} className="hidden" />
      <input
        ref={folderInputRef}
        type="file"
        // @ts-ignore
        webkitdirectory=""
        directory=""
        multiple
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* Ephemeral Clipboard Relay Banner */}
      <div className="w-full bg-[#0c0c0e] border border-[#1b1c24] rounded-2xl p-4 sm:p-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
        <div className="flex items-start sm:items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-[#14151c] border border-[#222432] text-zinc-300 shrink-0">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white tracking-tight">
              Need to share a link, note, or password?
            </h4>
            <p className="text-xs text-zinc-400">
              Instant zero-footprint peer clipboard relay
            </p>
          </div>
        </div>

        <button
          onClick={onOpenTextRelay}
          className="self-start sm:self-auto flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#171822] hover:bg-[#222330] border border-[#252738] text-xs sm:text-sm font-medium text-white transition-all cursor-pointer shadow-sm shrink-0"
        >
          <span>Share Text</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Add Files / Folders Action Cards */}
      <div className="w-full grid grid-cols-2 gap-3.5">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex flex-col items-center justify-center p-5 rounded-2xl bg-[#0c0c0e] hover:bg-[#121217] border border-[#1d1d24] hover:border-[#2f2f3c] transition-all cursor-pointer group text-center"
        >
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#15151c] group-hover:bg-[#1c1d27] border border-[#23232f] text-zinc-300 mb-2">
            <FilePlus className="w-4 h-4" />
          </div>
          <span className="text-sm font-semibold text-white mb-0.5">Add files</span>
          <span className="text-[11px] text-zinc-500">Select single or multiple files</span>
        </button>

        <button
          onClick={() => folderInputRef.current?.click()}
          className="flex flex-col items-center justify-center p-5 rounded-2xl bg-[#0c0c0e] hover:bg-[#121217] border border-[#1d1d24] hover:border-[#2f2f3c] transition-all cursor-pointer group text-center"
        >
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#15151c] group-hover:bg-[#1c1d27] border border-[#23232f] text-zinc-300 mb-2">
            <FolderPlus className="w-4 h-4" />
          </div>
          <span className="text-sm font-semibold text-white mb-0.5">Add folders</span>
          <span className="text-[11px] text-zinc-500">Select whole directory</span>
        </button>
      </div>

      {/* Main Drag & Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`w-full rounded-2xl border-2 border-dashed transition-all cursor-pointer p-8 sm:p-12 flex flex-col items-center justify-center text-center ${
          isDragOver
            ? 'border-white bg-[#14141d]'
            : 'border-[#1f1f28] hover:border-[#313140] bg-[#07070a]'
        }`}
      >
        <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-[#121217] border border-[#23232c] text-zinc-300 mb-3.5 shadow-md">
          <Upload className="w-5 h-5 text-zinc-300" />
        </div>
        <p className="text-sm sm:text-base font-semibold text-white mb-1">
          Drop files or folders here
        </p>
        <p className="text-xs text-zinc-500 max-w-sm">
          You can append multiple files and directories continuously. No file size limits.
        </p>
      </div>

      {/* Active Connected Callout: Append more files anytime */}
      {isConnected && files.length > 0 && (
        <div className="w-full bg-[#0d0f14] border border-[#1d222e] rounded-xl px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PlusCircle className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-medium text-emerald-300">
              Peer is actively connected. You can add more files anytime!
            </span>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-xs font-semibold text-white underline hover:text-emerald-300 transition-colors cursor-pointer"
          >
            + Append more
          </button>
        </div>
      )}

      {/* Real-time Transfer Speed Visualization using Recharts */}
      {(isTransferring || files.some((f) => f.status === 'completed' || f.status === 'transferring') || speedSamples.length > 0) && (
        <TransferSpeedChart samples={speedSamples} isTransferring={isTransferring} />
      )}

      {/* Transfer Queue List */}
      {files.length > 0 && (
        <div className="w-full bg-[#0c0c0e] border border-[#1b1c24] rounded-2xl p-4 sm:p-5 shadow-xl">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#1b1b22]">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Transfer Queue ({files.length})
              </span>
              <span className="text-xs text-zinc-500 font-mono">
                Total: {formatBytes(totalBytes)}
              </span>
            </div>
            {!isTransferring && (
              <button
                onClick={onClearFiles}
                className="text-xs text-zinc-500 hover:text-rose-400 transition-colors cursor-pointer"
              >
                Clear all
              </button>
            )}
          </div>

          <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
            {files.map((file) => {
              const percent =
                file.totalChunks > 0
                  ? Math.min(100, Math.round((file.chunksTransferred / file.totalChunks) * 100))
                  : 0;

              return (
                <div
                  key={file.id}
                  className="bg-[#07070a] border border-[#191922] rounded-xl p-3.5 flex flex-col gap-2 transition-all hover:border-[#272734]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="p-2 rounded-lg bg-[#14141c] border border-[#21212d] shrink-0">
                        {getFileIcon(file.name, file.type)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-baseline gap-2">
                          <p
                            className="text-xs sm:text-sm font-medium text-white truncate max-w-[220px] sm:max-w-[340px]"
                            title={file.name}
                          >
                            {file.name}
                          </p>
                          <span className="text-[11px] text-zinc-400 shrink-0 font-mono">
                            {formatBytes(file.size)}
                          </span>
                        </div>
                        {file.relativePath && (
                          <p className="text-[10px] text-zinc-500 truncate" title={file.relativePath}>
                            📁 {file.relativePath}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {file.status === 'completed' && (
                        <div className="flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-950/40 border border-emerald-800/50 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          <span>Done</span>
                        </div>
                      )}

                      {file.receivedBlobUrl && (
                        <a
                          href={file.receivedBlobUrl}
                          download={file.name}
                          className="flex items-center gap-1 text-xs text-white bg-[#1e1e28] hover:bg-[#2c2c3c] border border-[#313142] px-2.5 py-1 rounded-lg transition-all"
                        >
                          <Download className="w-3 h-3" />
                          <span>Download</span>
                        </a>
                      )}

                      {file.status === 'queued' && !isTransferring && (
                        <button
                          onClick={() => onRemoveFile(file.id)}
                          className="text-zinc-500 hover:text-zinc-300 p-1 rounded-md transition-colors cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar & Real-time Speed */}
                  {(file.status === 'transferring' || file.status === 'completed') && (
                    <div className="w-full">
                      <div className="w-full bg-[#14141c] h-1.5 rounded-full overflow-hidden mb-1.5">
                        <div
                          className={`h-full transition-all duration-200 ${
                            file.status === 'completed' ? 'bg-emerald-400' : 'bg-white'
                          }`}
                          style={{ width: `${file.status === 'completed' ? 100 : percent}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono">
                        <div className="flex items-center gap-2">
                          <span>{percent}%</span>
                          {file.status === 'transferring' && file.speedBps > 0 && (
                            <>
                              <span className="text-zinc-600">•</span>
                              <span className="text-zinc-300">{formatSpeed(file.speedBps)}</span>
                            </>
                          )}
                          {file.diskStreamed && (
                            <span className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-950/50 px-1.5 rounded">
                              <HardDrive className="w-2.5 h-2.5" />
                              <span>Direct to Disk</span>
                            </span>
                          )}
                        </div>
                        <div>
                          {file.status === 'transferring' && file.etaSeconds > 0 && (
                            <span>ETA: {formatEta(file.etaSeconds)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SHA-256 Checksum display */}
                  {file.sha256 && (
                    <div className="mt-1 pt-1.5 border-t border-[#14141c] flex items-center justify-between text-[10px] text-zinc-400">
                      <div className="flex items-center gap-1.5 overflow-hidden">
                        <span className="text-zinc-500 font-semibold">SHA-256:</span>
                        <span className="font-mono text-zinc-300 truncate" title={file.sha256}>
                          {file.sha256.slice(0, 12)}...{file.sha256.slice(-8)}
                        </span>
                        {file.verified && (
                          <span className="text-emerald-400 font-semibold">(Verified ✓)</span>
                        )}
                      </div>
                      <button
                        onClick={() => handleCopyHash(file.id, file.sha256!)}
                        className="flex items-center gap-1 text-zinc-400 hover:text-white transition-colors cursor-pointer shrink-0 ml-2"
                        title="Copy SHA-256 Hash"
                      >
                        {copiedHashId === file.id ? (
                          <span className="text-emerald-400">Copied</span>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy Hash</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
