import React, { useEffect, useState, useCallback } from 'react';
import { 
  Box, Typography, Button, 
  CircularProgress, Alert, Chip, Divider,
  IconButton, Tooltip, TextField, Dialog,
  DialogTitle, DialogContent, DialogActions,
  Paper, List, ListItem, ListItemText,
  Badge, LinearProgress, Collapse, CardContent
} from '@mui/material';
import GitHubIcon from '@mui/icons-material/GitHub';
import ArrowBack from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import LikeIcon from '@mui/icons-material/ThumbUp';
import LikeOutlineIcon from '@mui/icons-material/ThumbUpOffAlt';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import BookmarkOutlineIcon from '@mui/icons-material/BookmarkBorder';
import FeedbackIcon from '@mui/icons-material/Comment';
import ReportIcon from '@mui/icons-material/Description';
import ZipIcon from '@mui/icons-material/FolderZip';
import ImageIcon from '@mui/icons-material/Image';
import VideoIcon from '@mui/icons-material/Videocam';

import ExpandMore from '@mui/icons-material/ExpandMore';
import ExpandLess from '@mui/icons-material/ExpandLess';
import { 
  doc, getDoc, updateDoc, deleteDoc, setDoc,
  collection, addDoc, serverTimestamp,
  arrayUnion, arrayRemove, getDocs
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuthState } from 'react-firebase-hooks/auth';
import { notifyFeedbackSubmittedSimple, notifyAllUsersProjectUpdate, notifyProjectInteractionSimple } from '../utils/notifications';

const FileTypeIcon = ({ type }) => {
  if (type?.includes('zip') || type?.includes('rar')) return <ZipIcon color="primary" />;
  if (type?.includes('pdf')) return <ReportIcon color="error" />;
  if (type?.includes('image')) return <ImageIcon color="success" />;
  if (type?.includes('video')) return <VideoIcon color="warning" />;
  return null;
};

