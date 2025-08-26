import React, { useEffect, useState, createContext, useContext } from 'react';
import { Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom';
import { 
  AppBar, Toolbar, Typography, Button, Container, Box, 
  CircularProgress, Avatar, Menu, MenuItem, IconButton,
  ThemeProvider, createTheme, CssBaseline, Snackbar, Alert,
  Drawer, List, ListItem, ListItemButton, ListItemText, ListItemIcon, Badge
} from '@mui/material';
import { auth, db } from './firebase';
import { signOut } from 'firebase/auth';
import { useAuthState } from 'react-firebase-hooks/auth';
import { collection, getDocs, updateDoc, doc, query, orderBy, getDoc, setDoc, where } from 'firebase/firestore';

import MenuIcon from '@mui/icons-material/Menu';
import NotificationsIcon from '@mui/icons-material/Notifications';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import HomeIcon from '@mui/icons-material/Home';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import DashboardIcon from '@mui/icons-material/Dashboard';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import LoginIcon from '@mui/icons-material/Login';

// Page Components
import SubmitProject from './pages/SubmitProject';
import ViewProjects from './pages/ViewProjects';
import ProjectDetails from './pages/ProjectDetails';
import Login from './pages/Login';
import Register from './pages/Register';
import AdminDashboard from './pages/AdminDashboard';
import FacultyDashboard from './pages/FacultyDashboard';
import StudentDashboard from './pages/StudentDashboard';
import UserProfile from './pages/UserProfile';
import EditProfile from './pages/EditProfile';
import Home from './pages/Home';
import NotificationSettings from './components/NotificationSettings';

// Custom Components
import RoleBasedRoute from './components/RoleBasedRoute';

const SnackbarContext = createContext();

function SnackbarProvider({ children }) {
  const [snackbar, setSnackbar] = React.useState({ open: false, message: '', severity: 'info' });
  const showSnackbar = (message, severity = 'info') => {
    setSnackbar({ open: true, message, severity });
  };
  const closeSnackbar = () => {
    setSnackbar(prev => ({ ...prev, open: false }));
  };
  return (
    <SnackbarContext.Provider value={{ showSnackbar }}>
      {children}
      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={closeSnackbar} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={closeSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </SnackbarContext.Provider>
  );
}

export function useSnackbar() {
  return useContext(SnackbarContext);
}

function App() {
  const [user] = useAuthState(auth);
  const [role, setRole] = useState(null);
  const [loadingRole, setLoadingRole] = useState(true);
  const [anchorEl, setAnchorEl] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const navigate = useNavigate();
  const [mode, setMode] = useState('light');
  const [notifAnchor, setNotifAnchor] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const fetchUserRole = async () => {
      if (user) {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          setRole(userSnap.data().role);
        }
      }
      setLoadingRole(false);
    };

    fetchUserRole();
  }, [user]);

  // Function to ensure user document exists
  const ensureUserDocument = async (user) => {
    try {
      const userDocRef = doc(db, 'users', user.uid);
      const userDocSnap = await getDoc(userDocRef);
      
      if (!userDocSnap.exists()) {
        console.log('User document does not exist, creating it...');
        await setDoc(userDocRef, {
          email: user.email,
          role: 'user', // Default role
          firstName: user.displayName?.split(' ')[0] || '',
          lastName: user.displayName?.split(' ').slice(1).join(' ') || '',
          emailVerified: user.emailVerified,
          createdAt: new Date(),
          lastLogin: new Date(),
          status: 'active'
        });
        console.log('User document created successfully');
        return true;
      } else {
        console.log('User document already exists');
        return false;
      }
    } catch (error) {
      console.error('Error ensuring user document exists:', error);
      return false;
    }
  };





  // Fetch notifications for the logged-in user
  useEffect(() => {
    const fetchNotifications = async () => {
      if (user) {
        try {
          console.log(`Fetching notifications for user: ${user.uid}`);
          
          // First, ensure user document exists
          await ensureUserDocument(user);
          
          // Use root-level notifications collection and filter by recipientId
          const notifRef = collection(db, 'notifications');
          const notifQuery = query(
            notifRef, 
            where('recipientId', '==', user.uid),
            orderBy('createdAt', 'desc')
          );
          const notifSnap = await getDocs(notifQuery);
          const notifs = notifSnap.docs.map(doc => ({ 
            id: doc.id, 
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate?.() || new Date()
          }));
          console.log(`Found ${notifs.length} notifications for user ${user.uid}:`, notifs);
          setNotifications(notifs);
          setUnreadCount(notifs.filter(n => !n.read).length);
          console.log(`Unread count: ${notifs.filter(n => !n.read).length}`);
        } catch (e) {
          console.error('Error fetching notifications:', e);
          console.error('Error code:', e.code);
          console.error('Error message:', e.message);
          
          if (e.code === 'permission-denied') {
            console.error('Permission denied when fetching notifications. This might indicate:');
            console.error('1. User document does not exist in Firestore');
            console.error('2. Firestore rules are blocking access');
            console.error('3. Authentication issues');
          }
          
          setNotifications([]);
          setUnreadCount(0);
        }
      } else {
        setNotifications([]);
        setUnreadCount(0);
      }
    };
    
    fetchNotifications();
    
    // Set up real-time updates for notifications
    if (user) {
      const interval = setInterval(fetchNotifications, 30000); // Check every 30 seconds
      return () => clearInterval(interval);
    }
  }, [user]);

  // Mark notifications as read when menu is opened
  const handleNotifOpen = async (e) => {
    setNotifAnchor(e.currentTarget);
    if (user && notifications.some(n => !n.read)) {
      try {
        // Mark all as read in root-level notifications collection
        const updatePromises = notifications
          .filter(notif => !notif.read)
          .map(async (notif) => {
            const notifDoc = doc(db, 'notifications', notif.id);
            await updateDoc(notifDoc, { read: true });
          });
        
        await Promise.all(updatePromises);
        
        // Update local state
        setNotifications(prev => prev.map(notif => ({ ...notif, read: true })));
        setUnreadCount(0);
      } catch (error) {
        console.error('Error marking notifications as read:', error);
      }
    }
  };













  const handleLogout = () => {
    signOut(auth).then(() => {
      setRole(null);
      navigate('/login');
    }).catch(console.error);
  };



  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleProfileClick = () => {
    handleMenuClose();
    navigate('/profile');
  };

  const handleDrawerToggle = () => setDrawerOpen((open) => !open);

  if (loadingRole) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  const theme = createTheme({
    palette: {
      mode,
      primary: { main: '#667eea' },
      secondary: { main: '#764ba2' },
      background: { 
        default: mode === 'light' ? '#f8faff' : '#0a0e1a', 
        paper: mode === 'light' ? '#ffffff' : '#1a1f2e' 
      },
    },
    typography: {
      fontFamily: 'Roboto, Arial, sans-serif',
      h4: { fontWeight: 700 }, h5: { fontWeight: 600 }, h6: { fontWeight: 600 },
    },
    shape: { borderRadius: 12 },
    components: {
      MuiButton: { 
        styleOverrides: { 
          root: { 
            textTransform: 'none', 
            borderRadius: 8, 
            transition: 'all 0.2s',
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: '0 8px 25px rgba(102, 126, 234, 0.3)'
            }
          } 
        } 
      },
      MuiPaper: { 
        styleOverrides: { 
          root: { 
            borderRadius: 12,
            boxShadow: '0 8px 32px rgba(102, 126, 234, 0.1)'
          } 
        } 
      },
      MuiAppBar: { 
        styleOverrides: { 
          root: { 
            backdropFilter: 'blur(12px)', 
            background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.95) 0%, rgba(118, 75, 162, 0.95) 100%)', 
            boxShadow: '0 8px 32px rgba(102, 126, 234, 0.3)' 
          } 
        } 
      },
    },
  });

  const navLinks = [
    { label: 'Home', to: '/', icon: <HomeIcon /> },
    { label: 'Projects', to: '/view-projects', icon: <FolderOpenIcon /> },
    { label: 'Dashboard', to: '/dashboard', icon: <DashboardIcon />, auth: true },
    { label: 'Submit', to: '/submit', icon: <AddCircleIcon />, auth: true },
  ];

  const isActive = (to) => window.location.pathname === to;
  
  // Check if current route is login or register page
  const isAuthPage = () => {
    const currentPath = window.location.pathname;
    return currentPath === '/login' || currentPath === '/register';
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <SnackbarProvider>
        {!isAuthPage() && (
          <AppBar position="sticky" elevation={2}>
        <Toolbar>
            <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
              
              <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: 1, mr: 3 }} component={Link} to="/" color="inherit" style={{ textDecoration: 'none' }}>
            ProjectVault
          </Typography>
              <Box sx={{ display: { xs: 'none', sm: 'flex' }, gap: 1 }}>
                {navLinks.map(link =>
                  (!link.auth || user) && (
                    <Button
                      key={link.to}
                      color={isActive(link.to) ? 'secondary' : 'inherit'}
                      component={Link}
                      to={link.to}
                      startIcon={link.icon}
                      sx={{ fontWeight: 500, borderBottom: isActive(link.to) ? '2px solid #764ba2' : 'none', borderRadius: 2 }}
                      title={link.label}
                    >
                      {link.label}
                    </Button>
                  )
                )}
              </Box>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <IconButton color="inherit" onClick={handleNotifOpen} title="Notifications">
                <Badge badgeContent={unreadCount} color="error" max={99}>
                  <NotificationsIcon />
                </Badge>
              </IconButton>
              <Menu anchorEl={notifAnchor} open={Boolean(notifAnchor)} onClose={() => setNotifAnchor(null)}>
                {notifications.length === 0 ? (
                  <MenuItem disabled>
                    <Typography variant="body2" color="text.secondary">No notifications</Typography>
                  </MenuItem>
                ) : notifications.map((notif) => (
                  <MenuItem key={notif.id} sx={{ 
                    whiteSpace: 'normal', 
                    fontWeight: notif.read ? 400 : 600,
                    minWidth: 300,
                    maxWidth: 400,
                    p: 2
                  }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: notif.read ? 400 : 600, flexGrow: 1 }}>
                          {notif.title || 'Notification'}
                        </Typography>
                        {!notif.read && (
                          <Box sx={{ 
                            width: 8, 
                            height: 8, 
                            borderRadius: '50%', 
                            bgcolor: 'primary.main',
                            ml: 1 
                          }} />
                        )}
                      </Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        {notif.message || 'No message'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {notif.createdAt?.toLocaleString?.() || 'Just now'}
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Menu>
            
              <IconButton sx={{ ml: 1 }} onClick={() => setMode(mode === 'light' ? 'dark' : 'light')} color="inherit" title="Toggle dark mode">
                {mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
              </IconButton>
              {user ? (
                <>
                  <IconButton size="large" edge="end" color="inherit" onClick={handleMenuOpen} sx={{ ml: 2 }} title="Account">
                    <Avatar src={user.photoURL || undefined} alt={user.displayName || user.email} sx={{ width: 36, height: 36 }} />
              </IconButton>
              <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleMenuClose}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                    transformOrigin={{ vertical: 'top', horizontal: 'right' }}
              >
                    <MenuItem disabled>{user.displayName || user.email}</MenuItem>
                <MenuItem onClick={handleProfileClick}>Profile</MenuItem>
                    <MenuItem onClick={() => { handleMenuClose(); navigate('/notifications'); }}>
                      Notification Settings
                    </MenuItem>
                    
                <MenuItem onClick={handleLogout}>Logout</MenuItem>
              </Menu>
            </>
              ) : (
                <Button color="inherit" component={Link} to="/login" startIcon={<LoginIcon />} title="Login">Login</Button>
              )}
            </Box>
            <Box sx={{ display: { xs: 'flex', sm: 'none' } }}>
              <IconButton color="inherit" edge="start" onClick={handleDrawerToggle}>
                <MenuIcon />
              </IconButton>
            </Box>
          </Toolbar>
        </AppBar>
        )}
        {!isAuthPage() && (
          <Drawer anchor="left" open={drawerOpen} onClose={handleDrawerToggle}>
          <Box sx={{ width: 240 }} role="presentation" onClick={handleDrawerToggle}>
            <List>
              {navLinks.map(link =>
                (!link.auth || user) && (
                  <ListItem disablePadding key={link.to}>
                    <ListItemButton component={Link} to={link.to} selected={isActive(link.to)}>
                      <ListItemIcon>{link.icon}</ListItemIcon>
                      <ListItemText primary={link.label} />
                    </ListItemButton>
                  </ListItem>
                )
          )}
          {!user && (
                <ListItem disablePadding>
                  <ListItemButton component={Link} to="/login">
                    <ListItemIcon><LoginIcon /></ListItemIcon>
                    <ListItemText primary="Login" />
                  </ListItemButton>
                </ListItem>
              )}
            </List>
          </Box>
        </Drawer>
        )}

      <Container sx={{ mt: 4, mb: 4 }}>
        <Routes>
          {/* Public Routes */}
            <Route path="/" element={<Home />} />
            <Route path="/view-projects" element={<ViewProjects />} />
          <Route path="/projects/:projectId" element={<ProjectDetails />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected Routes */}
          <Route path="/profile" element={
            <RoleBasedRoute allowedRoles={['student', 'faculty', 'admin']}>
              <UserProfile />
            </RoleBasedRoute>
          } />

            <Route path="/profile/edit" element={<EditProfile />} />

            <Route path="/notifications" element={
              <RoleBasedRoute allowedRoles={['student', 'faculty', 'admin']}>
                <NotificationSettings />
            </RoleBasedRoute>
          } />

          <Route path="/submit" element={
            <RoleBasedRoute allowedRoles={['student', 'faculty', 'admin']}>
              <SubmitProject />
            </RoleBasedRoute>
          } />

          <Route path="/dashboard" element={
            !user ? <Navigate to="/login" /> : (
              role === 'admin' ? <Navigate to="/admin-dashboard" /> :
              role === 'faculty' ? <Navigate to="/faculty-dashboard" /> :
              role === 'student' ? <Navigate to="/student-dashboard" /> :
              <Typography>Unauthorized</Typography>
            )
          } />

          <Route path="/admin-dashboard" element={
            <RoleBasedRoute allowedRoles={['admin']}>
              <AdminDashboard />
            </RoleBasedRoute>
          } />

          <Route path="/faculty-dashboard" element={
            <RoleBasedRoute allowedRoles={['faculty']}>
              <FacultyDashboard />
            </RoleBasedRoute>
          } />

          <Route path="/student-dashboard" element={
            <RoleBasedRoute allowedRoles={['student']}>
              <StudentDashboard />
            </RoleBasedRoute>
          } />

          {/* Catch-all route */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Container>
      </SnackbarProvider>
    </ThemeProvider>
  );
}

export default App;