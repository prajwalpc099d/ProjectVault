import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Card, CardContent, CardActions, Button,
  Alert, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, MenuItem, Select, InputLabel, FormControl,
  Chip, IconButton, Tooltip, Badge, Snackbar, Skeleton, Paper, Divider,
  List, ListItem, ListItemText, Collapse, Grow
} from '@mui/material';
import Favorite from '@mui/icons-material/Favorite';
import FavoriteBorder from '@mui/icons-material/FavoriteBorder';
import Bookmark from '@mui/icons-material/Bookmark';
import BookmarkBorder from '@mui/icons-material/BookmarkBorder';
import ThumbUp from '@mui/icons-material/ThumbUp';
import ThumbUpOffAlt from '@mui/icons-material/ThumbUpOffAlt';
import Refresh from '@mui/icons-material/Refresh';
import Edit from '@mui/icons-material/Edit';
import Delete from '@mui/icons-material/Delete';
import GitHubIcon from '@mui/icons-material/GitHub';
import Visibility from '@mui/icons-material/Visibility';
import ReportIcon from '@mui/icons-material/Description';
import ZipIcon from '@mui/icons-material/FolderZip';
import ImageIcon from '@mui/icons-material/Image';
import VideoIcon from '@mui/icons-material/Videocam';

import {
  collection, getDocs, query, orderBy, doc, updateDoc, getDoc,
  where, writeBatch, serverTimestamp
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useNavigate } from 'react-router-dom';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { notifyAllUsersProjectUpdate, notifyAllUsersProjectDeletion, notifyProjectInteractionSimple } from '../utils/notifications';

// Constants
const statuses = ['all', 'pending', 'approved', 'rejected'];
const sortOptions = [
  { value: 'dateDesc', label: 'Date (Newest first)' },
  { value: 'dateAsc', label: 'Date (Oldest first)' },
  { value: 'titleAsc', label: 'Title (A → Z)' },
  { value: 'titleDesc', label: 'Title (Z → A)' },
  { value: 'likesDesc', label: 'Most Liked' },
  { value: 'usefulDesc', label: 'Most Useful' }
];

const interestOptions = [
  'AI', 'Machine Learning', 'Web Development', 'Mobile App', 'Data Science',
  'Blockchain', 'IoT', 'Cybersecurity', 'Cloud Computing', 'Game Development',
];

const FileTypeIcon = ({ type }) => {
  if (type?.includes('zip') || type?.includes('rar')) return <ZipIcon color="primary" />;
  if (type?.includes('pdf')) return <ReportIcon color="error" />;
  if (type?.includes('image')) return <ImageIcon color="success" />;
  if (type?.includes('video')) return <VideoIcon color="warning" />;
  return null;
};

