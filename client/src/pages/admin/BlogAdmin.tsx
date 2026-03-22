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
  LayoutDashboard,
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

type PostFormData = {
  title: string;
  slug: string;
  content: string;
  excerpt: string;
};

type EditingPost = {
  id: number;
  title: string;
  slug: string;
  content: string;
  excerpt: string;
};

type LocalDraft = {
  id: number;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  status: "draft";
  date: string;
};

export default function BlogAdmin() {
  const { user, logout } = useAuth();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<EditingPost | null>(null);
  const [createForm, setCreateForm] = useState<PostFormData>({
    title: "",
    slug: "",
    content: "",
    excerpt: "",
  });
  const [validationError, setValidationError] = useState<string | null>(null);
  const [localDrafts, setLocalDrafts] = useState<LocalDraft[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const createFileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();

  const { data: publishedPosts, isLoading: isLoadingPublished } =
    trpc.posts.list.useQuery({});

  const createMutation = trpc.posts.create.useMutation({
    onSuccess: (data) => {
      toast.success("Draft created successfully");
      setCreateDialogOpen(false);
      setCreateForm({ title: "", slug: "", content: "", excerpt: "" });

      const newDraft: LocalDraft = {
        id: data.post.id,
        title: data.post.title,
        slug: data.post.slug,
        content: data.post.content,
        excerpt: data.post.excerpt,
        status: "draft",
        date: data.post.date,
      };
      setLocalDrafts((prev) => [newDraft, ...prev]);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create draft");
    },
  });

  const updateMutation = trpc.posts.update.useMutation({
    onSuccess: (data) => {
      toast.success("Post updated successfully");
      setEditDialogOpen(false);
      setEditingPost(null);

      if (data.post.status === "draft") {
        setLocalDrafts((prev) =>
          prev.map((draft) =>
            draft.id === data.post.id
              ? {
                  ...draft,
                  title: data.post.title,
                  slug: data.post.slug,
                  content: data.post.content,
                  excerpt: data.post.excerpt,
                }
              : draft
          )
        );
      } else {
        utils.posts.list.invalidate();
      }
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update post");
    },
  });

  const publishMutation = trpc.posts.publish.useMutation({
    onSuccess: (data) => {
      toast.success("Post published successfully");
      setValidationError(null);

      setLocalDrafts((prev) => prev.filter((draft) => draft.id !== data.post.id));
      utils.posts.list.invalidate();
    },
    onError: (error) => {
      if (error.data?.code === "BAD_REQUEST") {
        setValidationError(error.message);
        toast.error("Publish failed: " + error.message);
      } else {
        toast.error(error.message || "Failed to publish post");
      }
    },
  });

  const deleteMutation = trpc.posts.softDelete.useMutation({
    onSuccess: (_, variables) => {
      toast.success("Post deleted successfully");

      setLocalDrafts((prev) => prev.filter((draft) => draft.id !== variables.id));
      utils.posts.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete post");
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
          } else if (target === "edit" && editingPost) {
            setEditingPost((prev) =>
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
    if (!editingPost) return;
    updateMutation.mutate({
      id: editingPost.id,
      title: editingPost.title,
      slug: editingPost.slug,
      content: editingPost.content,
      excerpt: editingPost.excerpt,
    });
  };

  const handlePublish = (postId: number) => {
    setValidationError(null);
    publishMutation.mutate({ id: postId });
  };

  const handleDelete = (postId: number) => {
    if (confirm("Are you sure you want to delete this post?")) {
      deleteMutation.mutate({ id: postId });
    }
  };

  const openEditDialog = (post: any) => {
    setEditingPost({
      id: post.id,
      title: post.title,
      slug: post.slug,
      content: post.content,
      excerpt: post.excerpt || "",
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

  const allPosts = [
    ...localDrafts,
    ...(publishedPosts?.posts || []).map((post) => ({
      ...post,
      excerpt: post.excerpt || null,
    })),
  ];

  return (
    <div className="min-h-screen bg-background" data-testid="blog-admin">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <LayoutDashboard className="h-6 w-6" />
            <h1 className="text-xl font-semibold">Blog Admin</h1>
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
          <h2 className="text-2xl font-bold">Blog Posts</h2>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Draft
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create New Draft</DialogTitle>
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
                    placeholder="Enter post title"
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
                    placeholder="post-url-slug"
                  />
                </div>
                <div>
                  <Label htmlFor="create-excerpt">Excerpt (Optional)</Label>
                  <Input
                    id="create-excerpt"
                    value={createForm.excerpt}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, excerpt: e.target.value })
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
                    placeholder="Write your post content..."
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
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{validationError}</AlertDescription>
          </Alert>
        )}

        {uploadError && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{uploadError}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          {isLoadingPublished && localDrafts.length === 0 && (
            <p className="text-muted-foreground">Loading posts...</p>
          )}
          {allPosts.length === 0 && !isLoadingPublished && (
            <p className="text-muted-foreground">
              No posts yet. Create your first draft to get started.
            </p>
          )}
          {allPosts.map((post) => (
            <Card key={post.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <CardTitle>{post.title}</CardTitle>
                    <p className="text-sm text-muted-foreground">{post.slug}</p>
                  </div>
                  {getStatusBadge(post.status)}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  {post.excerpt || "No excerpt"}
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openEditDialog(post)}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                  {post.status === "draft" && (
                    <Button
                      size="sm"
                      onClick={() => handlePublish(post.id)}
                      disabled={publishMutation.isPending}
                    >
                      <Send className="h-4 w-4 mr-2" />
                      {publishMutation.isPending ? "Publishing..." : "Publish"}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(post.id)}
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
              <DialogTitle>Edit Post</DialogTitle>
            </DialogHeader>
            {editingPost && (
              <div className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="edit-title">Title</Label>
                  <Input
                    id="edit-title"
                    value={editingPost.title}
                    onChange={(e) =>
                      setEditingPost({ ...editingPost, title: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="edit-slug">Slug</Label>
                  <Input
                    id="edit-slug"
                    value={editingPost.slug}
                    onChange={(e) =>
                      setEditingPost({ ...editingPost, slug: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="edit-excerpt">Excerpt</Label>
                  <Input
                    id="edit-excerpt"
                    value={editingPost.excerpt}
                    onChange={(e) =>
                      setEditingPost({
                        ...editingPost,
                        excerpt: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="edit-content">Content</Label>
                  <Textarea
                    id="edit-content"
                    value={editingPost.content}
                    onChange={(e) =>
                      setEditingPost({
                        ...editingPost,
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
