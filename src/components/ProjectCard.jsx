import React, { useState, useEffect } from 'react';
import { 
  Card, 
  CardContent, 
  Typography, 
  Button, 
  Box, 
  Chip,
  IconButton,
  Tooltip,
  Divider
} from '@mui/material';
import {
  ThumbUp as LikeIcon,
  Bookmark as BookmarkIcon,
  Star as UsefulIcon,
  GitHub as GitHubIcon,
  Edit as EditIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { db } from '../firebase';
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../firebase';

const ProjectCard = ({ project, onEdit, onDelete }) => {
  const [user] = useAuthState(auth);
  const [interactions, setInteractions] = useState({
    likes: [],
    bookmarks: [],
    useful: []
  });
  const [loading, setLoading] = useState({
    like: false,
    bookmark: false,
    useful: false
  });

  // Fetch interactions when component mounts or project changes
  useEffect(() => {
    const fetchInteractions = async () => {
      const projectRef = doc(db, 'projects', project.id);
      const projectSnap = await getDoc(projectRef);
      if (projectSnap.exists()) {
        const data = projectSnap.data();
        setInteractions({
          likes: data.likes || [],
          bookmarks: data.bookmarks || [],
          useful: data.useful || []
        });
      }
    };

    fetchInteractions();
  }, [project.id]);

  const handleInteraction = async (type) => {
    if (!user) return;
    setLoading(prev => ({ ...prev, [type]: true }));

    try {
      const projectRef = doc(db, 'projects', project.id);
      const userId = user.uid;

      // Check if user already interacted
      const hasInteracted = interactions[type].includes(userId);

      await updateDoc(projectRef, {
        [type]: hasInteracted ? arrayRemove(userId) : arrayUnion(userId)
      });

      // Update local state
      setInteractions(prev => ({
        ...prev,
        [type]: hasInteracted
          ? prev[type].filter(id => id !== userId)
          : [...prev[type], userId]
      }));
    } catch (error) {
      console.error(`Error updating ${type}:`, error);
    } finally {
      setLoading(prev => ({ ...prev, [type]: false }));
    }
  };

  return (
    <Card variant="outlined" sx={{ mb: 3, borderRadius: 2 }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Typography variant="h6" gutterBottom>{project.title}</Typography>
          {onEdit && onDelete && (
            <Box>
              <Tooltip title="Edit">
                <IconButton onClick={() => onEdit(project)} size="small">
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Delete">
                <IconButton onClick={() => onDelete(project.id)} size="small" color="error">
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          )}
        </Box>

        <Typography variant="body2" sx={{ mb: 2 }}>
          {project.description}
        </Typography>

        {/* Display tags if present */}
        {project.tags && Array.isArray(project.tags) && (
          <Box sx={{ mb: 2 }}>
            {project.tags.map(tag => (
              <Chip 
                key={tag} 
                label={tag} 
                size="small" 
                sx={{ mr: 1, mb: 1 }} 
                variant="outlined"
              />
            ))}
          </Box>
        )}

        <Divider sx={{ my: 1 }} />

        {/* Interaction buttons */}
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <Tooltip title="Like">
            <Button
              startIcon={<LikeIcon />}
              size="small"
              onClick={() => handleInteraction('likes')}
              disabled={loading.like}
              color={interactions.likes.includes(user?.uid) ? 'primary' : 'default'}
            >
              {interactions.likes.length}
            </Button>
          </Tooltip>

          <Tooltip title="Bookmark">
            <Button
              startIcon={<BookmarkIcon />}
              size="small"
              onClick={() => handleInteraction('bookmarks')}
              disabled={loading.bookmark}
              color={interactions.bookmarks.includes(user?.uid) ? 'primary' : 'default'}
            >
              {interactions.bookmarks.length}
            </Button>
          </Tooltip>

          <Tooltip title="Useful">
            <Button
              startIcon={<UsefulIcon />}
              size="small"
              onClick={() => handleInteraction('useful')}
              disabled={loading.useful}
              color={interactions.useful.includes(user?.uid) ? 'primary' : 'default'}
            >
              {interactions.useful.length}
            </Button>
          </Tooltip>
        </Box>

        {/* Show GitHub link button only if link exists */}
        {project.githubLink && (
          <Button
            variant="contained"
            startIcon={<GitHubIcon />}
            href={project.githubLink}
            target="_blank"
            rel="noopener noreferrer"
            sx={{ mr: 1 }}
          >
            View on GitHub
          </Button>
        )}

        <Box sx={{ mt: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Submitted by: {project.submittedBy || 'Anonymous'}
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block">
            Status: {project.status || 'Pending'}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};

export default ProjectCard;