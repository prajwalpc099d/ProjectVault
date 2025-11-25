import React from 'react';
import { Box, Typography, Button, Paper, Container, Grid, Chip, TextField } from '@mui/material';
import { Link, useNavigate } from 'react-router-dom';
import ProjectVaultLogo from '../ProjectVault_Logo.png';
import ProjectVaultLogoDark from '../ProjectVault_Logo_dark.png';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import LoginIcon from '@mui/icons-material/Login';
import SearchIcon from '@mui/icons-material/Search';
import StarIcon from '@mui/icons-material/Star';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../firebase';
import { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy, limit, where, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useTheme } from '@mui/material/styles';

const Home = () => {
  const [user] = useAuthState(auth);
  const navigate = useNavigate();
  const [recentProjects, setRecentProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(true);


  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [featured, setFeatured] = useState(null);
  const [userRole, setUserRole] = useState('');
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  useEffect(() => {
    const fetchRecent = async () => {
      setLoadingProjects(true);
      try {
        const q = query(collection(db, 'projects'), orderBy('createdAt', 'desc'), limit(4));
        const snap = await getDocs(q);
        setRecentProjects(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (e) {
        setRecentProjects([]);
      } finally {
        setLoadingProjects(false);
      }
    };
    fetchRecent();
  }, []);

  // Fetch stats
  useEffect(() => {
    const fetchStats = async () => {
      try {


      } catch {}
    };
    fetchStats();
  }, []);

  // Project search
  const handleSearch = async (e) => {
    e.preventDefault();
    setSearching(true);
    try {
      const q = query(collection(db, 'projects'));
      const snap = await getDocs(q);
      const results = snap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(p => (p.title || '').toLowerCase().includes(search.toLowerCase()));
      setSearchResults(results);
    } finally {
      setSearching(false);
    }
  };

  // Featured project (most recent approved)
  useEffect(() => {
    const fetchFeatured = async () => {
      try {
        const q = query(
          collection(db, 'projects'),
          where('status', '==', 'approved'),
          orderBy('createdAt', 'desc'),
          limit(1)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          setFeatured({ id: snap.docs[0].id, ...snap.docs[0].data() });
        }
      } catch (err) {
        console.error('Error fetching featured project:', err);
      }
    };
    fetchFeatured();
  }, []);

  // Fetch user role from Firestore
  useEffect(() => {
    const fetchUserRole = async () => {
      if (user) {
        try {
          const userRef = doc(db, 'users', user.uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            setUserRole(userSnap.data().role || 'User');
          } else {
            setUserRole('User');
          }
        } catch {
          setUserRole('User');
        }
      }
    };
    fetchUserRole();
  }, [user]);

  return (
    <Container maxWidth="md" sx={{ py: 8 }}>
      <Paper elevation={3} sx={{
        p: { xs: 3, md: 6 },
        borderRadius: 4,
        mb: 6,
        textAlign: 'center',
        background: isDark
          ? 'linear-gradient(135deg, #1a1f2e 0%, #0a0e1a 100%)'
          : 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.9) 100%)',
      }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
          {/* Logo without background */}
          <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src={isDark ? ProjectVaultLogo : ProjectVaultLogoDark} alt="ProjectVault Logo" style={{ height: 56, width: 56 }} />
          </Box>
          <Typography variant="h3" sx={{ fontWeight: 700, mb: 1, letterSpacing: 1, color: isDark ? '#fff' : undefined, textAlign: 'center' }}>
            Welcome to ProjectVault
          </Typography>
          <Typography variant="h6" color={isDark ? 'grey.300' : 'text.secondary'} sx={{ mb: 2, textAlign: 'center' }}>
            The all-in-one platform for project submission, review, and discovery.
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center', mb: 2 }}>
            <Button component={Link} to="/view-projects" variant="contained" size="large" startIcon={<FolderOpenIcon />} color="primary">
              Explore Projects
            </Button>
            {!user && (
              <Button component={Link} to="/register" variant="outlined" size="large" startIcon={<LoginIcon />} color="secondary">
                Get Started
              </Button>
            )}
            {user && (
              <Button onClick={() => navigate('/dashboard')} variant="outlined" size="large" startIcon={<AddCircleIcon />} color="secondary">
                Go to Dashboard
              </Button>
            )}
          </Box>
        </Box>
      </Paper>
      {/* Personalized greeting and quick actions */}
      {user && (
        <Paper elevation={1} sx={{
          p: 3, mb: 4, borderRadius: 3, textAlign: 'center',
          background: isDark
            ? 'linear-gradient(90deg, #1a1f2e 0%, #0a0e1a 100%)'
            : 'linear-gradient(90deg, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.9) 100%)',
        }}>
          <Typography variant="h5" sx={{ fontWeight: 600, mb: 1, color: isDark ? '#fff' : undefined }}>
            Welcome back, {user.displayName || user.email}!
          </Typography>
          <Typography variant="body2" color={isDark ? 'grey.300' : 'text.secondary'} sx={{ mb: 2 }}>
            Role: <b>{userRole ? userRole.charAt(0).toUpperCase() + userRole.slice(1) : 'User'}</b>
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button onClick={() => navigate('/dashboard')} variant="contained" color="primary">Go to Dashboard</Button>
            <Button onClick={() => navigate('/submit')} variant="outlined" color="secondary">Submit Project</Button>
            <Button onClick={() => navigate('/profile/edit')} variant="outlined">Edit Profile</Button>
          </Box>
        </Paper>
      )}
      {/* Project search bar */}
      <Paper elevation={0} sx={{
        p: 2, mb: 4, borderRadius: 3,
        background: isDark
          ? 'linear-gradient(90deg, #1a1f2e 0%, #0a0e1a 100%)'
          : 'linear-gradient(90deg, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.9) 100%)',
      }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
          <TextField size="small" placeholder="Search projects by title..." value={search} onChange={e => setSearch(e.target.value)} sx={{ minWidth: 220 }} />
          <Button type="submit" variant="contained" color="primary" startIcon={<SearchIcon />} disabled={searching}>Search</Button>
        </form>
        {searchResults.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Search Results:</Typography>
            <Grid container spacing={2}>
              {searchResults.map(project => (
                <Grid item xs={12} sm={6} key={project.id}>
                  <Paper elevation={2} sx={{ p: 2, borderRadius: 2 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{project.title || 'Untitled Project'}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{project.description?.slice(0, 60) || 'No description.'}</Typography>
                    <Button component={Link} to={`/projects/${project.id}`} size="small" variant="outlined">View Details</Button>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </Box>
        )}
      </Paper>
      {/* Featured project */}
      {featured && (
        <Paper elevation={2} sx={{
          p: 4, borderRadius: 3, mb: 6,
          background: isDark
            ? 'linear-gradient(135deg, #1a1f2e 0%, #0a0e1a 100%)'
            : 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.9) 100%)',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <StarIcon color="warning" sx={{ mr: 1 }} />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>Featured Project</Typography>
          </Box>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>{featured.title || 'Untitled Project'}</Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>{featured.description?.slice(0, 120) || 'No description.'}</Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
            {featured.tags?.slice(0, 4).map(tag => (
              <Chip key={tag} label={tag} size="small" color="primary" />
            ))}
          </Box>
          <Button component={Link} to={`/projects/${featured.id}`} variant="contained" color="primary" sx={{ mt: 2 }}>View Project</Button>
        </Paper>
      )}
      {/* Recent Projects Section */}
      <Paper elevation={1} sx={{
        p: 4, borderRadius: 3, mb: 6,
        background: isDark
          ? 'linear-gradient(135deg, #23272f 0%, #181c24 100%)'
          : undefined,
      }}>
        <Typography variant="h5" sx={{ fontWeight: 600, mb: 3 }}>
          Recent Projects
        </Typography>
        {loadingProjects ? (
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center', p: 2 }}>
            {[1,2,3,4].map(i => (
              <Paper key={i} elevation={2} sx={{ width: 220, height: 100, borderRadius: 2, p: 2 }}>
                <Box sx={{ width: '100%', height: 24, bgcolor: '#e3e3e3', borderRadius: 1, mb: 1 }} />
                <Box sx={{ width: '80%', height: 16, bgcolor: '#e3e3e3', borderRadius: 1 }} />
              </Paper>
            ))}
          </Box>
        ) : recentProjects.length === 0 ? (
          <Typography color="text.secondary">No projects found.</Typography>
        ) : (
          <Grid container spacing={2}>
            {recentProjects.map(project => (
              <Grid item xs={12} sm={6} key={project.id}>
                <Paper elevation={2} sx={{ p: 2, borderRadius: 2, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                    {project.title || 'Untitled Project'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1, minHeight: 32 }}>
                    {project.description?.slice(0, 60) || 'No description.'}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
                    {project.tags?.slice(0, 3).map(tag => (
                      <Chip key={tag} label={tag} size="small" color="primary" />
                    ))}
                  </Box>
                  <Button component={Link} to={`/projects/${project.id}`} size="small" variant="outlined" sx={{ mt: 1 }}>
                    View Details
                  </Button>
                </Paper>
              </Grid>
            ))}
          </Grid>
        )}
      </Paper>
      {/* About/Contact Section */}
      <Paper elevation={0} sx={{
        p: 3, borderRadius: 3, textAlign: 'center',
        background: isDark
          ? 'linear-gradient(90deg, #23272f 0%, #181c24 100%)'
          : 'linear-gradient(90deg, #f4f6fa 0%, #e3f2fd 100%)',
      }}>
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>About ProjectVault</Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
          ProjectVault is a platform for students, faculty, and administrators to manage, review, and discover academic projects. Built with modern web technologies and a focus on usability and security.
        </Typography>
        <Typography variant="body2" color="text.secondary">
          For support or feedback, contact <a href="mailto:support@projectvault.com">support@projectvault.com</a>
        </Typography>
      </Paper>
      <Box sx={{ textAlign: 'center', color: isDark ? 'grey.400' : 'text.secondary', mt: 6 }}>
        <Typography variant="body2">
          &copy; {new Date().getFullYear()} ProjectVault. All rights reserved.
        </Typography>
      </Box>
    </Container>
  );
};

export default Home; 