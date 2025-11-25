import React, { useEffect, useState, useCallback } from 'react';
import { db } from '../firebase';
import { useNavigate } from 'react-router-dom';
import {
  collection,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import {
  Typography,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Button,
  Select,
  MenuItem,
  Box,
  Paper,
  Divider,
  TextField,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TablePagination,
  Snackbar,
  Alert,
  IconButton,
  Tooltip,
  Chip,
  FormControl,
  InputLabel,
  Tabs,
  Tab,
  Checkbox,
  Collapse,
  Grid,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import FirstPageIcon from '@mui/icons-material/FirstPage';
import LastPageIcon from '@mui/icons-material/LastPage';
import KeyboardArrowLeft from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRight from '@mui/icons-material/KeyboardArrowRight';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DownloadIcon from '@mui/icons-material/Download';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import PersonIcon from '@mui/icons-material/Person';
import FolderIcon from '@mui/icons-material/Folder';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import SettingsIcon from '@mui/icons-material/Settings';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';

import { sendNotification, NOTIFICATION_TYPES, notifyAllUsersProjectStatusChange } from '../utils/notifications';

const roles = ['student', 'faculty', 'admin'];
const statuses = ['all', 'pending', 'approved', 'rejected'];
const PAGE_SIZE = 10;
const DEBOUNCE_DELAY = 300;

const AdminDashboard = () => {
  const navigate = useNavigate();
  
  // Tab state
  const [currentTab, setCurrentTab] = useState(0);
  
  // Users & Projects state
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  
  // Loading & error states
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [userError, setUserError] = useState(null);
  const [projectError, setProjectError] = useState(null);
  
  // Filters & Pagination
  const [userSearch, setUserSearch] = useState('');
  const [projectSearch, setProjectSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');
  const [projectStatusFilter, setProjectStatusFilter] = useState('all');
  const [debouncedUserSearch, setDebouncedUserSearch] = useState('');
  const [debouncedProjectSearch, setDebouncedProjectSearch] = useState('');
  
  const [userPage, setUserPage] = useState(0);
  const [projectPage, setProjectPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(PAGE_SIZE);
  
  // Bulk operations
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [selectedProjects, setSelectedProjects] = useState([]);
  const [expandedUsers, setExpandedUsers] = useState({});
  const [expandedProjects, setExpandedProjects] = useState({});
  
  // Delete confirmation dialogs
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [projectToDelete, setProjectToDelete] = useState(null);
  const [deleteProjectDialogOpen, setDeleteProjectDialogOpen] = useState(false);
  
  // Project status change dialog
  const [statusChangeDialogOpen, setStatusChangeDialogOpen] = useState(false);
  const [projectToUpdate, setProjectToUpdate] = useState(null);
  const [newStatus, setNewStatus] = useState('');
  
  // Snackbar notifications
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success',
  });

  // Enhanced Stats
  const userStats = React.useMemo(() => {
    const total = users.length;
    const admins = users.filter(u => u.role === 'admin').length;
    const faculty = users.filter(u => u.role === 'faculty').length;
    const students = users.filter(u => u.role === 'student').length;
    const active = users.filter(u => u.status !== 'inactive').length;
    const inactive = users.filter(u => u.status === 'inactive').length;
    return { total, admins, faculty, students, active, inactive };
  }, [users]);
  
  const projectStats = React.useMemo(() => {
    const total = projects.length;
    const approved = projects.filter(p => (p.status || '').toLowerCase() === 'approved').length;
    const pending = projects.filter(p => (p.status || '').toLowerCase() === 'pending').length;
    const rejected = projects.filter(p => (p.status || '').toLowerCase() === 'rejected').length;
    const recent = projects.filter(p => {
      // Handle createdAt - it might be a Date object, Firestore timestamp, or null
      let createdAt;
      if (p.createdAt instanceof Date) {
        createdAt = p.createdAt;
      } else if (p.createdAt && typeof p.createdAt.toDate === 'function') {
        createdAt = p.createdAt.toDate();
      } else if (p.createdAt) {
        // If it's a timestamp object, try to convert
        createdAt = new Date(p.createdAt);
      } else {
        return false; // No creation date, not recent
      }
      
      // Check if createdAt is a valid date
      if (!(createdAt instanceof Date) || isNaN(createdAt.getTime())) {
        return false;
      }
      
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      weekAgo.setHours(0, 0, 0, 0); // Set to start of day for accurate comparison
      
      const createdDate = new Date(createdAt);
      createdDate.setHours(0, 0, 0, 0);
      
      return createdDate >= weekAgo;
    }).length;
    return { total, approved, pending, rejected, recent };
  }, [projects]);

  // Debounce search inputs
  useEffect(() => {
    const userTimer = setTimeout(() => {
      setDebouncedUserSearch(userSearch);
      setUserPage(0);
    }, DEBOUNCE_DELAY);
    
    return () => clearTimeout(userTimer);
  }, [userSearch]);

  useEffect(() => {
    const projectTimer = setTimeout(() => {
      setDebouncedProjectSearch(projectSearch);
      setProjectPage(0);
    }, DEBOUNCE_DELAY);
    
    return () => clearTimeout(projectTimer);
  }, [projectSearch]);

  // Fetch users
  const fetchUsers = useCallback(async () => {
    try {
      setLoadingUsers(true);
      setUserError(null);
      
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const usersList = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setUsers(usersList);
    } catch (error) {
      setUserError('Failed to load users. Please try again.');
      console.error('Error fetching users:', error);
      showSnackbar('Failed to load users', 'error');
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  // Fetch projects
  const fetchProjects = useCallback(async () => {
    try {
      setLoadingProjects(true);
      setProjectError(null);
      
      const projectsSnapshot = await getDocs(collection(db, 'projects'));
      const projectsList = projectsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || null,
        updatedAt: doc.data().updatedAt?.toDate?.() || null,
      }));
      setProjects(projectsList);
    } catch (error) {
      setProjectError('Failed to load projects. Please try again.');
      console.error('Error fetching projects:', error);
      showSnackbar('Failed to load projects', 'error');
    } finally {
      setLoadingProjects(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchProjects();
  }, [fetchUsers, fetchProjects]);

  // Show snackbar notification
  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  // Change user role
  const handleRoleChange = async (userId, newRole) => {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, { role: newRole });
      setUsers(prev =>
        prev.map(user => (user.id === userId ? { ...user, role: newRole } : user))
      );
      showSnackbar('Role updated successfully');
      const user = users.find(u => u.id === userId);
      if (user) {
        await sendNotification(userId, NOTIFICATION_TYPES.ROLE_CHANGED, 'Role Updated', `Your role has been updated to ${newRole}.`, { newRole, previousRole: user.role });
      }
    } catch (error) {
      console.error('Error updating role:', error);
      showSnackbar('Failed to update role', 'error');
    }
  };

  // Bulk role change
  const handleBulkRoleChange = async (newRole) => {
    if (selectedUsers.length === 0) {
      showSnackbar('Please select users first', 'warning');
      return;
    }
    
    try {
      const batch = writeBatch(db);
      selectedUsers.forEach(userId => {
        const userRef = doc(db, 'users', userId);
        batch.update(userRef, { role: newRole });
      });
      await batch.commit();
      
      setUsers(prev =>
        prev.map(user => 
          selectedUsers.includes(user.id) ? { ...user, role: newRole } : user
        )
      );
      setSelectedUsers([]);
      showSnackbar(`Updated ${selectedUsers.length} user(s) to ${newRole}`, 'success');
    } catch (error) {
      console.error('Error bulk updating roles:', error);
      showSnackbar('Failed to update roles', 'error');
    }
  };

  // Toggle user selection
  const toggleUserSelection = (userId) => {
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  // Toggle all users selection
  const toggleAllUsers = () => {
    if (selectedUsers.length === filteredUsers.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(filteredUsers.map(u => u.id));
    }
  };

  // Toggle project selection
  const toggleProjectSelection = (projectId) => {
    setSelectedProjects(prev =>
      prev.includes(projectId)
        ? prev.filter(id => id !== projectId)
        : [...prev, projectId]
    );
  };

  // Toggle all projects selection
  const toggleAllProjects = () => {
    if (selectedProjects.length === filteredProjects.length) {
      setSelectedProjects([]);
    } else {
      setSelectedProjects(filteredProjects.map(p => p.id));
    }
  };

  // Bulk project status change
  const handleBulkStatusChange = async (newStatus) => {
    if (selectedProjects.length === 0) {
      showSnackbar('Please select projects first', 'warning');
      return;
    }
    
    try {
      const batch = writeBatch(db);
      selectedProjects.forEach(projectId => {
        const projectRef = doc(db, 'projects', projectId);
        batch.update(projectRef, { 
          status: newStatus,
          updatedAt: serverTimestamp()
        });
      });
      await batch.commit();
      
      setProjects(prev =>
        prev.map(project => 
          selectedProjects.includes(project.id) 
            ? { ...project, status: newStatus } 
            : project
        )
      );
      
      // Send notifications
      for (const projectId of selectedProjects) {
        const project = projects.find(p => p.id === projectId);
        if (project) {
          await notifyAllUsersProjectStatusChange(
            projectId,
            project.title || 'Project',
            project.status || 'pending',
            newStatus,
            'Admin',
            ''
          );
        }
      }
      
      setSelectedProjects([]);
      showSnackbar(`Updated ${selectedProjects.length} project(s) to ${newStatus}`, 'success');
    } catch (error) {
      console.error('Error bulk updating status:', error);
      showSnackbar('Failed to update project statuses', 'error');
    }
  };

  // Update project status
  const handleStatusChange = async () => {
    if (!projectToUpdate || !newStatus) return;
    
    try {
      const projectRef = doc(db, 'projects', projectToUpdate.id);
      const oldStatus = projectToUpdate.status || 'pending';
      await updateDoc(projectRef, { 
        status: newStatus,
        updatedAt: serverTimestamp()
      });
      
      setProjects(prev =>
        prev.map(p => p.id === projectToUpdate.id ? { ...p, status: newStatus } : p)
      );
      
      await notifyAllUsersProjectStatusChange(
        projectToUpdate.id,
        projectToUpdate.title || 'Project',
        oldStatus,
        newStatus,
        'Admin',
        ''
      );
      
      showSnackbar('Project status updated successfully');
      setStatusChangeDialogOpen(false);
      setProjectToUpdate(null);
      setNewStatus('');
    } catch (error) {
      console.error('Error updating status:', error);
      showSnackbar('Failed to update project status', 'error');
    }
  };

  // Delete user
  const confirmDeleteUser = user => {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    try {
      const userRef = doc(db, 'users', userToDelete.id);
      await deleteDoc(userRef);
      setUsers(prev => prev.filter(user => user.id !== userToDelete.id));
      showSnackbar('User deleted successfully');
    } catch (error) {
      console.error('Error deleting user:', error);
      showSnackbar('Failed to delete user', 'error');
    } finally {
      setDeleteDialogOpen(false);
      setUserToDelete(null);
    }
  };

  // Delete project
  const confirmDeleteProject = project => {
    setProjectToDelete(project);
    setDeleteProjectDialogOpen(true);
  };

  const handleDeleteProject = async () => {
    if (!projectToDelete) return;

    try {
      const projectRef = doc(db, 'projects', projectToDelete.id);
      await deleteDoc(projectRef);
      setProjects(prev => prev.filter(project => project.id !== projectToDelete.id));
      showSnackbar('Project deleted successfully');
    } catch (error) {
      console.error('Error deleting project:', error);
      showSnackbar('Failed to delete project', 'error');
    } finally {
      setDeleteProjectDialogOpen(false);
      setProjectToDelete(null);
    }
  };

  // Export to CSV
  const exportToCSV = (data, filename, headers) => {
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => {
        const value = row[header.toLowerCase().replace(/\s+/g, '')] || '';
        return `"${String(value).replace(/"/g, '""')}"`;
      }).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportUsers = () => {
    const userData = filteredUsers.map(user => ({
      email: user.email || '',
      role: user.role || '',
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      status: user.status || 'active',
      createdAt: user.createdAt?.toDate?.()?.toLocaleDateString() || 'N/A',
    }));
    exportToCSV(userData, 'users_export.csv', ['Email', 'Role', 'First Name', 'Last Name', 'Status', 'Created At']);
    showSnackbar('Users exported successfully', 'success');
  };

  const exportProjects = () => {
    const projectData = filteredProjects.map(project => ({
      title: project.title || '',
      ownerEmail: project.ownerEmail || '',
      status: project.status || 'pending',
      createdAt: project.createdAt?.toLocaleDateString() || 'N/A',
      tags: (project.tags || []).join('; ') || '',
    }));
    exportToCSV(projectData, 'projects_export.csv', ['Title', 'Owner Email', 'Status', 'Created At', 'Tags']);
    showSnackbar('Projects exported successfully', 'success');
  };

  // Toggle user expansion
  const toggleUserExpansion = (userId) => {
    setExpandedUsers(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };

  // Toggle project expansion
  const toggleProjectExpansion = (projectId) => {
    setExpandedProjects(prev => ({
      ...prev,
      [projectId]: !prev[projectId]
    }));
  };

  // Filter users
  const filteredUsers = React.useMemo(() => {
    let filtered = [...users];
    
    if (debouncedUserSearch) {
      const search = debouncedUserSearch.toLowerCase();
      filtered = filtered.filter(u =>
        (u.email || '').toLowerCase().includes(search) ||
        (u.firstName || '').toLowerCase().includes(search) ||
        (u.lastName || '').toLowerCase().includes(search) ||
        (u.role || '').toLowerCase().includes(search)
  );
    }
    
    if (userRoleFilter !== 'all') {
      filtered = filtered.filter(u => (u.role || '').toLowerCase() === userRoleFilter.toLowerCase());
    }
    
    return filtered;
  }, [users, debouncedUserSearch, userRoleFilter]);

  // Filter projects
  const filteredProjects = React.useMemo(() => {
    let filtered = [...projects];
    
    if (debouncedProjectSearch) {
      const search = debouncedProjectSearch.toLowerCase();
      filtered = filtered.filter(p =>
        (p.title || '').toLowerCase().includes(search) ||
        (p.description || '').toLowerCase().includes(search) ||
        (p.ownerEmail || '').toLowerCase().includes(search)
      );
    }
    
    if (projectStatusFilter !== 'all') {
      filtered = filtered.filter(p => 
        (p.status || 'pending').toLowerCase() === projectStatusFilter.toLowerCase()
  );
    }
    
    return filtered;
  }, [projects, debouncedProjectSearch, projectStatusFilter]);

  // Handle page changes
  const handleUserPageChange = (event, newPage) => {
    setUserPage(newPage);
  };

  const handleProjectPageChange = (event, newPage) => {
    setProjectPage(newPage);
  };

  const handleRowsPerPageChange = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setUserPage(0);
    setProjectPage(0);
  };

  return (
    <Box sx={{ 
      p: { xs: 2, sm: 3 },
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f8faff 0%, #e8ecff 100%)'
    }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
        <Typography variant="h4">Admin Dashboard</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Refresh all data">
            <IconButton 
              onClick={() => {
                fetchUsers();
                fetchProjects();
              }}
              color="primary"
            >
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Enhanced Stats Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">Total Users</Typography>
                  <Typography variant="h4">{userStats.total}</Typography>
        </Box>
                <PersonIcon color="primary" sx={{ fontSize: 40 }} />
        </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">Total Projects</Typography>
                  <Typography variant="h4">{projectStats.total}</Typography>
        </Box>
                <FolderIcon color="primary" sx={{ fontSize: 40 }} />
        </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">Pending Projects</Typography>
                  <Typography variant="h4" color="warning.main">{projectStats.pending}</Typography>
        </Box>
                <AnalyticsIcon color="warning" sx={{ fontSize: 40 }} />
        </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">Recent Projects (7d)</Typography>
                  <Typography variant="h4" color="success.main">{projectStats.recent}</Typography>
        </Box>
                <SettingsIcon color="success" sx={{ fontSize: 40 }} />
        </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Detailed Stats */}
      <Paper sx={{ p: 2, mb: 3, borderRadius: 2 }}>
        <Typography variant="h6" gutterBottom>Statistics Overview</Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" color="textSecondary" gutterBottom>User Breakdown</Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Chip label={`Admins: ${userStats.admins}`} color="secondary" size="small" />
              <Chip label={`Faculty: ${userStats.faculty}`} color="info" size="small" />
              <Chip label={`Students: ${userStats.students}`} color="success" size="small" />
              <Chip label={`Active: ${userStats.active}`} color="primary" size="small" />
            </Box>
          </Grid>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" color="textSecondary" gutterBottom>Project Breakdown</Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Chip label={`Approved: ${projectStats.approved}`} color="success" size="small" />
              <Chip label={`Pending: ${projectStats.pending}`} color="warning" size="small" />
              <Chip label={`Rejected: ${projectStats.rejected}`} color="error" size="small" />
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Tabs */}
      <Paper sx={{ mb: 3, borderRadius: 2 }}>
        <Tabs value={currentTab} onChange={(e, newValue) => setCurrentTab(newValue)}>
          <Tab icon={<PersonIcon />} label="Users" />
          <Tab icon={<FolderIcon />} label="Projects" />
        </Tabs>
      </Paper>

      {/* Users Tab */}
      {currentTab === 0 && (
      <Paper sx={{ p: { xs: 2, sm: 3 }, mb: 4, borderRadius: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
          <Typography variant="h6">Manage Users</Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {selectedUsers.length > 0 && (
                <>
                  <FormControl size="small" sx={{ minWidth: 120 }}>
                    <InputLabel>Bulk Role</InputLabel>
                    <Select
                      value=""
                      label="Bulk Role"
                      onChange={(e) => handleBulkRoleChange(e.target.value)}
                    >
                      {roles.map(role => (
                        <MenuItem key={role} value={role}>{role}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Button
                    variant="outlined"
                    startIcon={<DownloadIcon />}
                    onClick={exportUsers}
                  >
                    Export CSV
                  </Button>
                </>
              )}
              <Typography variant="body2" color="text.secondary" sx={{ alignSelf: 'center' }}>
            {filteredUsers.length} user(s) found
          </Typography>
            </Box>
        </Box>

          <Box sx={{ display: 'flex', gap: 2, mb: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
        <TextField
          label="Search Users"
          value={userSearch}
          onChange={e => setUserSearch(e.target.value)}
          fullWidth
              size="small"
          InputProps={{
            startAdornment: <SearchIcon sx={{ color: 'action.active', mr: 1 }} />,
          }}
              placeholder="Search by email, name, or role..."
        />
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Filter by Role</InputLabel>
              <Select
                value={userRoleFilter}
                label="Filter by Role"
                onChange={(e) => setUserRoleFilter(e.target.value)}
              >
                <MenuItem value="all">All Roles</MenuItem>
                {roles.map(role => (
                  <MenuItem key={role} value={role}>{role.charAt(0).toUpperCase() + role.slice(1)}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

        {loadingUsers ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : userError ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {userError}
            <Button onClick={fetchUsers} color="inherit" size="small" sx={{ ml: 1 }}>
              Retry
            </Button>
          </Alert>
        ) : (
          <>
            <Table size="small" sx={{ mt: 2 }}>
              <TableHead>
                <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox
                        indeterminate={selectedUsers.length > 0 && selectedUsers.length < filteredUsers.length}
                        checked={filteredUsers.length > 0 && selectedUsers.length === filteredUsers.length}
                        onChange={toggleAllUsers}
                      />
                    </TableCell>
                  <TableCell>Email</TableCell>
                    <TableCell>Name</TableCell>
                  <TableCell>Role</TableCell>
                    <TableCell>Status</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                      <TableCell colSpan={6} align="center">
                      No users found matching your criteria
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers
                    .slice(userPage * rowsPerPage, userPage * rowsPerPage + rowsPerPage)
                    .map(user => (
                        <React.Fragment key={user.id}>
                          <TableRow hover>
                            <TableCell padding="checkbox">
                              <Checkbox
                                checked={selectedUsers.includes(user.id)}
                                onChange={() => toggleUserSelection(user.id)}
                              />
                            </TableCell>
                        <TableCell>{user.email}</TableCell>
                            <TableCell>{`${user.firstName || ''} ${user.lastName || ''}`.trim() || 'N/A'}</TableCell>
                        <TableCell>
                          <Select
                            value={user.role || 'student'}
                            onChange={e => handleRoleChange(user.id, e.target.value)}
                            size="small"
                            sx={{ minWidth: 120 }}
                          >
                            {roles.map(role => (
                              <MenuItem key={role} value={role}>
                                {role}
                              </MenuItem>
                            ))}
                          </Select>
                        </TableCell>
                        <TableCell>
                              <Chip 
                                label={user.status || 'active'} 
                                size="small"
                                color={user.status === 'inactive' ? 'default' : 'success'}
                              />
                            </TableCell>
                            <TableCell>
                              <Box sx={{ display: 'flex', gap: 0.5 }}>
                                <Tooltip title="View Details">
                                  <IconButton
                                    size="small"
                                    onClick={() => toggleUserExpansion(user.id)}
                                  >
                                    {expandedUsers[user.id] ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                                  </IconButton>
                                </Tooltip>
                          <Tooltip title="Delete user">
                            <IconButton
                              onClick={() => confirmDeleteUser(user)}
                              color="error"
                              size="small"
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Tooltip>
                              </Box>
                        </TableCell>
                      </TableRow>
                          <TableRow>
                            <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={6}>
                              <Collapse in={expandedUsers[user.id]} timeout="auto" unmountOnExit>
                                <Box sx={{ margin: 2 }}>
                                  <Typography variant="h6" gutterBottom>User Details</Typography>
                                  <List dense>
                                    <ListItem>
                                      <ListItemText primary="User ID" secondary={user.id} />
                                    </ListItem>
                                    <ListItem>
                                      <ListItemText primary="Email" secondary={user.email} />
                                    </ListItem>
                                    <ListItem>
                                      <ListItemText primary="Role" secondary={user.role || 'student'} />
                                    </ListItem>
                                    <ListItem>
                                      <ListItemText primary="Status" secondary={user.status || 'active'} />
                                    </ListItem>
                                    {user.createdAt && (
                                      <ListItem>
                                        <ListItemText 
                                          primary="Created At" 
                                          secondary={user.createdAt?.toDate?.()?.toLocaleDateString() || 'N/A'} 
                                        />
                                      </ListItem>
                                    )}
                                    {user.lastLogin && (
                                      <ListItem>
                                        <ListItemText 
                                          primary="Last Login" 
                                          secondary={user.lastLogin?.toDate?.()?.toLocaleDateString() || 'Never'} 
                                        />
                                      </ListItem>
                                    )}
                                  </List>
                                </Box>
                              </Collapse>
                            </TableCell>
                          </TableRow>
                        </React.Fragment>
                    ))
                )}
              </TableBody>
            </Table>

            <TablePagination
                rowsPerPageOptions={[5, 10, 25, 50]}
              component="div"
              count={filteredUsers.length}
              rowsPerPage={rowsPerPage}
              page={userPage}
              onPageChange={handleUserPageChange}
              onRowsPerPageChange={handleRowsPerPageChange}
            />
          </>
        )}
      </Paper>
      )}

      {/* Projects Tab */}
      {currentTab === 1 && (
        <Paper sx={{ p: { xs: 2, sm: 3 }, mb: 4, borderRadius: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
            <Typography variant="h6">Manage Projects</Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {selectedProjects.length > 0 && (
                <>
                  <FormControl size="small" sx={{ minWidth: 120 }}>
                    <InputLabel>Bulk Status</InputLabel>
                    <Select
                      value=""
                      label="Bulk Status"
                      onChange={(e) => handleBulkStatusChange(e.target.value)}
                    >
                      <MenuItem value="approved">Approve</MenuItem>
                      <MenuItem value="rejected">Reject</MenuItem>
                      <MenuItem value="pending">Pending</MenuItem>
                    </Select>
                  </FormControl>
                  <Button
                    variant="outlined"
                    startIcon={<DownloadIcon />}
                    onClick={exportProjects}
                  >
                    Export CSV
                  </Button>
                </>
              )}
              <Typography variant="body2" color="text.secondary" sx={{ alignSelf: 'center' }}>
            {filteredProjects.length} project(s) found
          </Typography>
            </Box>
        </Box>

          <Box sx={{ display: 'flex', gap: 2, mb: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
        <TextField
          label="Search Projects"
          value={projectSearch}
          onChange={e => setProjectSearch(e.target.value)}
          fullWidth
              size="small"
          InputProps={{
            startAdornment: <SearchIcon sx={{ color: 'action.active', mr: 1 }} />,
          }}
              placeholder="Search by title, description, or owner..."
        />
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Filter by Status</InputLabel>
              <Select
                value={projectStatusFilter}
                label="Filter by Status"
                onChange={(e) => setProjectStatusFilter(e.target.value)}
              >
                {statuses.map(status => (
                  <MenuItem key={status} value={status}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

        {loadingProjects ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : projectError ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {projectError}
            <Button onClick={fetchProjects} color="inherit" size="small" sx={{ ml: 1 }}>
              Retry
            </Button>
          </Alert>
        ) : (
          <>
            <Table size="small" sx={{ mt: 2 }}>
              <TableHead>
                <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox
                        indeterminate={selectedProjects.length > 0 && selectedProjects.length < filteredProjects.length}
                        checked={filteredProjects.length > 0 && selectedProjects.length === filteredProjects.length}
                        onChange={toggleAllProjects}
                      />
                    </TableCell>
                    <TableCell>Title</TableCell>
                    <TableCell>Owner</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Created</TableCell>
                    <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredProjects.length === 0 ? (
                  <TableRow>
                      <TableCell colSpan={6} align="center">
                      No projects found matching your criteria
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProjects
                    .slice(projectPage * rowsPerPage, projectPage * rowsPerPage + rowsPerPage)
                    .map(project => (
                        <React.Fragment key={project.id}>
                          <TableRow hover>
                            <TableCell padding="checkbox">
                              <Checkbox
                                checked={selectedProjects.includes(project.id)}
                                onChange={() => toggleProjectSelection(project.id)}
                              />
                            </TableCell>
                        <TableCell>{project.title || 'Untitled Project'}</TableCell>
                        <TableCell>{project.ownerEmail || 'N/A'}</TableCell>
                        <TableCell>
                              <Chip 
                                label={(project.status || 'pending').charAt(0).toUpperCase() + (project.status || 'pending').slice(1).toLowerCase()} 
                                size="small"
                                color={
                                  (project.status || '').toLowerCase() === 'approved' ? 'success' : 
                                  (project.status || '').toLowerCase() === 'rejected' ? 'error' : 
                                  (project.status || '').toLowerCase() === 'pending' ? 'warning' : 'default'
                                }
                              />
                            </TableCell>
                            <TableCell>
                              {project.createdAt?.toLocaleDateString() || 'N/A'}
                            </TableCell>
                            <TableCell>
                              <Box sx={{ display: 'flex', gap: 0.5 }}>
                                <Tooltip title="View Project">
                                  <IconButton
                                    size="small"
                                    onClick={() => navigate(`/projects/${project.id}`)}
                                  >
                                    <VisibilityIcon />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Change Status">
                                  <IconButton
                                    size="small"
                                    onClick={() => {
                                      setProjectToUpdate(project);
                                      setNewStatus(project.status || 'pending');
                                      setStatusChangeDialogOpen(true);
                                    }}
                                  >
                                    <SettingsIcon />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Delete Project">
                                  <IconButton
                                    onClick={() => confirmDeleteProject(project)}
                                    color="error"
                                    size="small"
                                  >
                                    <DeleteIcon />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                        </TableCell>
                      </TableRow>
                          <TableRow>
                            <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={6}>
                              <Collapse in={expandedProjects[project.id]} timeout="auto" unmountOnExit>
                                <Box sx={{ margin: 2 }}>
                                  <Typography variant="h6" gutterBottom>Project Details</Typography>
                                  <List dense>
                                    <ListItem>
                                      <ListItemText primary="Project ID" secondary={project.id} />
                                    </ListItem>
                                    <ListItem>
                                      <ListItemText primary="Title" secondary={project.title || 'N/A'} />
                                    </ListItem>
                                    <ListItem>
                                      <ListItemText primary="Description" secondary={project.description?.slice(0, 100) || 'N/A'} />
                                    </ListItem>
                                    <ListItem>
                                      <ListItemText primary="Owner Email" secondary={project.ownerEmail || 'N/A'} />
                                    </ListItem>
                                    <ListItem>
                                      <ListItemText primary="Status" secondary={project.status || 'pending'} />
                                    </ListItem>
                                    <ListItem>
                                      <ListItemText 
                                        primary="Tags" 
                                        secondary={(project.tags || []).join(', ') || 'No tags'} 
                                      />
                                    </ListItem>
                                    <ListItem>
                                      <ListItemText 
                                        primary="Created At" 
                                        secondary={project.createdAt?.toLocaleDateString() || 'N/A'} 
                                      />
                                    </ListItem>
                                  </List>
                                </Box>
                              </Collapse>
                            </TableCell>
                          </TableRow>
                        </React.Fragment>
                    ))
                )}
              </TableBody>
            </Table>

            <TablePagination
                rowsPerPageOptions={[5, 10, 25, 50]}
              component="div"
              count={filteredProjects.length}
              rowsPerPage={rowsPerPage}
              page={projectPage}
              onPageChange={handleProjectPageChange}
              onRowsPerPageChange={handleRowsPerPageChange}
            />
          </>
        )}
      </Paper>
      )}

      {/* Delete User Confirmation Dialog */}
      <Dialog 
        open={deleteDialogOpen} 
        onClose={() => setDeleteDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Confirm User Deletion</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to permanently delete user <strong>{userToDelete?.email}</strong>?
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleDeleteUser} 
            color="error"
            variant="contained"
            startIcon={<DeleteIcon />}
          >
            Delete User
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Project Confirmation Dialog */}
      <Dialog 
        open={deleteProjectDialogOpen} 
        onClose={() => setDeleteProjectDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Confirm Project Deletion</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to permanently delete project <strong>{projectToDelete?.title || 'this project'}</strong>?
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteProjectDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleDeleteProject} 
            color="error"
            variant="contained"
            startIcon={<DeleteIcon />}
          >
            Delete Project
          </Button>
        </DialogActions>
      </Dialog>

      {/* Status Change Dialog */}
      <Dialog 
        open={statusChangeDialogOpen} 
        onClose={() => setStatusChangeDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Change Project Status</DialogTitle>
        <DialogContent>
          <Typography variant="body2" gutterBottom>
            Project: <strong>{projectToUpdate?.title || 'N/A'}</strong>
          </Typography>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>New Status</InputLabel>
            <Select
              value={newStatus}
              label="New Status"
              onChange={(e) => setNewStatus(e.target.value)}
            >
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="approved">Approved</MenuItem>
              <MenuItem value="rejected">Rejected</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStatusChangeDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleStatusChange} 
            variant="contained"
            disabled={!newStatus || newStatus === projectToUpdate?.status}
          >
            Update Status
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default AdminDashboard;
