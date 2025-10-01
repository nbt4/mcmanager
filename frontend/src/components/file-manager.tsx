'use client';

import { useState } from 'react';
import {
  Folder,
  FileText,
  Download,
  Trash2,
  Edit,
  FolderPlus,
  Upload,
  ChevronRight,
  Home,
  Save,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  useFiles,
  useFileContent,
  useWriteFile,
  useUploadFile,
  useCreateDirectory,
  useDeleteFile,
  getDownloadUrl,
} from '@/hooks/useFiles';
import { formatBytes } from '@/lib/utils';

interface FileManagerProps {
  serverId: string;
}

export function FileManager({ serverId }: FileManagerProps) {
  const [currentPath, setCurrentPath] = useState('');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [editingFile, setEditingFile] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [newDirName, setNewDirName] = useState('');
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [newDirDialogOpen, setNewDirDialogOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<string | null>(null);

  const { data: fileList, isLoading } = useFiles(serverId, currentPath);
  const { data: fileContent } = useFileContent(serverId, editingFile || '');
  const writeFile = useWriteFile();
  const uploadFile = useUploadFile();
  const createDirectory = useCreateDirectory();
  const deleteFile = useDeleteFile();

  const pathSegments = currentPath ? currentPath.split('/').filter(Boolean) : [];

  const navigateTo = (path: string) => {
    setCurrentPath(path);
    setSelectedFile(null);
  };

  const navigateUp = () => {
    const segments = pathSegments.slice(0, -1);
    navigateTo(segments.join('/'));
  };

  const handleFileClick = (item: any) => {
    if (item.isDirectory) {
      navigateTo(item.path);
    } else {
      setSelectedFile(item.path);
    }
  };

  const handleEdit = (filePath: string) => {
    setEditingFile(filePath);
  };

  const handleSaveEdit = async () => {
    if (editingFile && editContent !== undefined) {
      await writeFile.mutateAsync({
        serverId,
        path: editingFile,
        content: editContent,
      });
      setEditingFile(null);
      setEditContent('');
    }
  };

  const handleCancelEdit = () => {
    setEditingFile(null);
    setEditContent('');
  };

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const file = formData.get('file') as File;

    if (file) {
      await uploadFile.mutateAsync({
        serverId,
        path: currentPath,
        file,
      });
      setUploadDialogOpen(false);
    }
  };

  const handleCreateDir = async () => {
    if (newDirName) {
      const newPath = currentPath ? `${currentPath}/${newDirName}` : newDirName;
      await createDirectory.mutateAsync({
        serverId,
        path: newPath,
      });
      setNewDirName('');
      setNewDirDialogOpen(false);
    }
  };

  const handleDelete = async () => {
    if (fileToDelete) {
      await deleteFile.mutateAsync({
        serverId,
        path: fileToDelete,
      });
      setFileToDelete(null);
      setDeleteConfirmOpen(false);
      if (selectedFile === fileToDelete) {
        setSelectedFile(null);
      }
    }
  };

  // Load file content when editing
  if (editingFile && fileContent && editContent === '') {
    setEditContent(fileContent.content);
  }

  if (editingFile) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">Editing: {editingFile}</h3>
          <div className="flex gap-2">
            <Button onClick={handleSaveEdit} disabled={writeFile.isPending}>
              <Save className="mr-2 h-4 w-4" />
              Save
            </Button>
            <Button variant="outline" onClick={handleCancelEdit}>
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
          </div>
        </div>
        <Textarea
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          className="font-mono min-h-[500px]"
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Breadcrumb and Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigateTo('')}
          >
            <Home className="h-4 w-4" />
          </Button>
          {pathSegments.map((segment, index) => (
            <div key={index} className="flex items-center gap-2">
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigateTo(pathSegments.slice(0, index + 1).join('/'))}
              >
                {segment}
              </Button>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setUploadDialogOpen(true)}
          >
            <Upload className="mr-2 h-4 w-4" />
            Upload
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setNewDirDialogOpen(true)}
          >
            <FolderPlus className="mr-2 h-4 w-4" />
            New Folder
          </Button>
        </div>
      </div>

      {/* File List */}
      <div className="border rounded-lg">
        <div className="divide-y">
          {currentPath && (
            <div
              className="flex items-center gap-3 p-3 hover:bg-muted cursor-pointer"
              onClick={navigateUp}
            >
              <Folder className="h-5 w-5 text-blue-500" />
              <span>..</span>
            </div>
          )}

          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : fileList?.items.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No files or folders</div>
          ) : (
            fileList?.items.map((item) => (
              <div
                key={item.path}
                className={`flex items-center justify-between p-3 hover:bg-muted cursor-pointer ${
                  selectedFile === item.path ? 'bg-muted' : ''
                }`}
                onClick={() => handleFileClick(item)}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {item.isDirectory ? (
                    <Folder className="h-5 w-5 text-blue-500 flex-shrink-0" />
                  ) : (
                    <FileText className="h-5 w-5 text-gray-500 flex-shrink-0" />
                  )}
                  <span className="truncate">{item.name}</span>
                </div>

                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground">
                    {item.isDirectory ? '' : formatBytes(item.size)}
                  </span>

                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    {!item.isDirectory && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(item.path)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                        >
                          <a
                            href={getDownloadUrl(serverId, item.path)}
                            download
                          >
                            <Download className="h-4 w-4" />
                          </a>
                        </Button>
                      </>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setFileToDelete(item.path);
                        setDeleteConfirmOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload File</DialogTitle>
            <DialogDescription>
              Upload a file to {currentPath || 'root directory'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpload}>
            <Input type="file" name="file" required />
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setUploadDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={uploadFile.isPending}>
                Upload
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* New Directory Dialog */}
      <Dialog open={newDirDialogOpen} onOpenChange={setNewDirDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
            <DialogDescription>
              Create a new folder in {currentPath || 'root directory'}
            </DialogDescription>
          </DialogHeader>
          <Input
            value={newDirName}
            onChange={(e) => setNewDirName(e.target.value)}
            placeholder="Folder name"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewDirDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateDir} disabled={!newDirName || createDirectory.isPending}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this {fileList?.items.find(i => i.path === fileToDelete)?.isDirectory ? 'folder' : 'file'}?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteFile.isPending}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