const Recommendations = () => {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchRecommendations = async () => {
      try {
        setLoading(true);
        setError(null);
        
        if (!auth.currentUser) {
          setLoading(false);
          return;
        }

        // First try the cloud function
        try {
          const functions = getFunctions();
          const getRecs = httpsCallable(functions, 'getRecommendations');
          
          const response = await getRecs({ userId: auth.currentUser.uid });
          
          if (response.data?.recommendations) {
            setRecommendations(response.data.recommendations);
            return;
          }
        } catch (cloudError) {
          console.log("Cloud function failed, falling back to local logic", cloudError);
        }

        // Fallback logic if cloud function fails
        const userInteractionsRef = collection(db, 'users', auth.currentUser.uid, 'interactions');
        const userInteractionsSnap = await getDocs(userInteractionsRef);
        
        const likedProjects = [];
        userInteractionsSnap.forEach(doc => {
          if (doc.data().liked) {
            likedProjects.push(doc.id);
          }
        });

        if (likedProjects.length === 0) {
          setRecommendations([]);
          return;
        }

        // Get projects with similar tags to liked projects
        // In the fetchRecommendations function, update this part:
const likedProjectsData = await Promise.all(
  likedProjects.map(projectId => getDoc(doc(db, 'projects', projectId)))
);

const likedTags = new Set();
likedProjectsData.forEach(project => {
  if (project.exists()) {
    // Ensure tags is always treated as an array
    const tags = Array.isArray(project.data().tags) ? project.data().tags : [];
    tags.forEach(tag => likedTags.add(tag));
  }
});

        const projectsQuery = query(
          collection(db, 'projects'),
          where('tags', 'array-contains-any', Array.from(likedTags))
        );
        const projectsSnapshot = await getDocs(projectsQuery);

        const recommended = projectsSnapshot.docs
          .filter(doc => !likedProjects.includes(doc.id))
          .map(doc => ({
            id: doc.id,
            ...doc.data(),
            matchScore: 3 // Default match score for local recommendations
          }))
          .slice(0, 3); // Limit to 3 recommendations

        setRecommendations(recommended);
      } catch (err) {
        console.error("Recommendation error:", err);
        setError(err.message || 'Failed to load recommendations');
      } finally {
        setLoading(false);
      }
    };

    fetchRecommendations();
  }, []);

  if (!auth.currentUser) return null;

  if (loading) return (
    <Box sx={{ display: 'flex', gap: 2, py: 1 }}>
      {[1, 2, 3].map(i => (
        <Card key={i} sx={{ minWidth: 275, flexShrink: 0 }}>
          <CardContent>
            <Skeleton variant="text" width="80%" height={30} />
            <Skeleton variant="rectangular" width="100%" height={80} sx={{ my: 1 }} />
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Skeleton variant="rounded" width={60} height={24} />
              <Skeleton variant="rounded" width={60} height={24} />
            </Box>
          </CardContent>
          <CardActions>
            <Skeleton variant="rounded" width={80} height={36} />
          </CardActions>
        </Card>
      ))}
    </Box>
  );

  if (error) return (
    <Alert severity="error" sx={{ mb: 2 }}>
      {error.includes('internal') ? 'Recommendation service unavailable' : error}
    </Alert>
  );

  if (recommendations.length === 0) return (
    <Box sx={{ p: 2 }}>
      <Typography variant="body2" color="text.secondary">
        No recommendations available. Like some projects to get personalized recommendations.
      </Typography>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', overflowX: 'auto', gap: 2, py: 1 }}>
      {recommendations.map(project => (
        <Card key={project.id} sx={{ minWidth: 275, flexShrink: 0 }}>
          <CardContent>
            <Typography variant="h6">{project.title}</Typography>
            {project.matchScore && (
              <Tooltip title={`Recommended (${project.matchScore}/5 match)`}>
                <Chip 
                  label="Recommended" 
                  color="primary" 
                  size="small" 
                  sx={{ my: 1 }} 
                />
              </Tooltip>
            )}
            <Typography 
              variant="body2" 
              color="text.secondary" 
              sx={{ 
                mt: 1, 
                mb: 2,
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden'
              }}
            >
              {project.description}
            </Typography>
            
            {project.tags?.length > 0 && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
                {project.tags.slice(0, 3).map(tag => (
                  <Chip key={tag} label={tag} size="small" />
                ))}
              </Box>
            )}
          </CardContent>
          <CardActions>
            <Button 
              size="small" 
              startIcon={<Visibility />}
              onClick={() => navigate(`/projects/${project.id}`)}
            >
              View
            </Button>
            {project.githubLink && (
              <Button
                size="small"
                startIcon={<GitHubIcon />}
                href={project.githubLink}
                target="_blank"
                rel="noopener noreferrer"
              >
                GitHub
              </Button>
            )}
          </CardActions>
        </Card>
      ))}
    </Box>
  );
};