const ProjectDetails = () => {
  const { projectId } = useParams();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [user] = useAuthState(auth);
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);

  // Edit state
  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editGithubLink, setEditGithubLink] = useState('');
  const [editTags, setEditTags] = useState([]);

  // Interaction state
  const [liked, setLiked] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);
  const [feedbackList, setFeedbackList] = useState([]);
  const [loadingFeedback, setLoadingFeedback] = useState(false);

  const tagOptions = [
    'Web Development',
    'Mobile App',
    'Data Science',
    'Machine Learning',
    'AI',
    'IoT',
    'Blockchain',
    'Cybersecurity'
  ];

  const fetchFeedback = useCallback(async () => {
    try {
      setLoadingFeedback(true);
      const feedbackCol = collection(db, 'projects', projectId, 'feedback');
      const feedbackSnap = await getDocs(feedbackCol);
      const feedbackData = feedbackSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || null
      }));
      setFeedbackList(feedbackData);
    } catch (err) {
      console.error('Error fetching feedback:', err);
    } finally {
      setLoadingFeedback(false);
    }
  }, [projectId]);

  useEffect(() => {
    const fetchProject = async () => {
      try {
        setLoading(true);
        const projectRef = doc(db, 'projects', projectId);
        const projectSnap = await getDoc(projectRef);
        
        if (projectSnap.exists()) {
          const projectData = projectSnap.data();
          setProject({
            id: projectSnap.id,
            ...projectData,
            createdAt: projectData.createdAt?.toDate?.() || null,
            updatedAt: projectData.updatedAt?.toDate?.() || null,
            tags: Array.isArray(projectData.tags) ? projectData.tags : [],
            likes: Array.isArray(projectData.likes) ? projectData.likes : [],
            bookmarks: Array.isArray(projectData.bookmarks) ? projectData.bookmarks : []
          });
          
          // Set edit form values
          setEditTitle(projectData.title);
          setEditDescription(projectData.description);
          setEditGithubLink(projectData.githubLink || '');
          setEditTags(Array.isArray(projectData.tags) ? projectData.tags : []);
          
          // Check user interactions
          if (user) {
            const interactionsRef = doc(db, 'users', user.uid, 'interactions', projectId);
            const interactionsSnap = await getDoc(interactionsRef);
            if (interactionsSnap.exists()) {
              setLiked(interactionsSnap.data().liked || false);
              setBookmarked(interactionsSnap.data().bookmarked || false);
            }
          }
          
          // Fetch feedback for this project
          await fetchFeedback();
        } else {
          setError('Project not found');
        }
      } catch (err) {
        console.error('Error fetching project:', err);
        setError('Failed to load project details');
      } finally {
        setLoading(false);
      }
    };

    fetchProject();
  }, [projectId, user, fetchFeedback]);

  const handleEditProject = () => {
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    try {
      await updateDoc(doc(db, 'projects', projectId), {
        title: editTitle,
        description: editDescription,
        githubLink: editGithubLink,
        tags: editTags,
        updatedAt: serverTimestamp()
      });
      
      setProject(prev => ({
        ...prev,
        title: editTitle,
        description: editDescription,
        githubLink: editGithubLink,
        tags: editTags
      }));
      
      setEditOpen(false);
      
      // Send notification to project owner about updated project
      if (user && project) {
        const changes = {
          title: editTitle !== project.title ? { from: project.title, to: editTitle } : null,
          description: editDescription !== project.description ? { from: project.description, to: editDescription } : null,
          githubLink: editGithubLink !== (project.githubLink || '') ? { from: project.githubLink || '', to: editGithubLink } : null,
          tags: JSON.stringify(editTags) !== JSON.stringify(project.tags || []) ? { from: project.tags || [], to: editTags } : null
        };
        
        // Only send notification if there are actual changes
        const hasChanges = Object.values(changes).some(change => change !== null);
        if (hasChanges) {
          await notifyAllUsersProjectUpdate(projectId, editTitle, user.email, changes);
        }
      }
    } catch (err) {
      console.error('Error updating project:', err);
      setError('Failed to update project');
    }
  };

  const handleDeleteProject = async () => {
    if (window.confirm('Are you sure you want to delete this project?')) {
      try {
        await deleteDoc(doc(db, 'projects', projectId));
        navigate('/projects');
      } catch (err) {
        console.error('Error deleting project:', err);
        setError('Failed to delete project');
      }
    }
  };

  const handleTagChange = (tag) => {
    setEditTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const handleInteraction = async (type) => {
    if (!user) {
      setError('Please sign in to interact with projects');
      return;
    }
    
    try {
      const interactionRef = doc(db, 'users', user.uid, 'interactions', projectId);
      const newValue = type === 'liked' ? !liked : !bookmarked;
      
      await setDoc(interactionRef, {
        [type]: newValue
      }, { merge: true });

      if (type === 'liked') {
        setLiked(newValue);
        // Update like count using array operations
        await updateDoc(doc(db, 'projects', projectId), {
          likes: newValue ? arrayUnion(user.uid) : arrayRemove(user.uid)
        });
        // Update local project state
        setProject(prev => ({
          ...prev,
          likes: newValue 
            ? [...(prev.likes || []), user.uid]
            : (prev.likes || []).filter(uid => uid !== user.uid)
        }));
      } else {
        setBookmarked(newValue);
        // Update bookmark count using array operations
        await updateDoc(doc(db, 'projects', projectId), {
          bookmarks: newValue ? arrayUnion(user.uid) : arrayRemove(user.uid)
        });
        // Update local project state
        setProject(prev => ({
          ...prev,
          bookmarks: newValue 
            ? [...(prev.bookmarks || []), user.uid]
            : (prev.bookmarks || []).filter(uid => uid !== user.uid)
        }));
      }

      // Notify project owner about interaction
      if (project && newValue && project.ownerId !== user.uid) {
        const userName = user.displayName || user.email.split('@')[0];
        await notifyProjectInteractionSimple(projectId, project.title, type, user.email, userName);
      }
    } catch (err) {
      console.error('Error updating interaction:', err);
      setError('Failed to update interaction');
    }
  };

  const submitFeedback = async () => {
    if (!feedback.trim()) return;
    
    try {
      // Store feedback in a subcollection
      await addDoc(collection(db, 'projects', projectId, 'feedback'), {
        text: feedback,
        author: user.email,
        createdAt: serverTimestamp()
      });
      
      setFeedback('');
      setShowFeedbackDialog(false);
      
      // Refresh feedback list
      await fetchFeedback();
      
      // Send notification to project owner about new feedback
      await notifyFeedbackSubmittedSimple(projectId, user.email, feedback);
    } catch (err) {
      console.error('Error submitting feedback:', err);
      setError('Failed to submit feedback');
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {error}
      </Alert>
    );
  }

  if (!project) {
    return (
      <Box sx={{ p: 4 }}>
        <Typography variant="h6">Project not found</Typography>
      </Box>
    );
  }

  const isOwner = user && user.email === project.ownerEmail;

  return (
    <Box sx={{ 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f8faff 0%, #e8ecff 100%)',
      p: { xs: 2, sm: 3 }
    }}>
      <Paper elevation={0} sx={{ p: 3, maxWidth: 800, mx: 'auto', borderRadius: 3 }}>
      <Button 
        startIcon={<ArrowBack />}
        onClick={() => navigate(-1)}
        sx={{ mb: 2 }}
      >
        Back to Projects
      </Button>

      <Paper elevation={2} sx={{ borderRadius: 2, mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 600 }}>
              {project.title}
            </Typography>
            
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Chip 
                label={project.status || 'pending'} 
                color={
                  project.status === 'approved' ? 'success' : 
                  project.status === 'rejected' ? 'error' : 'default'
                } 
              />
              
              {isOwner && (
                <>
                  <Tooltip title="Edit Project">
                    <IconButton onClick={handleEditProject}>
                      <EditIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete Project">
                    <IconButton onClick={handleDeleteProject} color="error">
                      <DeleteIcon />
                    </IconButton>
                  </Tooltip>
                </>
              )}
            </Box>
          </Box>

          <Divider sx={{ my: 2 }} />

          <Typography variant="body1" sx={{ mb: 3, whiteSpace: 'pre-line' }}>
            {project.description}
          </Typography>

          {/* Tags */}
          {project.tags?.length > 0 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }}>
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
              <Box 
                sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  cursor: 'pointer',
                  mb: 1
                }}
                onClick={() => setExpanded(!expanded)}
              >
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  Project Files
                </Typography>
                {expanded ? <ExpandLess /> : <ExpandMore />}
              </Box>
              
              <Collapse in={expanded}>
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
              </Collapse>
            </Box>
          )}

          {/* After the main project description and tags, add feedback section */}
          <Divider sx={{ my: 2 }} />
          <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>Feedback</Typography>
          {loadingFeedback ? (
            <LinearProgress />
          ) : feedbackList.length === 0 ? (
            <Typography color="text.secondary">No feedback yet.</Typography>
          ) : (
            <List dense>
              {feedbackList.map(item => (
                <Paper key={item.id} variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
                    {item.text}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {item.author} • {item.createdAt?.toLocaleDateString() || ''}
                  </Typography>
                </Paper>
              ))}
            </List>
          )}

          <Box sx={{ display: 'flex', gap: 2, mt: 3, flexWrap: 'wrap' }}>
            {project.githubLink && (
              <Button
                variant="contained"
                startIcon={<GitHubIcon />}
                href={project.githubLink}
                target="_blank"
                rel="noopener noreferrer"
                sx={{ minWidth: 200 }}
              >
                View on GitHub
              </Button>
            )}
            
            <Tooltip title={liked ? 'Unlike' : 'Like'}>
              <Button
                variant={liked ? 'contained' : 'outlined'}
                startIcon={liked ? <LikeIcon /> : <LikeOutlineIcon />}
                onClick={() => handleInteraction('liked')}
                color={liked ? 'primary' : 'default'}
                sx={{ minWidth: 120 }}
              >
                <Badge 
                  badgeContent={project.likes?.length || 0} 
                  color="primary"
                  max={999}
                  sx={{ mr: 1 }}
                >
                  Like
                </Badge>
              </Button>
            </Tooltip>
            
            <Tooltip title={bookmarked ? 'Remove Bookmark' : 'Bookmark'}>
              <Button
                variant={bookmarked ? 'contained' : 'outlined'}
                startIcon={bookmarked ? <BookmarkIcon /> : <BookmarkOutlineIcon />}
                onClick={() => handleInteraction('bookmarked')}
                color={bookmarked ? 'secondary' : 'default'}
                sx={{ minWidth: 120 }}
              >
                <Badge 
                  badgeContent={project.bookmarks?.length || 0} 
                  color="secondary"
                  max={999}
                  sx={{ mr: 1 }}
              >
                {bookmarked ? 'Saved' : 'Save'}
                </Badge>
              </Button>
            </Tooltip>
            
            <Tooltip title="Provide Feedback">
              <Button
                variant="outlined"
                startIcon={<FeedbackIcon />}
                onClick={() => {
                  setShowFeedbackDialog(true);
                  fetchFeedback();
                }}
                sx={{ minWidth: 150 }}
              >
                Feedback
              </Button>
            </Tooltip>
          </Box>

          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="caption" color="text.secondary">
              Submitted by: {project.ownerEmail || 'Anonymous'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Created: {project.createdAt?.toLocaleDateString() || 'N/A'}
              {project.updatedAt && ` • Updated: ${project.updatedAt.toLocaleDateString()}`}
            </Typography>
          </Box>
        </CardContent>
      </Paper>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Edit Project</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            margin="normal"
            label="Title"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
          />
          <TextField
            fullWidth
            margin="normal"
            label="Description"
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            multiline
            rows={6}
          />
          <TextField
            fullWidth
            margin="normal"
            label="GitHub Link"
            value={editGithubLink}
            onChange={(e) => setEditGithubLink(e.target.value)}
          />
          
          <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
            Project Tags
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {tagOptions?.map(tag => (
              <Chip
                key={tag}
                label={tag}
                color={editTags?.includes(tag) ? 'primary' : 'default'}
                variant={editTags?.includes(tag) ? 'filled' : 'outlined'}
                onClick={() => handleTagChange(tag)}
                sx={{ cursor: 'pointer' }}
              />
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveEdit} variant="contained">Save Changes</Button>
        </DialogActions>
      </Dialog>

      {/* Feedback Dialog */}
      <Dialog open={showFeedbackDialog} onClose={() => setShowFeedbackDialog(false)} fullWidth maxWidth="sm">
        <DialogTitle>Project Feedback</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            rows={4}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Share your thoughts about this project..."
            sx={{ mb: 2 }}
          />
          
          {loadingFeedback ? (
            <LinearProgress />
          ) : (
            <List dense>
              {feedbackList.length > 0 ? (
                feedbackList.map((item) => (
                  <Paper key={item.id} variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
                      {item.text}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {item.author} • {item.createdAt?.toLocaleDateString() || ''}
                    </Typography>
                  </Paper>
                ))
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                  No feedback yet
                </Typography>
              )}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowFeedbackDialog(false)}>Close</Button>
          <Button 
            onClick={submitFeedback} 
            variant="contained"
            disabled={!feedback.trim()}
          >
            Submit Feedback
          </Button>
        </DialogActions>
      </Dialog>
      </Paper>
    </Box>
  );
};

export default ProjectDetails;