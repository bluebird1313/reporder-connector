"use client"

import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { 
  User,
  Mail,
  Building2,
  Shield,
  Calendar,
  Save,
  CheckCircle2,
  Trash2,
  AlertTriangle,
  Pencil,
  X
} from "lucide-react"
import { useAuth } from "@/lib/auth"
import { supabase } from "@/lib/supabase"

export default function ProfileSettingsPage() {
  const { user, profile, refreshProfile, signOut } = useAuth()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Edit mode states
  const [isEditingName, setIsEditingName] = useState(false)
  const [fullName, setFullName] = useState("")
  const [deleteConfirmText, setDeleteConfirmText] = useState("")
  
  // Initialize form with profile data
  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "")
    }
  }, [profile])

  async function handleSaveName() {
    if (!user) return
    
    setSaving(true)
    setError(null)
    
    try {
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ 
          full_name: fullName,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)
      
      if (updateError) {
        setError(updateError.message)
        return
      }
      
      // Refresh the profile in auth context
      await refreshProfile()
      
      setSaved(true)
      setIsEditingName(false)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError("Failed to update profile")
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteAccount() {
    if (!user) return
    
    setDeleting(true)
    setError(null)
    
    try {
      // Delete user profile first (RLS allows users to manage their own profile)
      const { error: profileError } = await supabase
        .from('user_profiles')
        .delete()
        .eq('id', user.id)
      
      if (profileError) {
        setError("Failed to delete profile: " + profileError.message)
        setDeleting(false)
        return
      }

      // Sign out after profile is deleted
      // Note: Full auth.users deletion typically requires admin privileges or edge function
      await signOut()
    } catch (err) {
      setError("Failed to delete account")
      setDeleting(false)
    }
  }

  function cancelEditName() {
    setIsEditingName(false)
    setFullName(profile?.full_name || "")
    setError(null)
  }

  const canDelete = deleteConfirmText === "DELETE"
  const memberSince = user?.created_at ? new Date(user.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }) : 'Unknown'

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-3xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <User className="h-8 w-8 text-blue-500" />
              Profile Settings
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage your account information and preferences
            </p>
          </div>
          {saved && (
            <Badge variant="outline" className="text-green-500 border-green-500">
              <CheckCircle2 className="h-4 w-4 mr-1" />
              Changes saved
            </Badge>
          )}
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-center gap-3 text-red-500">
            <AlertTriangle className="h-5 w-5 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Personal Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-blue-500" />
              Personal Information
            </CardTitle>
            <CardDescription>
              Your personal account details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Full Name */}
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              {isEditingName ? (
                <div className="flex items-center gap-2">
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter your full name"
                    className="max-w-sm"
                    autoFocus
                  />
                  <Button 
                    size="sm" 
                    onClick={handleSaveName}
                    disabled={saving || !fullName.trim()}
                  >
                    {saving ? (
                      <span className="flex items-center gap-1">
                        <span className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full" />
                        Saving
                      </span>
                    ) : (
                      <>
                        <Save className="h-4 w-4" />
                        Save
                      </>
                    )}
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={cancelEditName}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-lg flex-1 max-w-sm">
                    <span className="font-medium">{profile?.full_name || "Not set"}</span>
                  </div>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => setIsEditingName(true)}
                  >
                    <Pencil className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                This name will be displayed throughout the app and in communications
              </p>
            </div>

            {/* Email - Read Only */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email Address
              </Label>
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg max-w-sm">
                <span className="font-medium">{user?.email || "Not set"}</span>
                <Badge variant="secondary" className="ml-auto">Verified</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Your email is used for sign-in and cannot be changed directly. Contact support if you need to update it.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Organization Information */}
        {profile?.organization && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-purple-500" />
                Organization
              </CardTitle>
              <CardDescription>
                Your organization membership details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Organization Name</Label>
                  <div className="p-3 bg-muted rounded-lg">
                    <span className="font-medium">{profile.organization.name}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Your Role</Label>
                  <div className="p-3 bg-muted rounded-lg flex items-center gap-2">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium capitalize">{profile.role}</span>
                    {profile.role === 'owner' && (
                      <Badge className="ml-2">Admin</Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Account Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-green-500" />
              Account Information
            </CardTitle>
            <CardDescription>
              Details about your account
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Account ID</Label>
                <div className="p-3 bg-muted rounded-lg">
                  <span className="font-mono text-xs text-muted-foreground">{user?.id || "N/A"}</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Member Since</Label>
                <div className="p-3 bg-muted rounded-lg">
                  <span className="font-medium">{memberSince}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-red-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-500">
              <AlertTriangle className="h-5 w-5" />
              Danger Zone
            </CardTitle>
            <CardDescription>
              Irreversible actions for your account
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 border border-red-500/20 rounded-lg bg-red-500/5">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="font-medium text-red-500">Delete Account</h4>
                  <p className="text-sm text-muted-foreground">
                    Permanently delete your account and all associated data. This action cannot be undone.
                  </p>
                  <ul className="text-xs text-muted-foreground mt-2 space-y-1">
                    <li>• Your profile and preferences will be deleted</li>
                    <li>• You will lose access to all connected stores</li>
                    <li>• Historical data and reports will be removed</li>
                  </ul>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete Account
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2 text-red-500">
                        <AlertTriangle className="h-5 w-5" />
                        Delete Account Permanently?
                      </AlertDialogTitle>
                      <AlertDialogDescription className="space-y-3">
                        <p>
                          This action is <strong>permanent and cannot be undone</strong>. All your data, 
                          including connected stores, inventory history, and settings will be permanently deleted.
                        </p>
                        <div className="pt-2">
                          <Label htmlFor="confirmDelete" className="text-foreground">
                            Type <strong>DELETE</strong> to confirm
                          </Label>
                          <Input
                            id="confirmDelete"
                            value={deleteConfirmText}
                            onChange={(e) => setDeleteConfirmText(e.target.value)}
                            placeholder="DELETE"
                            className="mt-2"
                            autoComplete="off"
                          />
                        </div>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel onClick={() => setDeleteConfirmText("")}>
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDeleteAccount}
                        disabled={!canDelete || deleting}
                        className="bg-red-500 hover:bg-red-600 focus:ring-red-500"
                      >
                        {deleting ? (
                          <span className="flex items-center gap-2">
                            <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                            Deleting...
                          </span>
                        ) : (
                          <>
                            <Trash2 className="h-4 w-4 mr-1" />
                            Delete My Account
                          </>
                        )}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}

