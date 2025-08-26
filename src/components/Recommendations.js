import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Box, Typography, Card, CardContent, CardActions, Button,
  CircularProgress, Alert, IconButton, Tooltip, Chip, Skeleton
} from '@mui/material';
import Favorite from '@mui/icons-material/Favorite';
import FavoriteBorder from '@mui/icons-material/FavoriteBorder';
import Bookmark from '@mui/icons-material/Bookmark';
import BookmarkBorder from '@mui/icons-material/BookmarkBorder';
import ThumbUp from '@mui/icons-material/ThumbUp';
import ThumbUpOffAlt from '@mui/icons-material/ThumbUpOffAlt';
import Refresh from '@mui/icons-material/Refresh';
import GitHubIcon from '@mui/icons-material/GitHub';
import Visibility from '@mui/icons-material/Visibility';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useNavigate } from 'react-router-dom';
import { getFunctions, httpsCallable } from 'firebase/functions';

const Recommendations = () => {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, loadingAuth] = useAuthState(auth);
  const navigate = useNavigate();
  const recommendationsRef = useRef([]);

  const fetchRecommendations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (!user) {
        setRecommendations([]);
        return;
      }

      // Try cloud function first
      try {
        const functions = getFunctions();
        const getRecs = httpsCallable(functions, 'getRecommendations');
        const response = await getRecs({ userId: user.uid });
        
        if (response.data?.recommendations) {
          const recs = response.data.recommendations;
          recommendationsRef.current = recs;
          setRecommendations(recs);
          return;
        }
      } catch (cloudError) {
        console.log("Cloud function failed, falling back to local logic", cloudError);
      }

      // Fallback to local logic
      const userInteractionsRef = collection(db, 'users', user.uid, 'interactions');
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

      // Get liked projects data
      const likedProjectsData = await Promise.all(
        likedProjects.map(projectId => getDoc(doc(db, 'projects', projectId)))
      );

      const likedTags = new Set();
      likedProjectsData.forEach(project => {
        if (project.exists()) {
          const tags = Array.isArray(project.data().tags) ? project.data().tags : [];
          tags.forEach(tag => likedTags.add(tag));
        }
      });

      if (likedTags.size === 0) {
        setRecommendations([]);
        return;
      }

      // Get similar projects
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
          matchScore: 3
        }))
        .slice(0, 3);

      recommendationsRef.current = recommended;
      setRecommendations(recommended);
    } catch (err) {
      console.error("Recommendation error:", err);
      setError(err.message || 'Failed to load recommendations');
      if (recommendationsRef.current.length > 0) {
        setRecommendations(recommendationsRef.current);
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!loadingAuth) {
      fetchRecommendations();
    }
  }, [fetchRecommendations, loadingAuth]);

  // Refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      if (user) {
        fetchRecommendations();
      }
    }, 300000); // 5 minutes
    
    return () => clearInterval(interval);
  }, [user, fetchRecommendations]);

  if (loadingAuth || !user) return null;

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

export default Recommendations;