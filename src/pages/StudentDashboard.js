import React, { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  CircularProgress,
  Chip,
  IconButton,
  Tooltip,
  Snackbar,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  List,
  ListItem,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { collection, query, where, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import SearchIcon from '@mui/icons-material/Search';
import Skeleton from '@mui/material/Skeleton';



const STATUS_COLORS = {
  pending: 'default',
  approved: 'success',
  rejected: 'error',
  'under review': 'warning',
};

const STATUS_LABELS = ['all', 'pending', 'approved', 'rejected'];

const ProjectRow = ({ project, onView, onEdit, onDelete }) => {
  const [feedbackCount, setFeedbackCount] = useState(0);
  const [loadingFeedback, setLoadingFeedback] = useState(false);

  // Fetch feedback count for this project
  useEffect(() => {
    const fetchFeedbackCount = async () => {
      try {
        setLoadingFeedback(true);
        const feedbackCol = collection(db, 'projects', project.id, 'feedback');
        const feedbackSnap = await getDocs(feedbackCol);
        setFeedbackCount(feedbackSnap.docs.length);
      } catch (error) {
        console.error('Error fetching feedback count:', error);
        setFeedbackCount(0);
      } finally {
        setLoadingFeedback(false);
      }
    };

    if (project.id) {
      fetchFeedbackCount();
    }
  }, [project.id]);

  return (
    <TableRow hover>
      <TableCell sx={{ fontWeight: 'medium' }}>
        {project.title || 'Untitled Project'}
      </TableCell>
      <TableCell>
        <Chip 
          label={project.status || 'pending'} 
          color={STATUS_COLORS[project.status?.toLowerCase()] || 'default'}
          size="small"
        />
      </TableCell>
      <TableCell>
        {loadingFeedback ? (
          <Typography variant="body2" color="text.secondary">
            Loading...
          </Typography>
        ) : feedbackCount > 0 ? (
          <Tooltip title={`${feedbackCount} feedback item${feedbackCount !== 1 ? 's' : ''} available`}>
            <Button 
              variant="text" 
              size="small"
              onClick={() => onView(project)}
            >
              View Feedback ({feedbackCount})
            </Button>
          </Tooltip>
        ) : (
          <Typography variant="body2" color="text.secondary">
            No feedback yet
          </Typography>
        )}
      </TableCell>
      <TableCell>
        {project.createdAt?.toLocaleDateString() || 'N/A'}
      </TableCell>
      <TableCell align="right">
        <Tooltip title="View project details">
          <IconButton onClick={() => onView(project)}>
            <VisibilityIcon color="primary" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Edit project">
          <IconButton onClick={() => onEdit(project)}>
            <EditIcon color="primary" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Delete project">
          <IconButton onClick={() => onDelete(project)}>
            <DeleteIcon color="error" />
          </IconButton>
        </Tooltip>
      </TableCell>
    </TableRow>
  );
};


const ProjectsTable = ({ projects, loading, onView, onEdit, onDelete }) => {
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (projects.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="body1" color="text.secondary">
          No projects submitted yet. Click "Submit New Project" to get started!
        </Typography>
      </Box>
    );
  }

  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableCell sx={{ fontWeight: 'bold' }}>Title</TableCell>
          <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
          <TableCell sx={{ fontWeight: 'bold' }}>Feedback</TableCell>
          <TableCell sx={{ fontWeight: 'bold' }}>Date</TableCell>
          <TableCell sx={{ fontWeight: 'bold' }} align="right">Actions</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {projects.map((project) => (
          <ProjectRow 
            key={project.id} 
            project={project} 
            onView={onView}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </TableBody>
    </Table>
  );
};

const useProjects = (userEmail) => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (!userEmail) {
        setError('User not authenticated');
        return;
      }
      
      const q = query(
        collection(db, 'projects'),
        where('ownerEmail', '==', userEmail)
      );
      
      const snapshot = await getDocs(q);
      
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || null
      })).sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
      
      setProjects(data);
    } catch (err) {
      console.error('Error fetching projects:', err);
      setError(err.message.includes('index') ? 
        'System is preparing data (try again in a few minutes)' : 
        'Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, [userEmail]);

  const deleteProject = async (projectId) => {
    try {
      await deleteDoc(doc(db, 'projects', projectId));
      setProjects(prev => prev.filter(p => p.id !== projectId));
      return true;
    } catch (err) {
      console.error('Error deleting project:', err);
      return false;
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  return { projects, loading, error, refresh: fetchProjects, deleteProject };
};

const useSnackbar = () => {
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success',
  });

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const closeSnackbar = () => {
    setSnackbar(prev => ({ ...prev, open: false }));
  };

  return { snackbar, showSnackbar, closeSnackbar };
};

const StudentDashboard = () => {
  const [user] = useAuthState(auth);
  const { projects, loading, error, refresh, deleteProject } = useProjects(user?.email);
  const { snackbar, showSnackbar, closeSnackbar } = useSnackbar();
  const [selectedProject, setSelectedProject] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('dateDesc');
  const navigate = useNavigate();
  const [feedbackList, setFeedbackList] = useState([]);
  const [loadingFeedback, setLoadingFeedback] = useState(false);

  // Stats
  const stats = React.useMemo(() => {
    const total = projects.length;
    const approved = projects.filter(p => p.status === 'approved').length;
    const pending = projects.filter(p => p.status === 'pending').length;
    const rejected = projects.filter(p => p.status === 'rejected').length;
    return { total, approved, pending, rejected };
  }, [projects]);

  // Filtered and sorted projects
  const filteredProjects = React.useMemo(() => {
    let filtered = [...projects];
    if (statusFilter !== 'all') filtered = filtered.filter(p => (p.status || 'pending') === statusFilter);
    if (searchTerm.trim()) filtered = filtered.filter(p =>
      (p.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.description || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
    filtered.sort((a, b) => {
      const getDate = (d) => (d instanceof Date ? d.getTime() : (d && d.toDate ? d.toDate().getTime() : 0));
      if (sortBy === 'dateDesc') return getDate(b.createdAt) - getDate(a.createdAt);
      if (sortBy === 'dateAsc') return getDate(a.createdAt) - getDate(b.createdAt);
      if (sortBy === 'titleAsc') return (a.title || '').localeCompare(b.title || '');
      if (sortBy === 'titleDesc') return (b.title || '').localeCompare(a.title || '');
      return 0;
    });
    return filtered;
  }, [projects, searchTerm, statusFilter, sortBy]);

  const handleViewProject = (project) => {
    setSelectedProject(project);
  };

  const handleEditProject = (project) => {
    navigate(`/edit/${project.id}`);
  };

  const handleDeleteClick = (project) => {
    setProjectToDelete(project);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (projectToDelete) {
      const success = await deleteProject(projectToDelete.id);
      if (success) {
        showSnackbar('Project deleted successfully', 'success');
      } else {
        showSnackbar('Failed to delete project', 'error');
      }
      setDeleteDialogOpen(false);
      setProjectToDelete(null);
    }
  };

  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setProjectToDelete(null);
  };

  const handleCloseDetails = () => {
    setSelectedProject(null);
  };

  const handleRefresh = () => {
    refresh();
    showSnackbar('Projects refreshed', 'info');
  };

  const fetchFeedback = async (projectId) => {
    setLoadingFeedback(true);
    try {
      const feedbackCol = collection(db, 'projects', projectId, 'feedback');
      const feedbackSnap = await getDocs(feedbackCol);
      const feedbackData = feedbackSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || null
      }));
      setFeedbackList(feedbackData);
    } catch (error) {
      console.error('Error fetching feedback:', error);
      setFeedbackList([]);
    } finally {
      setLoadingFeedback(false);
    }
  };

  // In the Project Details Dialog, fetch feedback when opening
  useEffect(() => {
    if (selectedProject) {
      fetchFeedback(selectedProject.id);
    }
  }, [selectedProject]);

  return (
    <Box sx={{ 
      p: { xs: 2, sm: 3 },
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f8faff 0%, #e8ecff 100%)'
    }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
        <Typography variant="h4" component="h1">
          Student Dashboard
        </Typography>
        <Tooltip title="Refresh projects">
          <IconButton onClick={handleRefresh} color="primary" disabled={loading}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>
      
      {/* Stats Row */}
      <Paper sx={{ p: 2, mb: 2, display: 'flex', gap: 3, justifyContent: 'center', borderRadius: 2, flexWrap: 'wrap' }}>
        <Box textAlign="center">
          <Typography variant="subtitle2">Total</Typography>
          <Chip label={stats.total} color="primary" />
        </Box>
        <Box textAlign="center">
          <Typography variant="subtitle2">Approved</Typography>
          <Chip label={stats.approved} color="success" />
        </Box>
        <Box textAlign="center">
          <Typography variant="subtitle2">Pending</Typography>
          <Chip label={stats.pending} color="warning" />
        </Box>
        <Box textAlign="center">
          <Typography variant="subtitle2">Rejected</Typography>
          <Chip label={stats.rejected} color="error" />
        </Box>
      </Paper>

      {/* Search, Filter, Sort */}
      <Paper sx={{ p: 2, mb: 3, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2, alignItems: 'center', borderRadius: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1, width: '100%' }}>
          <SearchIcon sx={{ mr: 1, color: 'action.active' }} />
          <input
            type="text"
            placeholder="Search by title or description"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 16, width: '100%' }}
          />
        </Box>
        <Box sx={{ display: 'flex', gap: 1, width: { xs: '100%', sm: 'auto' } }}>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ padding: 8, borderRadius: 8, flex: 1 }}>
            {STATUS_LABELS.map(status => (
              <option key={status} value={status}>{status.charAt(0).toUpperCase() + status.slice(1)}</option>
            ))}
          </select>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ padding: 8, borderRadius: 8, flex: 1 }}>
            <option value="dateDesc">Newest</option>
            <option value="dateAsc">Oldest</option>
            <option value="titleAsc">Title A-Z</option>
            <option value="titleDesc">Title Z-A</option>
          </select>
        </Box>
      </Paper>

      <Paper sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2, minHeight: 200 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexDirection: { xs: 'column', sm: 'row' }, gap: 1 }}>
          <Typography variant="h6">
            Your Projects
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {filteredProjects.length} project{filteredProjects.length !== 1 ? 's' : ''} found
          </Typography>
        </Box>
        {loading ? (
          <Box sx={{ display: 'flex', gap: 2 }}>
            {[1,2,3].map(i => (
              <Skeleton key={i} variant="rectangular" width="100%" height={48} sx={{ borderRadius: 2 }} />
            ))}
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        ) : filteredProjects.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary">
              No projects match your criteria. Try adjusting your search or filters.
            </Typography>
          </Box>
        ) : (
          <ProjectsTable 
            projects={filteredProjects} 
            loading={false} 
            onView={handleViewProject}
            onEdit={handleEditProject}
            onDelete={handleDeleteClick}
          />
        )}
      </Paper>

      {/* Project Details Dialog */}
      <Dialog open={!!selectedProject} onClose={handleCloseDetails} maxWidth="md" fullWidth>
        <DialogTitle>Project Details</DialogTitle>
        <DialogContent>
          {selectedProject && (
            <>
              <Typography variant="h6" gutterBottom>
                {selectedProject.title || 'Untitled Project'}
              </Typography>
              <Box sx={{ mb: 2 }}>
                <Chip 
                  label={selectedProject.status || 'pending'} 
                  color={STATUS_COLORS[selectedProject.status?.toLowerCase()] || 'default'}
                  size="medium"
                />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Submitted on: {selectedProject.createdAt?.toLocaleDateString() || 'N/A'}
                </Typography>
              </Box>
              
              <Typography variant="subtitle1" gutterBottom>
                Description:
              </Typography>
              <Typography variant="body1" paragraph>
                {selectedProject.description || 'No description provided'}
              </Typography>
              
              {/* Feedback Section */}
              <Typography variant="subtitle1" gutterBottom>
                Feedback:
              </Typography>
              {loadingFeedback ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                  <CircularProgress />
                </Box>
              ) : feedbackList.length === 0 ? (
                <Typography color="text.secondary">No feedback yet.</Typography>
              ) : (
                <List>
                  {feedbackList.map(item => (
                    <ListItem key={item.id} alignItems="flex-start" sx={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                      <Paper variant="outlined" sx={{ p: 2, width: '100%', mb: 1 }}>
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-line', mb: 1 }}>
                          {item.text}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {item.author || 'Anonymous'} {item.role && `(${item.role})`} • {item.createdAt ? item.createdAt.toLocaleDateString() : 'Just now'}
                        </Typography>
                      </Paper>
                    </ListItem>
                  ))}
                </List>
              )}
              {/* End Feedback Section */}
              {selectedProject.feedback && (
                <>
                  <Typography variant="subtitle1" gutterBottom>
                    Faculty Feedback (legacy):
                  </Typography>
                  <Paper elevation={0} sx={{ p: 2, backgroundColor: 'grey.100', mb: 2 }}>
                    <Typography variant="body1">
                      {selectedProject.feedback}
                    </Typography>
                  </Paper>
                </>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
  <Button onClick={handleCloseDetails}>Close</Button>
  <Button 
    onClick={() => {
      handleEditProject(selectedProject);
      handleCloseDetails();
    }}
    color="primary"
  >
    Edit
  </Button>
</DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={handleCloseDeleteDialog}>
        <DialogTitle>Delete Project</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete the project "{projectToDelete?.title}"? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog}>Cancel</Button>
          <Button onClick={handleConfirmDelete} color="error" autoFocus>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={closeSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={closeSnackbar} severity={snackbar.severity}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default StudentDashboard;