const ViewProjects = () => {
  // State management
  const [projects, setProjects] = useState([]);
  // Derived list will be computed via useMemo to avoid extra renders
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [user] = useAuthState(auth);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const navigate = useNavigate();
  const [expandedProject, setExpandedProject] = useState(null);

  // Filter and sort state
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('dateDesc');
  const [selectedInterests, setSelectedInterests] = useState([]);

  // Edit dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [editProject, setEditProject] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editLink, setEditLink] = useState('');
  const [editTags, setEditTags] = useState([]);

  // Interaction state
  const [interactions, setInteractions] = useState({});
  const [interactionCounts, setInteractionCounts] = useState({});

  // Debounce search input to reduce recomputations
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchTerm), 200);
    return () => clearTimeout(id);
  }, [searchTerm]);

  // Compute filteredProjects from inputs to avoid state churn that can cause flicker
  const filteredProjects = React.useMemo(() => {
    let filtered = [...projects];

    if (statusFilter !== 'all') {
      filtered = filtered.filter(proj => proj.status?.toLowerCase() === statusFilter);
    }

    if (debouncedSearch.trim()) {
      const term = debouncedSearch.toLowerCase();
      filtered = filtered.filter(proj =>
        (proj.title || '').toLowerCase().includes(term) ||
        (proj.description || '').toLowerCase().includes(term)
      );
    }

    if (selectedInterests.length > 0) {
      filtered = filtered.filter(proj => proj.tags?.some(tag => selectedInterests.includes(tag)));
    }

    const getDate = (d) => (d instanceof Date ? d.getTime() : (d && d.toDate ? d.toDate().getTime() : 0));
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'dateDesc':
          return getDate(b.createdAt) - getDate(a.createdAt);
        case 'dateAsc':
          return getDate(a.createdAt) - getDate(b.createdAt);
        case 'titleAsc':
          return (a.title || '').localeCompare(b.title || '');
        case 'titleDesc':
          return (b.title || '').localeCompare(a.title || '');
        case 'likesDesc':
          return (interactionCounts[b.id]?.likes || 0) - (interactionCounts[a.id]?.likes || 0);
        case 'usefulDesc':
          return (interactionCounts[b.id]?.useful || 0) - (interactionCounts[a.id]?.useful || 0);
        default:
          return 0;
      }
    });

    return filtered;
  }, [projects, statusFilter, debouncedSearch, selectedInterests, sortBy, interactionCounts]);

  const showSnackbar = (message, severity = 'info') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCloseSnackbar = () => {
    setSnackbar(prev => ({ ...prev, open: false }));
  };

  const isProjectOwner = (project) => {
    if (!user) return false;
    return user.email === project.ownerEmail || user.uid === project.ownerId;
  };

  const handleViewProject = (projectId) => {
    navigate(`/projects/${projectId}`);
  };

  const toggleProjectExpand = (projectId) => {
    setExpandedProject(expandedProject === projectId ? null : projectId);
  };

  const fetchProjects = React.useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const projectsQuery = query(collection(db, 'projects'), orderBy('createdAt', 'desc'));
      const projectsSnapshot = await getDocs(projectsQuery);

      if (projectsSnapshot.empty) {
        setProjects([]);
        setInteractionCounts({});
        return;
      }

      const projectsData = projectsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || null,
        updatedAt: doc.data().updatedAt?.toDate?.() || null,
        tags: Array.isArray(doc.data().tags) ? doc.data().tags : []
      }));

      const countsPromises = projectsData.map(async (project) => {
        const counts = { likes: 0, bookmarks: 0, useful: 0 };
        
        try {
          const interactionsRef = collection(db, 'projects', project.id, 'interactions');
          const interactionsSnap = await getDocs(interactionsRef);
          
          interactionsSnap.forEach(interactionDoc => {
            const data = interactionDoc.data();
            if (data.type === 'like') counts.likes++;
            if (data.type === 'bookmark') counts.bookmarks++;
            if (data.type === 'useful') counts.useful++;
          });
        } catch (err) {
          console.error(`Error fetching interactions for project ${project.id}:`, err);
        }
        
        return { projectId: project.id, counts };
      });

      const countsResults = await Promise.all(countsPromises);
      const countsMap = countsResults.reduce((acc, { projectId, counts }) => {
        acc[projectId] = counts;
        return acc;
      }, {});

      setProjects(projectsData);
      setInteractionCounts(countsMap);

    } catch (err) {
      console.error('Error fetching projects:', err);
      setError(err.message || 'Failed to load projects. Please try again.');
      showSnackbar('Failed to load projects', 'error');
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError, setProjects, setInteractionCounts]);

  const fetchUserInteractions = React.useCallback(async () => {
    if (!user) return;

    try {
      const userInteractionsRef = collection(db, 'users', user.uid, 'interactions');
      const userInteractionsSnap = await getDocs(userInteractionsRef);
      
      const userInteractions = {};
      userInteractionsSnap.forEach(doc => {
        userInteractions[doc.id] = doc.data();
      });

      setInteractions(userInteractions);
    } catch (err) {
      console.error('Error fetching user interactions:', err);
      showSnackbar('Failed to load your interactions', 'error');
    }
  }, [user]);

  useEffect(() => {
    fetchProjects();
    fetchUserInteractions();
  }, [fetchProjects, fetchUserInteractions]);

  

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this project?')) return;
    
    try {
      setLoading(true);
      
      const projectDoc = await getDoc(doc(db, 'projects', id));
      const projectData = projectDoc.data();
      
      if (!projectData) throw new Error('Project not found');

      if (projectData.ownerId !== user?.uid && projectData.ownerEmail !== user?.email) {
        const userDoc = await getDoc(doc(db, 'users', user?.uid));
        const userData = userDoc.data();
        const isAdminOrFaculty = userData?.role && ['faculty', 'admin'].includes(userData.role);
        
        if (!isAdminOrFaculty) throw new Error('You do not have permission to delete this project');
      }

      const batch = writeBatch(db);
      const interactionsRef = collection(db, 'projects', id, 'interactions');
      const interactionsSnap = await getDocs(interactionsRef);
      
      interactionsSnap.forEach(doc => batch.delete(doc.ref));
      batch.delete(doc(db, 'projects', id));
      
      await batch.commit();
      
      setProjects(prev => prev.filter(project => project.id !== id));
      
      showSnackbar('Project deleted successfully', 'success');
      
      // Send notification to all users about project deletion
      if (user) {
        const deletedBy = user.displayName || user.email.split('@')[0];
        await notifyAllUsersProjectDeletion(id, projectData.title, deletedBy);
      }
    } catch (err) {
      console.error('Deletion error:', err);
      showSnackbar(`Failed to delete project: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const openEditDialog = (project) => {
    setEditProject(project);
    setEditTitle(project.title);
    setEditDescription(project.description);
    setEditLink(project.githubLink || '');
    setEditTags(Array.isArray(project.tags) ? project.tags : []);
    setEditOpen(true);
  };

  const handleTagChange = (tag) => {
    setEditTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const handleEditSave = async () => {
  if (!editTitle.trim()) {
    showSnackbar('Title is required', 'warning');
    return;
  }

  try {
    await updateDoc(doc(db, 'projects', editProject.id), {
      title: editTitle,
      description: editDescription,
      githubLink: editLink,
      // Ensure tags is always an array
      tags: Array.isArray(editTags) ? editTags : [],
      updatedAt: serverTimestamp()
    });

    setProjects(prev => prev.map(p =>
      p.id === editProject.id
        ? { 
            ...p, 
            title: editTitle, 
            description: editDescription, 
            githubLink: editLink,
            tags: Array.isArray(editTags) ? editTags : [],
            updatedAt: new Date()
          }
        : p
    ));

    setEditOpen(false);
    showSnackbar('Project updated successfully', 'success');
    
    // Send notification about project update
    if (user) {
      const changes = {
        title: editTitle !== editProject.title ? { from: editProject.title, to: editTitle } : null,
        description: editDescription !== editProject.description ? { from: editProject.description, to: editDescription } : null,
        githubLink: editLink !== (editProject.githubLink || '') ? { from: editProject.githubLink || '', to: editLink } : null,
        tags: JSON.stringify(editTags) !== JSON.stringify(editProject.tags || []) ? { from: editProject.tags || [], to: editTags } : null
      };
      
      // Only send notification if there are actual changes
      const hasChanges = Object.values(changes).some(change => change !== null);
      if (hasChanges) {
        await notifyAllUsersProjectUpdate(editProject.id, editTitle, user.email, changes);
      }
    }
  } catch (err) {
    console.error('Error updating project:', err);
    showSnackbar('Failed to update project. Please try again.', 'error');
  }
};


  const handleInterestToggle = (interest) => {
    setSelectedInterests(prev =>
      prev.includes(interest)
        ? prev.filter(i => i !== interest)
        : [...prev, interest]
    );
  };

  const toggleInteraction = async (projectId, type) => {
  if (!user) {
    showSnackbar('Please sign in to interact with projects', 'warning');
    return;
  }

  try {
    const batch = writeBatch(db);
    const userInteractionRef = doc(db, 'users', user.uid, 'interactions', projectId);
    const projectInteractionRef = doc(db, 'projects', projectId, 'interactions', `${user.uid}_${type}`);

    const currentInteraction = interactions[projectId] || {};
    const newValue = !currentInteraction[type];
    const currentCount = interactionCounts[projectId]?.[type] || 0;

    // Update user interaction document
    batch.set(userInteractionRef, {
      ...currentInteraction,
      [type]: newValue,
      lastUpdated: serverTimestamp()
    }, { merge: true });

    // Handle project-level interaction
    if (newValue) {
      // Adding interaction
      batch.set(projectInteractionRef, {
        type,
        userId: user.uid,
        timestamp: serverTimestamp()
      });
    } else {
      // Removing interaction - check if exists first
      const interactionDoc = await getDoc(projectInteractionRef);
      if (interactionDoc.exists()) {
        batch.delete(projectInteractionRef);
      }
    }

    await batch.commit();

    // Update local state
    setInteractions(prev => ({
      ...prev,
      [projectId]: {
        ...prev[projectId],
        [type]: newValue
      }
    }));

    setInteractionCounts(prev => ({
      ...prev,
      [projectId]: {
        ...prev[projectId],
        [type]: newValue ? currentCount + 1 : Math.max(0, currentCount - 1)
      }
    }));

    showSnackbar(
      newValue 
        ? type === 'liked' ? 'Project liked!' 
          : type === 'bookmarked' ? 'Project bookmarked!' 
          : 'Marked as useful!'
        : `Removed ${type}`,
      'success'
    );

          // Notify project owner about the interaction
      if (user && newValue) { // Only notify when adding interaction, not removing
        const projectDoc = await getDoc(doc(db, 'projects', projectId));
        const projectData = projectDoc.data();
        if (projectData && projectData.ownerId && projectData.ownerId !== user.uid) {
          const userName = user.displayName || user.email.split('@')[0];
          await notifyProjectInteractionSimple(projectId, projectData.title, type, user.email, userName);
        }
      }

  } catch (err) {
    console.error('Interaction error:', err);
    
    let errorMessage = 'Failed to update interaction';
    if (err.code === 'permission-denied') {
      errorMessage = 'You do not have permission for this action';
    } else if (err.code === 'unavailable') {
      errorMessage = 'Network error. Please check your connection';
    }
    
    showSnackbar(errorMessage, 'error');
  }
};


  const handleRefresh = () => {
    fetchProjects();
    fetchUserInteractions();
  };

  return (
    <Box sx={{ 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f8faff 0%, #e8ecff 100%)',
      p: { xs: 2, sm: 3 }
    }}>
      <Paper elevation={0} sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
        <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 600 }}>
          All Submitted Projects
        </Typography>
        <Tooltip title="Refresh projects">
          <IconButton onClick={handleRefresh} color="primary" disabled={loading}>
            <Refresh />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Recommendations Section */}
      {user && (
        <Paper elevation={1} sx={{ mb: 4, p: { xs: 2, sm: 3 }, borderRadius: 2 }}>
          <Typography variant="h5" gutterBottom>
            Recommended For You
          </Typography>
          <Recommendations />
        </Paper>
      )}

      {/* Interest Tags Filter */}
      <Paper elevation={1} sx={{ mb: 3, p: { xs: 2, sm: 3 } }}>
        <Typography variant="h6" gutterBottom>
          Filter by Interest Tags
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {interestOptions?.map(interest => (
            <Chip
              key={interest}
              label={interest}
              color={selectedInterests.includes(interest) ? 'primary' : 'default'}
              variant={selectedInterests.includes(interest) ? 'filled' : 'outlined'}
              onClick={() => handleInterestToggle(interest)}
              sx={{ cursor: 'pointer' }}
            />
          ))}
        </Box>
      </Paper>

      {/* Filters and Search */}
      <Paper elevation={1} sx={{ p: { xs: 2, sm: 3 }, mb: 3 }}>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
          <TextField
            label="Search projects"
            variant="outlined"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            sx={{ flexGrow: 1, minWidth: { xs: 'auto', sm: 200 } }}
            placeholder="Search by title or description"
          />

          <FormControl sx={{ minWidth: { xs: 'auto', sm: 150 } }}>
            <InputLabel>Status</InputLabel>
            <Select 
              value={statusFilter} 
              label="Status" 
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              {statuses.map(status => (
                <MenuItem key={status} value={status}>
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl sx={{ minWidth: { xs: 'auto', sm: 200 } }}>
            <InputLabel>Sort By</InputLabel>
            <Select 
              value={sortBy} 
              label="Sort By" 
              onChange={(e) => setSortBy(e.target.value)}
            >
              {sortOptions.map(option => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </Paper>

      {/* Loading and Error States */}
      {loading && (
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center', p: 4 }}>
          {[1,2,3,4].map(i => (
            <Paper key={i} elevation={2} sx={{ width: 320, height: 120, borderRadius: 2, p: 2 }}>
              <Skeleton variant="text" width="60%" height={32} />
              <Skeleton variant="rectangular" width="100%" height={40} sx={{ my: 1 }} />
              <Skeleton variant="rounded" width={80} height={24} />
            </Paper>
          ))}
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Empty State */}
      {filteredProjects.length === 0 && !loading && (
        <Paper elevation={1} sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary">
            No projects match your criteria
          </Typography>
          <Button 
            variant="outlined" 
            onClick={() => {
              setSearchTerm('');
              setStatusFilter('all');
              setSelectedInterests([]);
            }}
            sx={{ mt: 2 }}
          >
            Clear all filters
          </Button>
        </Paper>
      )}

      {/* Projects List */}
      {filteredProjects.map((project, idx) => (
        <Grow in timeout={400 + idx * 80} key={project.id}>
          <Paper elevation={2} sx={{ my: 2, borderRadius: 2, transition: 'box-shadow 0.3s', ':hover': { boxShadow: 8 } }}>
          <Box 
            sx={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              p: 2,
              cursor: 'pointer'
            }}
            onClick={() => toggleProjectExpand(project.id)}
          >
            <Typography variant="h6" component="h2">
              {project.title}
            </Typography>
            <Chip 
              label={project.status || 'pending'} 
              color={
                project.status === 'approved' ? 'success' : 
                project.status === 'rejected' ? 'error' : 'default'
              } 
              size="small"
            />
          </Box>

          <Collapse in={expandedProject === project.id}>
            <Divider />
            <Box sx={{ p: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {project.description}
              </Typography>

              {/* Tags */}
              {project.tags?.length > 0 && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                  {project.tags.map(tag => (
                    <Chip 
                      key={tag} 
                      label={tag} 
                      size="small" 
                      variant="outlined"
                    />
                  ))}
                </Box>
              )}

              {/* Files Preview */}
              {project.uploads && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Project Files:
                  </Typography>
                  <List dense>
                    {project.uploads.projectFile && (
                      <ListItem>
                        <ListItemText
                          primary={project.uploads.projectFile.name}
                          secondary={`${(project.uploads.projectFile.size / 1024 / 1024).toFixed(2)} MB`}
                        />
                        <FileTypeIcon type={project.uploads.projectFile.type} />
                      </ListItem>
                    )}
                    {project.uploads.report && (
                      <ListItem>
                        <ListItemText
                          primary={project.uploads.report.name}
                          secondary={`${(project.uploads.report.size / 1024 / 1024).toFixed(2)} MB`}
                        />
                        <FileTypeIcon type={project.uploads.report.type} />
                      </ListItem>
                    )}
                    {project.uploads.images?.map((image, index) => (
                      <ListItem key={`image-${index}`}>
                        <ListItemText
                          primary={`Image ${index + 1}`}
                          secondary={`${(image.size / 1024 / 1024).toFixed(2)} MB`}
                        />
                        <FileTypeIcon type={image.type} />
                      </ListItem>
                    ))}
                    {project.uploads.videos?.map((video, index) => (
                      <ListItem key={`video-${index}`}>
                        <ListItemText
                          primary={`Video ${index + 1}`}
                          secondary={`${(video.size / 1024 / 1024).toFixed(2)} MB`}
                        />
                        <FileTypeIcon type={video.type} />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}

              {/* Submitted by and date */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Submitted by: {project.ownerEmail || 'Anonymous'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {project.createdAt?.toLocaleDateString() || ''}
                  {project.updatedAt && ` • Updated: ${project.updatedAt.toLocaleDateString()}`}
                </Typography>
              </Box>
            </Box>

            <Divider />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', p: 2 }}>
              {/* View Button */}
              <Button
                size="small"
                startIcon={<Visibility />}
                onClick={() => handleViewProject(project.id)}
                sx={{ mr: 1 }}
              >
                View Details
              </Button>

              {/* Project Link */}
              {project.githubLink && (
                <Button
                  size="small"
                  startIcon={<GitHubIcon />}
                  href={project.githubLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{ ml: 'auto', mr: 2 }}
                >
                  View on GitHub
                </Button>
              )}

              {/* Edit/Delete buttons (only for owner) */}
              {isProjectOwner(project) && (
                <Box>
                  <Tooltip title="Edit project">
                    <IconButton 
                      size="small" 
                      onClick={() => openEditDialog(project)}
                      sx={{ mr: 1 }}
                    >
                      <Edit fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete project">
                    <IconButton 
                      size="small" 
                      color="error"
                      onClick={() => handleDelete(project.id)}
                    >
                      <Delete fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              )}

              {/* Interaction Buttons */}
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                {/* Like Button */}
                <Tooltip title={interactions[project.id]?.liked ? 'Unlike' : 'Like'}>
                  <IconButton 
                    size="small"
                    onClick={() => toggleInteraction(project.id, 'liked')}
                    color={interactions[project.id]?.liked ? 'error' : 'default'}
                  >
                    <Badge 
                      badgeContent={interactionCounts[project.id]?.likes || 0} 
                      color="error"
                      max={999}
                    >
                      {interactions[project.id]?.liked ? <Favorite /> : <FavoriteBorder />}
                    </Badge>
                  </IconButton>
                </Tooltip>

                {/* Bookmark Button */}
                <Tooltip title={interactions[project.id]?.bookmarked ? 'Remove bookmark' : 'Bookmark'}>
                  <IconButton 
                    size="small"
                    onClick={() => toggleInteraction(project.id, 'bookmarked')}
                    color={interactions[project.id]?.bookmarked ? 'primary' : 'default'}
                  >
                    <Badge 
                      badgeContent={interactionCounts[project.id]?.bookmarks || 0} 
                      color="primary"
                      max={999}
                    >
                      {interactions[project.id]?.bookmarked ? <Bookmark /> : <BookmarkBorder />}
                    </Badge>
                  </IconButton>
                </Tooltip>

                {/* Useful Button */}
                <Tooltip title={interactions[project.id]?.useful ? 'Mark as not useful' : 'Mark as useful'}>
                  <IconButton 
                    size="small"
                    onClick={() => toggleInteraction(project.id, 'useful')}
                    color={interactions[project.id]?.useful ? 'success' : 'default'}
                  >
                    <Badge 
                      badgeContent={interactionCounts[project.id]?.useful || 0} 
                      color="success"
                      max={999}
                    >
                      {interactions[project.id]?.useful ? <ThumbUp /> : <ThumbUpOffAlt />}
                    </Badge>
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
          </Collapse>
        </Paper>
        </Grow>
      ))}

      {/* Edit Project Dialog */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Edit Project</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Project Title *"
            fullWidth
            variant="outlined"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            sx={{ mb: 2 }}
            required
          />
          <TextField
            margin="dense"
            label="Description *"
            fullWidth
            variant="outlined"
            multiline
            rows={4}
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            sx={{ mb: 2 }}
            required
          />
          <TextField
            margin="dense"
            label="GitHub Link"
            fullWidth
            variant="outlined"
            value={editLink}
            onChange={(e) => setEditLink(e.target.value)}
            placeholder="https://github.com/username/repo"
            sx={{ mb: 2 }}
          />
          
          <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
            Project Tags
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {interestOptions?.map(interest => (
              <Chip
                key={interest}
                label={interest}
                color={editTags?.includes(interest) ? 'primary' : 'default'}
                variant={editTags?.includes(interest) ? 'filled' : 'outlined'}
                onClick={() => handleTagChange(interest)}
                sx={{ cursor: 'pointer' }}
              />
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleEditSave} 
            variant="contained"
            disabled={!editTitle.trim() || !editDescription.trim()}
          >
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={handleCloseSnackbar} 
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
      </Paper>
    </Box>
  );
};

export default ViewProjects;

