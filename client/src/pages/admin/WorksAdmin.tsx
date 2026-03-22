import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Briefcase,
  LogOut,
  Plus,
  Edit,
  Trash2,
  Send,
  AlertCircle,
  Upload,
} from "lucide-react";
import { useState, useRef } from "react";
import { toast } from "sonner";

type WorkFormData = {
  title: string;
  slug: string;
  content: string;
  description: string;
};

type EditingWork = {
  id: number;
  title: string;
  slug: string;
  content: string;
  description: string;
};

type LocalDraft = {
  id: number;
  title: string;
  slug: string;
  content: string;
  description: string | null;
  status: "draft";
  createdAt: string;
};

export default function WorksAdmin() {
  const { user, logout } = useAuth();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingWork, setEditingWork] = useState<EditingWork | null>(null);
  const [createForm, setCreateForm] = useState<WorkFormData>({
    title: "",
    slug: "",
    content: "",
    description: "",
  });
  const [validationError, setValidationError] = useState<string | null>(null);
  const [localDrafts, setLocalDrafts] = useState<LocalDraft[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const createFileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();

  const { data: publishedWorks, isLoading: isLoadingPublished } =
    trpc.works.list.useQuery({});

  const createMutation = trpc.works.create.useMutation({
    onSuccess: (data) => {
      toast.success("Draft created successfully");
      setCreateDialogOpen(false);
      setCreateForm({ title: "", slug: "", content: "", description: "" });

      const newDraft: LocalDraft = {
        id: data.work.id,
        title: data.work.title,
        slug: data.work.slug,
        content: data.work.content,
        description: data.work.description,
        status: "draft",
        createdAt: new Date().toISOString(),
      };
      setLocalDrafts((prev) => [newDraft, ...prev]);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create draft");
    },
  });

  const updateMutation = trpc.works.update.useMutation({
    onSuccess: (data) => {
      toast.success("Work updated successfully");
      setEditDialogOpen(false);
      setEditingWork(null);

      if (data.work.status === "draft") {
        setLocalDrafts((prev) =>
          prev.map((draft) =>
            draft.id === data.work.id
              ? {
                  ...draft,
                  title: data.work.title,
                  slug: data.work.slug,
                  content: data.work.content,
                  description: data.work.description,
                }
              : draft
          )
        );
      } else {
        utils.works.list.invalidate();
      }
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update work");
    },
  });

  const publishMutation = trpc.works.publish.useMutation({
    onSuccess: (data) => {
      toast.success("Work published successfully");
      setValidationError(null);

      setLocalDrafts((prev) => prev.filter((draft) => draft.id !== data.work.id));
      utils.works.list.invalidate();
    },
    onError: (error) => {
      // BAD_REQUEST or PRECONDITION_FAILED errors are shown visibly
      if (error.data?.code === "BAD_REQUEST" || error.data?.code === "PRECONDITION_FAILED") {
        setValidationError(error.message);
        toast.error("Publish failed: " + error.message);
      } else {
        toast.error(error.message || "Failed to publish work");
      }
    },
  });

  const deleteMutation = trpc.works.softDelete.useMutation({
    onSuccess: (_, variables) => {
      toast.success("Work deleted successfully");

      setLocalDrafts((prev) => prev.filter((draft) => draft.id !== variables.id));
      utils.works.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete work");
    },
  });

  const uploadSessionMutation = trpc.assets.createUploadSession.useMutation({
    onError: (error) => {
      const message = error.message || "Failed to create upload session";
      setUploadError(message);
      toast.error(message);
    },
  });

  const handleFileSelect = (
    event: React.ChangeEvent<HTMLInputElement>,
    target: "create" | "edit"
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    uploadSessionMutation.mutate(
      {
        filename: file.name,
        mimeType: file.type,
        size: file.size,
      },
      {
        onSuccess: (data) => {
          const assetRef = `/assets/${data.assetId}`;

          if (target === "create") {
            setCreateForm((prev) => ({
              ...prev,
              content: prev.content
                ? `${prev.content}\n\n![](${assetRef})`
                : `![](${assetRef})`,
            }));
          } else if (target === "edit" && editingWork) {
            setEditingWork((prev) =>
              prev
                ? {
                    ...prev,
                    content: prev.content
                      ? `${prev.content}\n\n![](${assetRef})`
                      : `![](${assetRef})`,
                  }
                : null
            );
          }

          toast.success(`Asset reference inserted: ${assetRef}`);
        },
      }
    );

    event.target.value = "";
  };

  const handleCreate = () => {
    if (!createForm.title.trim() || !createForm.slug.trim()) {
      toast.error("Title and slug are required");
      return;
    }
    createMutation.mutate(createForm);
  };

  const handleUpdate = () => {
    if (!editingWork) return;
    updateMutation.mutate({
      id: editingWork.id,
      title: editingWork.title,
      slug: editingWork.slug,
      content: editingWork.content,
      description: editingWork.description,
    });
  };

  const handlePublish = (workId: number) => {
    setValidationError(null);
    publishMutation.mutate({ id: workId });
  };

  const handleDelete = (workId: number) => {
    if (confirm("Are you sure you want to delete this work?")) {
      deleteMutation.mutate({ id: workId });
    }
  };

  const openEditDialog = (work: any) => {
    setEditingWork({
      id: work.id,
      title: work.title,
      slug: work.slug,
      content: work.content,
      description: work.description || "",
    });
    setEditDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "published":
        return <Badge className="bg-green-500">Published</Badge>;
      case "draft":
        return <Badge variant="secondary">Draft</Badge>;
      case "archived":
        return <Badge variant="outline">Archived</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const allWorks = [
    ...localDrafts,
    ...(publishedWorks?.works || []).map((work) => ({
      ...work,
      description: work.description || null,
      createdAt: work.createdAt?.toString() || new Date().toISOString(),
    })),
  ];

  return (
    <div className="min-h-screen bg-background" data-testid="works-admin">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Briefcase className="h-6 w-6" />
            <h1 className="text-xl font-semibold">Works Admin</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {user?.email || user?.name}
            </span>
            <Button variant="outline" size="sm" onClick={logout}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Portfolio Works</h2>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Draft
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create New Work</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="create-title">Title</Label>
                  <Input
                    id="create-title"
                    value={createForm.title}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, title: e.target.value })
                    }
                    placeholder="Enter work title"
                  />
                </div>
                <div>
                  <Label htmlFor="create-slug">Slug</Label>
                  <Input
                    id="create-slug"
                    value={createForm.slug}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, slug: e.target.value })
                    }
                    placeholder="work-url-slug"
                  />
                </div>
                <div>
                  <Label htmlFor="create-description">Description (Optional)</Label>
                  <Input
                    id="create-description"
                    value={createForm.description}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, description: e.target.value })
                    }
                    placeholder="Brief description"
                  />
                </div>
                <div>
                  <Label htmlFor="create-content">Content</Label>
                  <Textarea
                    id="create-content"
                    value={createForm.content}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, content: e.target.value })
                    }
                    placeholder="Write your work content..."
                    className="min-h-[200px]"
                  />
                </div>
                <div>
                  <Label>Add Asset</Label>
                  <div className="flex items-center gap-2">
                    <input
                      ref={createFileInputRef}
                      type="file"
                      className="hidden"
                      accept="image/*,video/*,audio/*,application/pdf"
                      onChange={(e) => handleFileSelect(e, "create")}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => createFileInputRef.current?.click()}
                      disabled={uploadSessionMutation.isPending}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {uploadSessionMutation.isPending ? "Creating session..." : "Select File"}
                    </Button>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setCreateDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreate}
                    disabled={createMutation.isPending}
                  >
                    {createMutation.isPending ? "Creating..." : "Create Draft"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {validationError && (
          <Alert variant="destructive" className="mb-6" data-testid="publish-error">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{validationError}</AlertDescription>
          </Alert>
        )}

        {uploadError && (
          <Alert variant="destructive" className="mb-6" data-testid="upload-error">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{uploadError}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          {isLoadingPublished && localDrafts.length === 0 && (
            <p className="text-muted-foreground">Loading works...</p>
          )}
          {allWorks.length === 0 && !isLoadingPublished && (
            <p className="text-muted-foreground">
              No works yet. Create your first draft to get started.
            </p>
          )}
          {allWorks.map((work) => (
            <Card key={work.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <CardTitle>{work.title}</CardTitle>
                    <p className="text-sm text-muted-foreground">{work.slug}</p>
                  </div>
                  {getStatusBadge(work.status)}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  {work.description || "No description"}
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openEditDialog(work)}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                  {work.status === "draft" && (
                    <Button
                      size="sm"
                      onClick={() => handlePublish(work.id)}
                      disabled={publishMutation.isPending}
                    >
                      <Send className="h-4 w-4 mr-2" />
                      {publishMutation.isPending ? "Publishing..." : "Publish"}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(work.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Work</DialogTitle>
            </DialogHeader>
            {editingWork && (
              <div className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="edit-title">Title</Label>
                  <Input
                    id="edit-title"
                    value={editingWork.title}
                    onChange={(e) =>
                      setEditingWork({ ...editingWork, title: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="edit-slug">Slug</Label>
                  <Input
                    id="edit-slug"
                    value={editingWork.slug}
                    onChange={(e) =>
                      setEditingWork({ ...editingWork, slug: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="edit-description">Description</Label>
                  <Input
                    id="edit-description"
                    value={editingWork.description}
                    onChange={(e) =>
                      setEditingWork({
                        ...editingWork,
                        description: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="edit-content">Content</Label>
                  <Textarea
                    id="edit-content"
                    value={editingWork.content}
                    onChange={(e) =>
                      setEditingWork({
                        ...editingWork,
                        content: e.target.value,
                      })
                    }
                    className="min-h-[200px]"
                  />
                </div>
                <div>
                  <Label>Add Asset</Label>
                  <div className="flex items-center gap-2">
                    <input
                      ref={editFileInputRef}
                      type="file"
                      className="hidden"
                      accept="image/*,video/*,audio/*,application/pdf"
                      onChange={(e) => handleFileSelect(e, "edit")}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => editFileInputRef.current?.click()}
                      disabled={uploadSessionMutation.isPending}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {uploadSessionMutation.isPending ? "Creating session..." : "Select File"}
                    </Button>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setEditDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleUpdate}
                    disabled={updateMutation.isPending}
                  >
                    {updateMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
