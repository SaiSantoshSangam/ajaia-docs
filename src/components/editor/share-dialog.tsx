"use client";

import { useEffect, useState } from "react";
import {
  Check,
  Copy,
  Globe,
  Loader2,
  Lock,
  RefreshCw,
  Trash2,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { DEMO_ACCOUNTS } from "@/lib/demo-users";
import type { ShareRole } from "@/types/database";
import type { CollaboratorShare, ShareSettingsPayload } from "@/types/document";

interface ShareDialogProps {
  documentId: string;
  documentTitle: string;
  currentUserEmail?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSettingsChanged?: (settings: Pick<ShareSettingsPayload, "isPublic" | "publicRole" | "shareToken">) => void;
}

export function ShareDialog({
  documentId,
  documentTitle,
  currentUserEmail,
  open,
  onOpenChange,
  onSettingsChanged,
}: ShareDialogProps) {
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<ShareRole>("viewer");
  const [isPublic, setIsPublic] = useState(false);
  const [publicRole, setPublicRole] = useState<ShareRole>("viewer");
  const [shareToken, setShareToken] = useState("");
  const [collaborators, setCollaborators] = useState<CollaboratorShare[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const currentKey = `${documentId}:${open}`;
  const loading = open && loadedKey !== currentKey;

  useEffect(() => {
    if (!open || !documentId) return;

    let active = true;
    const keyForFetch = `${documentId}:${open}`;
    fetch(`/api/documents/${documentId}/shares`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load share settings");
        return data as ShareSettingsPayload;
      })
      .then((data) => {
        if (!active) return;
        setErrorMessage(null);
        setIsPublic(data.isPublic);
        setPublicRole(data.publicRole);
        setShareToken(data.shareToken);
        setCollaborators(data.collaborators);
      })
      .catch((err) => {
        if (!active) return;
        const msg = err instanceof Error ? err.message : "Could not load share settings";
        setErrorMessage(msg);
        toast.error(msg);
      })
      .finally(() => {
        if (active) setLoadedKey(keyForFetch);
      });

    return () => {
      active = false;
    };
  }, [open, documentId]);

  const shareUrl =
    typeof window !== "undefined" && shareToken
      ? `${window.location.origin}/share/${shareToken}`
      : `/share/${shareToken}`;

  async function inviteCollaborator(targetEmail: string, role: ShareRole) {
    const cleanEmail = targetEmail.trim().toLowerCase();
    if (!cleanEmail) return;

    setSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/documents/${documentId}/shares`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data.error || "Failed to invite collaborator";
        setErrorMessage(msg);
        toast.error(msg);
        return;
      }

      const added = data.collaborator as CollaboratorShare;
      setCollaborators((prev) => {
        const filtered = prev.filter((item) => item.id !== added.id);
        return [...filtered, added];
      });
      setEmail("");
      toast.success(`Shared with ${added.email} (${added.role})`);
    } catch {
      const msg = "Network error while sharing document";
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    await inviteCollaborator(email, inviteRole);
  }

  const availableDemoUsers = DEMO_ACCOUNTS.filter((acct) => {
    const lower = acct.email.toLowerCase();
    if (currentUserEmail && lower === currentUserEmail.trim().toLowerCase()) {
      return false;
    }
    return !collaborators.some((c) => c.email.toLowerCase() === lower);
  });

  async function handleRoleChange(shareId: string, role: ShareRole) {
    try {
      const res = await fetch(`/api/documents/${documentId}/shares/${shareId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to update role");
        return;
      }
      setCollaborators((prev) =>
        prev.map((item) => (item.id === shareId ? data.collaborator : item))
      );
      toast.success("Permissions updated");
    } catch {
      toast.error("Failed to update collaborator role");
    }
  }

  async function handleRevoke(shareId: string) {
    try {
      const res = await fetch(`/api/documents/${documentId}/shares/${shareId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to remove collaborator");
        return;
      }
      setCollaborators((prev) => prev.filter((item) => item.id !== shareId));
      toast.success("Access revoked");
    } catch {
      toast.error("Network error while removing collaborator");
    }
  }

  async function updatePublicSettings(patch: {
    isPublic?: boolean;
    publicRole?: ShareRole;
    regenerateToken?: boolean;
  }) {
    try {
      const res = await fetch(`/api/documents/${documentId}/shares`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to update link access");
        return;
      }
      setIsPublic(data.isPublic);
      setPublicRole(data.publicRole);
      setShareToken(data.shareToken);
      onSettingsChanged?.(data);
      toast.success(
        patch.regenerateToken
          ? "Share link rotated"
          : data.isPublic
            ? "Public link enabled"
            : "Public link disabled"
      );
    } catch {
      toast.error("Network error updating public link");
    }
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Share link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy link");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="truncate pr-6">Share “{documentTitle}”</DialogTitle>
          <DialogDescription>
            Invite collaborators by email or manage public link access.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading sharing settings...
          </div>
        ) : (
          <div className="space-y-6">
            {errorMessage && (
              <p
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-destructive"
              >
                {errorMessage}
              </p>
            )}

            <form onSubmit={handleInvite} className="space-y-2.5">
              <Label htmlFor="share-email">Share with collaborator</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="share-email"
                  type="email"
                  placeholder="colleague@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1"
                  required
                />
                <div className="flex gap-2">
                  <Select
                    value={inviteRole}
                    onValueChange={(value) => setInviteRole(value as ShareRole)}
                  >
                    <SelectTrigger className="w-28" aria-label="Invite role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="viewer">Viewer</SelectItem>
                      <SelectItem value="editor">Editor</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button type="submit" variant="accent" disabled={submitting}>
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <UserPlus className="h-4 w-4" />
                    )}
                    Invite
                  </Button>
                </div>
              </div>

              {availableDemoUsers.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    Demo users:
                  </span>
                  {availableDemoUsers.map((demo) => (
                    <button
                      key={demo.id}
                      type="button"
                      disabled={submitting}
                      onClick={() => void inviteCollaborator(demo.email, inviteRole)}
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary/70 px-2.5 py-0.5 text-[11px] font-medium text-foreground transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-50 cursor-pointer"
                    >
                      + {demo.fullName} ({inviteRole})
                    </button>
                  ))}
                </div>
              )}
            </form>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  Collaborators ({collaborators.length})
                </span>
              </div>

              {collaborators.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
                  Only you currently have direct access.
                </p>
              ) : (
                <ul className="max-h-48 space-y-2 overflow-y-auto pr-1">
                  {collaborators.map((collab) => (
                    <li
                      key={collab.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border bg-secondary/35 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {collab.fullName || collab.email}
                        </p>
                        {collab.fullName && (
                          <p className="truncate text-xs text-muted-foreground">
                            {collab.email}
                          </p>
                        )}
                      </div>

                      <div className="flex shrink-0 items-center gap-1.5">
                        <Select
                          value={collab.role}
                          onValueChange={(val) =>
                            handleRoleChange(collab.id, val as ShareRole)
                          }
                        >
                          <SelectTrigger className="h-8 w-24 text-xs" aria-label={`Role for ${collab.email}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="viewer">Viewer</SelectItem>
                            <SelectItem value="editor">Editor</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => handleRevoke(collab.id)}
                          aria-label={`Remove ${collab.email}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-xl border border-border bg-secondary/30 p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-card border border-border text-indigo-600">
                    {isPublic ? (
                      <Globe className="h-4 w-4" />
                    ) : (
                      <Lock className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">Public link access</p>
                      <Badge variant={isPublic ? "amber" : "secondary"}>
                        {isPublic ? "Enabled" : "Restricted"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {isPublic
                        ? "Anyone with the share link can open this document."
                        : "Only invited collaborators can open this document."}
                    </p>
                  </div>
                </div>

                <Switch
                  checked={isPublic}
                  onCheckedChange={(checked) =>
                    updatePublicSettings({ isPublic: checked })
                  }
                  aria-label="Toggle public link access"
                />
              </div>

              {isPublic && (
                <div className="space-y-2.5 pt-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">
                      Signed-in link visitors can:
                    </span>
                    <Select
                      value={publicRole}
                      onValueChange={(val) =>
                        updatePublicSettings({ publicRole: val as ShareRole })
                      }
                    >
                      <SelectTrigger className="h-8 w-36 text-xs" aria-label="Public link role">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="viewer">View only</SelectItem>
                        <SelectItem value="editor">Edit (signed in)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-2">
                    <Input
                      readOnly
                      value={shareUrl}
                      className="h-8 bg-card font-mono text-xs"
                      aria-label="Public share URL"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleCopyLink}
                    >
                      {copied ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      {copied ? "Copied" : "Copy"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => updatePublicSettings({ regenerateToken: true })}
                      title="Reset share link"
                      aria-label="Reset share link"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
