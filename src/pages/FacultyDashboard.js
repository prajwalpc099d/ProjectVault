import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Button,
  TextField,
  Chip,
  CircularProgress,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  Skeleton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { db } from '../firebase';
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  addDoc,
  serverTimestamp,
  getDoc
} from 'firebase/firestore';
import SearchIcon from '@mui/icons-material/Search';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../firebase';
import { notifyAllUsersProjectStatusChange, notifyFeedbackSubmittedSimple, notifyProjectStatusChangeSimple } from '../utils/notifications';

const STATUS_LABELS = ['all', 'pending', 'approved', 'rejected'];

const FacultyDashboard = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedbackMap, setFeedbackMap] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('dateDesc');
  const [user] = useAuthState(auth);
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [feedbackProjectId, setFeedbackProjectId] = useState(null);
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

  const fetchProjects = async () => {
    setLoading(true);
    const projectSnapshot = await getDocs(collection(db, 'projects'));
    const projectList = projectSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
    setProjects(projectList);
    setLoading(false);
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleFeedbackChange = (projectId, value) => {
    setFeedbackMap(prev => ({
      ...prev,
      [projectId]: value,
    }));
  };

  const handleSubmitFeedback = async (projectId) => {
    const feedback = feedbackMap[projectId]?.trim();
    if (!feedback) return alert('Feedback cannot be empty.');
    try {
      // Add feedback to subcollection
      await addDoc(collection(db, 'projects', projectId, 'feedback'), {
        text: feedback,
        author: user?.email,
        role: 'faculty',
        createdAt: serverTimestamp()
      });
      
      // Clear the feedback input
      setFeedbackMap(prev => ({ ...prev, [projectId]: '' }));
      
      // Send notification to project owner about new feedback
      await notifyFeedbackSubmittedSimple(projectId, user?.email, feedback);
      
      // Refresh the feedback list if dialog is open
      if (feedbackProjectId === projectId) {
        await handleOpenFeedbackDialog(projectId);
      }
      
      alert('Feedback submitted successfully.');
    } catch (error) {
      console.error('Error submitting feedback:', error);
      alert('Failed to submit feedback.');
    }
  };

  const handleOpenFeedbackDialog = async (projectId) => {
    setFeedbackDialogOpen(true);
    setFeedbackProjectId(projectId);
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

  const handleCloseFeedbackDialog = () => {
    setFeedbackDialogOpen(false);
    setFeedbackProjectId(null);
    setFeedbackList([]);
  };

  const handleStatusUpdate = async (projectId, status) => {
    try {
      // Get the current project to get the old status
      const projectRef = doc(db, 'projects', projectId);
      const projectSnap = await getDoc(projectRef);
      const oldStatus = projectSnap.data()?.status || 'pending';
      
      await updateDoc(projectRef, { status });
      alert(`Project ${status} successfully.`);
      fetchProjects(); // refresh
      
      // Send notification to all users about status change
      const facultyName = user?.displayName || user?.email?.split('@')[0] || 'Faculty Member';
      const projectTitle = projectSnap.data()?.title || 'Project';
      await notifyAllUsersProjectStatusChange(projectId, projectTitle, oldStatus, status, facultyName);

      // Send notification to project owner specifically about status change
      await notifyProjectStatusChangeSimple(projectId, status, '', facultyName);
    } catch (error) {
      console.error(`Error updating status to ${status}:`, error);
      alert('Failed to update status.');
    }
  };

  return (
    <Box sx={{ 
      p: { xs: 2, sm: 3 },
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f8faff 0%, #e8ecff 100%)'
    }}>
      <Typography variant="h4" gutterBottom>
        Faculty Dashboard
      </Typography>

      

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

      <Paper sx={{ p: { xs: 2, sm: 2 }, borderRadius: 2, minHeight: 200, overflow: 'auto' }}>
        {loading ? (
          <Box sx={{ display: 'flex', gap: 2 }}>
            {[1,2,3].map(i => (
              <Skeleton key={i} variant="rectangular" width="100%" height={48} sx={{ borderRadius: 2 }} />
            ))}
          </Box>
        ) : filteredProjects.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary">
              No projects match your criteria. Try adjusting your search or filters.
            </Typography>
          </Box>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Title</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Owner</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Feedback</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredProjects.map(project => (
                <TableRow key={project.id} hover>
                  <TableCell>{project.title || 'Untitled'}</TableCell>
                  <TableCell>{project.description || 'N/A'}</TableCell>
                  <TableCell>{project.ownerEmail || 'N/A'}</TableCell>
                  <TableCell>
                    <Chip label={project.status || 'Pending'} color={
                      project.status === 'approved' ? 'success' :
                      project.status === 'rejected' ? 'error' :
                      project.status === 'pending' ? 'warning' : 'default'
                    } size="small" />
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      multiline
                      fullWidth
                      value={feedbackMap[project.id] || ''}
                      onChange={(e) => handleFeedbackChange(project.id, e.target.value)}
                      placeholder="Enter feedback..."
                    />
                    <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => handleSubmitFeedback(project.id)}
                        disabled={!feedbackMap[project.id]?.trim()}
                    >
                      Submit
                    </Button>
                      <Button
                        variant="text"
                        size="small"
                        onClick={() => handleOpenFeedbackDialog(project.id)}
                      >
                        View All
                      </Button>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="contained"
                      color="success"
                      size="small"
                      onClick={() => handleStatusUpdate(project.id, 'approved')}
                      sx={{ mb: 1 }}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="contained"
                      color="error"
                      size="small"
                      onClick={() => handleStatusUpdate(project.id, 'rejected')}
                    >
                      Reject
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>

      {/* Feedback Dialog */}
      <Dialog open={feedbackDialogOpen} onClose={handleCloseFeedbackDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          Project Feedback
          <IconButton
            aria-label="close"
            onClick={handleCloseFeedbackDialog}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {loadingFeedback ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
              <CircularProgress />
            </Box>
          ) : feedbackList.length === 0 ? (
            <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
              No feedback yet for this project.
            </Typography>
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
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseFeedbackDialog}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default FacultyDashboard;
