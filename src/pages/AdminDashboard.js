import React, { useEffect, useState, useCallback } from 'react';
import { db } from '../firebase';
import {
  collection,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
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
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import FirstPageIcon from '@mui/icons-material/FirstPage';
import LastPageIcon from '@mui/icons-material/LastPage';
import KeyboardArrowLeft from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRight from '@mui/icons-material/KeyboardArrowRight';

import { sendNotification, NOTIFICATION_TYPES } from '../utils/notifications';

const roles = ['student', 'faculty', 'admin'];
const PAGE_SIZE = 5;
const DEBOUNCE_DELAY = 300;

const AdminDashboard = () => {
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
  const [debouncedUserSearch, setDebouncedUserSearch] = useState('');
  const [debouncedProjectSearch, setDebouncedProjectSearch] = useState('');
  
  const [userPage, setUserPage] = useState(0);
  const [projectPage, setProjectPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(PAGE_SIZE);
  
  // Delete confirmation dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  
  // Snackbar notifications
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success',
  });

  // Stats
  const userStats = React.useMemo(() => {
    const total = users.length;
    const admins = users.filter(u => u.role === 'admin').length;
    const faculty = users.filter(u => u.role === 'faculty').length;
    const students = users.filter(u => u.role === 'student').length;
    return { total, admins, faculty, students };
  }, [users]);
  const projectStats = React.useMemo(() => {
    const total = projects.length;
    const approved = projects.filter(p => p.status === 'approved').length;
    const pending = projects.filter(p => p.status === 'pending').length;
    const rejected = projects.filter(p => p.status === 'rejected').length;
    return { total, approved, pending, rejected };
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

  // Fetch users with optional filtering
  const fetchUsers = useCallback(async () => {
    try {
      setLoadingUsers(true);
      setUserError(null);
      
      let usersQuery = collection(db, 'users');
      // Add filtering if search term exists
      if (debouncedUserSearch) {
        usersQuery = query(
          usersQuery,
          where('email', '>=', debouncedUserSearch),
          where('email', '<=', debouncedUserSearch + '\uf8ff'),
          orderBy('email')
        );
      }
      
      const usersSnapshot = await getDocs(usersQuery);
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
  }, [debouncedUserSearch]);

  // Fetch projects with optional filtering
  const fetchProjects = useCallback(async () => {
    try {
      setLoadingProjects(true);
      setProjectError(null);
      
      let projectsQuery = collection(db, 'projects');
      // Add filtering if search term exists
      if (debouncedProjectSearch) {
        projectsQuery = query(
          projectsQuery,
          where('title', '>=', debouncedProjectSearch),
          where('title', '<=', debouncedProjectSearch + '\uf8ff'),
          orderBy('title')
        );
      }
      
      const projectsSnapshot = await getDocs(projectsQuery);
      const projectsList = projectsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setProjects(projectsList);
    } catch (error) {
      setProjectError('Failed to load projects. Please try again.');
      console.error('Error fetching projects:', error);
      showSnackbar('Failed to load projects', 'error');
    } finally {
      setLoadingProjects(false);
    }
  }, [debouncedProjectSearch]);

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
      // Send notification to the user about the role change
      const user = users.find(u => u.id === userId);
      if (user) {
        await sendNotification(userId, NOTIFICATION_TYPES.ROLE_CHANGED, 'Role Updated', `Your role has been updated to ${newRole}.`, { newRole, previousRole: user.role });
      }
    } catch (error) {
      console.error('Error updating role:', error);
      showSnackbar('Failed to update role', 'error');
    }
  };

  // Open delete confirmation dialog
  const confirmDeleteUser = user => {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  };

  // Delete user after confirmation
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



  // Filter users client-side if not using server-side filtering
  const filteredUsers = users.filter(
    u =>
      u.email.toLowerCase().includes(debouncedUserSearch.toLowerCase()) ||
      (u.role && u.role.toLowerCase().includes(debouncedUserSearch.toLowerCase()))
  );

  // Filter projects client-side if not using server-side filtering
  const filteredProjects = projects.filter(
    p =>
      (p.title?.toLowerCase().includes(debouncedProjectSearch.toLowerCase()) ?? false) ||
      (p.ownerEmail?.toLowerCase().includes(debouncedProjectSearch.toLowerCase()) ?? false)
  );

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
        <Box>
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

      {/* Stats Row */}
      <Paper sx={{ p: 2, mb: 2, display: 'flex', gap: 3, justifyContent: 'center', borderRadius: 2, flexWrap: 'wrap' }}>
        <Box textAlign="center">
          <Typography variant="subtitle2">Users</Typography>
          <Chip label={userStats.total} color="primary" />
        </Box>
        <Box textAlign="center">
          <Typography variant="subtitle2">Admins</Typography>
          <Chip label={userStats.admins} color="secondary" />
        </Box>
        <Box textAlign="center">
          <Typography variant="subtitle2">Faculty</Typography>
          <Chip label={userStats.faculty} color="info" />
        </Box>
        <Box textAlign="center">
          <Typography variant="subtitle2">Students</Typography>
          <Chip label={userStats.students} color="success" />
        </Box>
        <Box textAlign="center">
          <Typography variant="subtitle2">Projects</Typography>
          <Chip label={projectStats.total} color="primary" />
        </Box>
        <Box textAlign="center">
          <Typography variant="subtitle2">Approved</Typography>
          <Chip label={projectStats.approved} color="success" />
        </Box>
        <Box textAlign="center">
          <Typography variant="subtitle2">Pending</Typography>
          <Chip label={projectStats.pending} color="warning" />
        </Box>
        <Box textAlign="center">
          <Typography variant="subtitle2">Rejected</Typography>
          <Chip label={projectStats.rejected} color="error" />
        </Box>
      </Paper>

      {/* Manage Users Section */}
      <Paper sx={{ p: { xs: 2, sm: 3 }, mb: 4, borderRadius: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexDirection: { xs: 'column', sm: 'row' }, gap: 1 }}>
          <Typography variant="h6">Manage Users</Typography>
          <Typography variant="body2" color="text.secondary">
            {filteredUsers.length} user(s) found
          </Typography>
        </Box>

        <TextField
          label="Search Users"
          value={userSearch}
          onChange={e => setUserSearch(e.target.value)}
          fullWidth
          margin="normal"
          InputProps={{
            startAdornment: <SearchIcon sx={{ color: 'action.active', mr: 1 }} />,
          }}
          placeholder="Search by email or role..."
        />

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
                  <TableCell>Email</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} align="center">
                      No users found matching your criteria
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers
                    .slice(userPage * rowsPerPage, userPage * rowsPerPage + rowsPerPage)
                    .map(user => (
                      <TableRow key={user.id} hover>
                        <TableCell>{user.email}</TableCell>
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
                          <Tooltip title="Delete user">
                            <IconButton
                              onClick={() => confirmDeleteUser(user)}
                              color="error"
                              size="small"
                              sx={{ ml: 1 }}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))
                )}
              </TableBody>
            </Table>

            <TablePagination
              rowsPerPageOptions={[5, 10, 25]}
              component="div"
              count={filteredUsers.length}
              rowsPerPage={rowsPerPage}
              page={userPage}
              onPageChange={handleUserPageChange}
              onRowsPerPageChange={handleRowsPerPageChange}
              ActionsComponent={({ count, page, rowsPerPage, onPageChange }) => (
                <Box sx={{ flexShrink: 0, ml: 2 }}>
                  <IconButton
                    onClick={() => onPageChange(null, 0)}
                    disabled={page === 0}
                    aria-label="first page"
                  >
                    <FirstPageIcon />
                  </IconButton>
                  <IconButton
                    onClick={() => onPageChange(null, page - 1)}
                    disabled={page === 0}
                    aria-label="previous page"
                  >
                    <KeyboardArrowLeft />
                  </IconButton>
                  <IconButton
                    onClick={() => onPageChange(null, page + 1)}
                    disabled={page >= Math.ceil(count / rowsPerPage) - 1}
                    aria-label="next page"
                  >
                    <KeyboardArrowRight />
                  </IconButton>
                  <IconButton
                    onClick={() => onPageChange(null, Math.max(0, Math.ceil(count / rowsPerPage) - 1))}
                    disabled={page >= Math.ceil(count / rowsPerPage) - 1}
                    aria-label="last page"
                  >
                    <LastPageIcon />
                  </IconButton>
                </Box>
              )}
            />
          </>
        )}
      </Paper>

      <Divider sx={{ mb: 4 }} />

      {/* Projects Overview Section */}
      <Paper sx={{ p: 3, borderRadius: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Projects Overview</Typography>
          <Typography variant="body2" color="text.secondary">
            {filteredProjects.length} project(s) found
          </Typography>
        </Box>

        <TextField
          label="Search Projects"
          value={projectSearch}
          onChange={e => setProjectSearch(e.target.value)}
          fullWidth
          margin="normal"
          InputProps={{
            startAdornment: <SearchIcon sx={{ color: 'action.active', mr: 1 }} />,
          }}
          placeholder="Search by title or owner email..."
        />

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
                  <TableCell>Project Title</TableCell>
                  <TableCell>Owner Email</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Created</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredProjects.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center">
                      No projects found matching your criteria
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProjects
                    .slice(projectPage * rowsPerPage, projectPage * rowsPerPage + rowsPerPage)
                    .map(project => (
                      <TableRow key={project.id} hover>
                        <TableCell>{project.title || 'Untitled Project'}</TableCell>
                        <TableCell>{project.ownerEmail || 'N/A'}</TableCell>
                        <TableCell>{project.status || 'Unknown'}</TableCell>
                        <TableCell>
                          {project.createdAt?.toDate?.().toLocaleDateString() || 'N/A'}
                        </TableCell>
                      </TableRow>
                    ))
                )}
              </TableBody>
            </Table>

            <TablePagination
              rowsPerPageOptions={[5, 10, 25]}
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

      {/* Delete Confirmation Dialog */}
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