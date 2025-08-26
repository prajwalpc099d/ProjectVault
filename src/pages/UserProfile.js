import React, { useEffect, useState } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '../firebase';
import { doc, getDoc, collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { 
  Box, 
  Typography, 
  Avatar, 
  Button, 
  Paper, 
  Divider,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Alert,
  Chip,
  Badge
} from '@mui/material';
import { 
  Email as EmailIcon,
  Person as PersonIcon,
  CalendarToday as CalendarIcon,
  Work as WorkIcon,
  School as SchoolIcon,
  VerifiedUser as VerifiedUserIcon,
  Badge as BadgeIcon,
  Notifications as NotificationsIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const UserProfile = () => {
  const [user] = useAuthState(auth);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        if (user) {
          console.log('Fetching user data for:', user.uid);
          const userRef = doc(db, 'users', user.uid);
          const userSnap = await getDoc(userRef);
          
          if (userSnap.exists()) {
            const userDataFromFirestore = userSnap.data();
            console.log('User data found:', userDataFromFirestore);
            setUserData({
              ...userDataFromFirestore,
              // Add metadata from auth
              creationDate: new Date(user.metadata.creationTime),
              lastSignIn: new Date(user.metadata.lastSignInTime),
              emailVerified: user.emailVerified
            });
          } else {
            console.log('User document not found in Firestore');
            setError('User profile not found. Please contact support or try logging out and back in.');
            // Set minimal user data from auth
            setUserData({
              email: user.email,
              role: 'user',
              firstName: user.displayName?.split(' ')[0] || '',
              lastName: user.displayName?.split(' ').slice(1).join(' ') || '',
              creationDate: new Date(user.metadata.creationTime),
              lastSignIn: new Date(user.metadata.lastSignInTime),
              emailVerified: user.emailVerified
            });
          }

          // Fetch recent notifications
          try {
            const notifRef = collection(db, 'users', user.uid, 'notifications');
            const notifQuery = query(notifRef, orderBy('createdAt', 'desc'), limit(5));
            const notifSnap = await getDocs(notifQuery);
            const notifs = notifSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setNotifications(notifs);
            setUnreadCount(notifs.filter(n => !n.read).length);
          } catch (notifError) {
            console.error('Error fetching notifications:', notifError);
            // Don't fail the entire component for notification errors
            setNotifications([]);
            setUnreadCount(0);
          }
        }
      } catch (err) {
        console.error('Error fetching user data:', err);
        setError('Failed to load user data. Please try refreshing the page.');
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [user]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!user) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h6" gutterBottom>
          Please log in to view your profile
        </Typography>
        <Button 
          variant="contained" 
          onClick={() => navigate('/login')}
          sx={{ mt: 2 }}
        >
          Go to Login
        </Button>
      </Box>
    );
  }

  // If we have an error but also have userData, show the error as an alert but continue
  if (error && !userData) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button 
          variant="contained" 
          onClick={() => window.location.reload()}
        >
          Try Again
        </Button>
      </Box>
    );
  }

  // Format dates
  const formatDate = (date) => {
    return date?.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }) || 'N/A';
  };

  // Capitalize first letter
  const capitalize = (str) => {
    return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
  };

  // Get display name - prefers first name, falls back to displayName, then 'User'
  const getDisplayName = () => {
    if (userData?.firstName) return userData.firstName;
    if (user.displayName) return user.displayName;
    return 'User';
  };

  return (
    <Box sx={{ 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f8faff 0%, #e8ecff 100%)',
      p: { xs: 2, sm: 3 }
    }}>
      <Box sx={{ maxWidth: 800, mx: 'auto', my: 4, p: { xs: 2, sm: 0 } }}>
      {error && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      <Paper elevation={3} sx={{ p: { xs: 3, sm: 4 } }}>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 4 }}>
          {/* Left Column - Avatar and Basic Info */}
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center',
            minWidth: { xs: 'auto', md: 200 }
          }}>
            <Avatar
              src={user.photoURL || '/default-avatar.png'}
              sx={{ 
                width: { xs: 100, sm: 120 }, 
                height: { xs: 100, sm: 120 }, 
                mb: 2,
                fontSize: { xs: '2.5rem', sm: '3rem' }
              }}
            >
              {getDisplayName().charAt(0).toUpperCase()}
            </Avatar>
            
            <Typography variant="h5" align="center" sx={{ textAlign: 'center' }}>
              {getDisplayName()}
            </Typography>
            
            <Chip 
              label={capitalize(userData?.role || 'user')}
              color="primary"
              size="small"
              sx={{ mt: 1 }}
            />
            
            <Box sx={{ mt: 2, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Member since {formatDate(userData?.creationDate)}
              </Typography>
            </Box>
          </Box>

          {/* Right Column - Detailed Info */}
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
              Profile Details
            </Typography>
            
            <List>
              <ListItem>
                <ListItemIcon>
                  <EmailIcon />
                </ListItemIcon>
                <ListItemText 
                  primary="Email" 
                  secondary={
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      {user.email}
                      {userData?.emailVerified ? (
                        <Chip 
                          label="Verified" 
                          size="small" 
                          color="success"
                          icon={<VerifiedUserIcon fontSize="small" />}
                          sx={{ ml: 1 }}
                        />
                      ) : (
                        <Chip 
                          label="Not Verified" 
                          size="small" 
                          color="warning"
                          sx={{ ml: 1 }}
                        />
                      )}
                    </Box>
                  } 
                />
              </ListItem>
              {userData?.firstName && userData?.lastName && (
                <ListItem>
                  <ListItemIcon>
                    <PersonIcon />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Full Name" 
                    secondary={`${userData.firstName} ${userData.lastName}`} 
                  />
                </ListItem>
              )}
              {/* Student fields */}
              {userData?.role === 'student' && (
                <>
                  {userData.enrollment && (
                    <ListItem>
                      <ListItemIcon>
                        <BadgeIcon />
                      </ListItemIcon>
                      <ListItemText primary="Enrollment Number" secondary={userData.enrollment} />
                    </ListItem>
                  )}
                  {userData.course && (
                    <ListItem>
                      <ListItemIcon>
                        <SchoolIcon />
                      </ListItemIcon>
                      <ListItemText primary="Course" secondary={userData.course} />
                    </ListItem>
                  )}
                  {userData.year && (
                    <ListItem>
                      <ListItemIcon>
                        <CalendarIcon />
                      </ListItemIcon>
                      <ListItemText primary="Year/Semester" secondary={userData.year} />
                    </ListItem>
                  )}
                </>
              )}
              {/* Faculty fields */}
              {userData?.role === 'faculty' && (
                <>
                  {userData.department && (
                    <ListItem>
                      <ListItemIcon>
                        <SchoolIcon />
                      </ListItemIcon>
                      <ListItemText primary="Department" secondary={userData.department} />
                    </ListItem>
                  )}
                  {userData.position && (
                    <ListItem>
                      <ListItemIcon>
                        <WorkIcon />
                      </ListItemIcon>
                      <ListItemText primary="Position" secondary={userData.position} />
                    </ListItem>
                  )}
                  {userData.employeeId && (
                    <ListItem>
                      <ListItemIcon>
                        <BadgeIcon />
                      </ListItemIcon>
                      <ListItemText primary="Employee ID" secondary={userData.employeeId} />
                    </ListItem>
                  )}
                </>
              )}
              {/* Admin: no extra fields */}
              <ListItem>
                <ListItemIcon>
                  <CalendarIcon />
                </ListItemIcon>
                <ListItemText 
                  primary="Last Sign In" 
                  secondary={formatDate(userData?.lastSignIn)} 
                />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <CalendarIcon />
                </ListItemIcon>
                <ListItemText 
                  primary="Member Since" 
                  secondary={formatDate(userData?.creationDate)} 
                />
              </ListItem>
            </List>
          </Box>
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* Recent Notifications Section */}
        <Paper elevation={1} sx={{ p: 3, mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              Recent Notifications
            </Typography>
            <Badge badgeContent={unreadCount} color="primary">
              <NotificationsIcon />
            </Badge>
          </Box>
          
          {notifications.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
              No notifications yet
            </Typography>
          ) : (
            <List dense>
              {notifications.map((notification) => (
                <ListItem
                  key={notification.id}
                  sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    mb: 1,
                    backgroundColor: notification.read ? 'transparent' : 'action.hover'
                  }}
                >
                  <ListItemText
                    primary={notification.title || 'Notification'}
                    secondary={
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          {notification.message || 'No message'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {notification.createdAt?.toDate?.().toLocaleString?.() || 'Just now'}
                        </Typography>
                      </Box>
                    }
                  />
                  {!notification.read && (
                    <Box sx={{ 
                      width: 8, 
                      height: 8, 
                      borderRadius: '50%', 
                      bgcolor: 'primary.main' 
                    }} />
                  )}
                </ListItem>
              ))}
            </List>
          )}
          
          <Box sx={{ mt: 2 }}>
            <Button
              variant="outlined"
              size="small"
              onClick={() => navigate('/notifications')}
              startIcon={<NotificationsIcon />}
            >
              View All Notifications
            </Button>
          </Box>
        </Paper>

        <Divider sx={{ my: 3 }} />

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
          <Button 
            variant="outlined" 
            onClick={() => navigate('/')}
          >
            Back to Home
          </Button>
          <Button 
            variant="contained" 
            onClick={() => navigate('/dashboard')}
          >
            Go to Dashboard
          </Button>
          <Button 
            variant="contained" 
            color="secondary"
            onClick={() => navigate('/profile/edit')}
          >
            Edit Profile
          </Button>
        </Box>
      </Paper>
      </Box>
    </Box>
  );
};

export default UserProfile;