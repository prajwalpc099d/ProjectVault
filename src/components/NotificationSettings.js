import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Switch,
  FormControlLabel,
  Button,
  Alert,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CommentIcon from '@mui/icons-material/Comment';
import AdminIcon from '@mui/icons-material/AdminPanelSettings';
import CelebrationIcon from '@mui/icons-material/Celebration';
import AnnouncementIcon from '@mui/icons-material/Announcement';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import EditIcon from '@mui/icons-material/Edit';
import { doc, getDoc, updateDoc, collection, getDocs, deleteDoc, setDoc, query, where, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../firebase';

const NotificationSettings = () => {
  const [user] = useAuthState(auth);
  const [settings, setSettings] = useState({
    projectUpdates: true,
    feedback: true,
    roleChanges: true,
    systemAnnouncements: true,
    welcomeMessages: true
  });
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', severity: 'info' });

  useEffect(() => {
    const loadSettings = async () => {
      if (!user) return;
      
      try {
        const settingsRef = doc(db, 'users', user.uid, 'notificationSettings', 'default');
        const settingsSnap = await getDoc(settingsRef);
        
        if (settingsSnap.exists()) {
          setSettings(settingsSnap.data());
        } else {
          // Create default settings
          const defaultSettings = {
            emailNotifications: true,
            pushNotifications: true,
            projectUpdates: true,
            statusChanges: true,
            feedback: true,
            announcements: true
          };
          await setDoc(settingsRef, defaultSettings);
          setSettings(defaultSettings);
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    };

    const loadNotifications = async () => {
      if (!user) return;
      
      try {
        const notificationsRef = collection(db, 'notifications');
        const q = query(notificationsRef, where('recipientId', '==', user.uid), orderBy('createdAt', 'desc'));
        const notificationsSnap = await getDocs(q);
        
        const notificationsList = notificationsSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.() || new Date()
        }));
        
        setNotifications(notificationsList);
      } catch (error) {
        console.error('Error loading notifications:', error);
      }
    };

    if (user) {
      loadSettings();
      loadNotifications();
    }
  }, [user]);

  const loadSettings = async () => {
    try {
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const userData = userSnap.data();
        if (userData.notificationSettings) {
          setSettings(userData.notificationSettings);
        }
      }
    } catch (error) {
      console.error('Error loading notification settings:', error);
    }
  };

  const loadNotifications = async () => {
    try {
      const notifRef = collection(db, 'notifications');
      const notifSnap = await getDocs(notifRef);
      const notifs = notifSnap.docs
        .filter(doc => doc.data().recipientId === user.uid)
        .map(doc => ({ id: doc.id, ...doc.data() }));
      setNotifications(notifs);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSettingChange = (setting) => (event) => {
    setSettings(prev => ({
      ...prev,
      [setting]: event.target.checked
    }));
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        notificationSettings: settings
      });
      setMessage({ text: 'Notification settings saved successfully!', severity: 'success' });
    } catch (error) {
      console.error('Error saving notification settings:', error);
      setMessage({ text: 'Failed to save notification settings', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const clearAllNotifications = async () => {
    try {
      const notifRef = collection(db, 'users', user.uid, 'notifications');
      const notifSnap = await getDocs(notifRef);
      const deletePromises = notifSnap.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      setNotifications([]);
      setMessage({ text: 'All notifications cleared!', severity: 'success' });
    } catch (error) {
      console.error('Error clearing notifications:', error);
      setMessage({ text: 'Failed to clear notifications', severity: 'error' });
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'project_submitted':
        return <AddCircleIcon color="info" />;
      case 'project_approved':
        return <CheckCircleIcon color="success" />;
      case 'project_rejected':
        return <CancelIcon color="error" />;
      case 'feedback_received':
        return <CommentIcon color="primary" />;
      case 'project_updated':
        return <EditIcon color="warning" />;
      case 'project_deleted':
        return <DeleteIcon color="error" />;
      case 'role_changed':
        return <AdminIcon color="secondary" />;
      case 'welcome':
        return <CelebrationIcon color="success" />;
      case 'system_announcement':
        return <AnnouncementIcon color="info" />;
      default:
        return <NotificationsIcon />;
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f8faff 0%, #e8ecff 100%)',
      p: { xs: 2, sm: 3 }
    }}>
      <Box sx={{ maxWidth: 800, mx: 'auto', p: { xs: 2, sm: 3 } }}>
      <Typography variant="h4" gutterBottom sx={{ mb: 3 }}>
        Notification Settings
      </Typography>

      {message.text && (
        <Alert severity={message.severity} sx={{ mb: 3 }} onClose={() => setMessage({ text: '', severity: 'info' })}>
          {message.text}
        </Alert>
      )}

      <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Notification Preferences
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <FormControlLabel
            control={
              <Switch
                checked={settings.projectUpdates}
                onChange={handleSettingChange('projectUpdates')}
                color="primary"
              />
            }
            label="Project Updates (approvals, rejections, status changes)"
          />
          <FormControlLabel
            control={
              <Switch
                checked={settings.feedback}
                onChange={handleSettingChange('feedback')}
                color="primary"
              />
            }
            label="Feedback Notifications"
          />
          <FormControlLabel
            control={
              <Switch
                checked={settings.roleChanges}
                onChange={handleSettingChange('roleChanges')}
                color="primary"
              />
            }
            label="Role Change Notifications"
          />
          <FormControlLabel
            control={
              <Switch
                checked={settings.systemAnnouncements}
                onChange={handleSettingChange('systemAnnouncements')}
                color="primary"
              />
            }
            label="System Announcements"
          />
          <FormControlLabel
            control={
              <Switch
                checked={settings.welcomeMessages}
                onChange={handleSettingChange('welcomeMessages')}
                color="primary"
              />
            }
            label="Welcome Messages"
          />
        </Box>
        <Box sx={{ mt: 3 }}>
          <Button
            variant="contained"
            onClick={saveSettings}
            disabled={saving}
            startIcon={saving ? <CircularProgress size={20} /> : <NotificationsIcon />}
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </Box>
      </Paper>

      <Paper elevation={2} sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">
            Recent Notifications ({notifications.length})
          </Typography>
          {notifications.length > 0 && (
            <Button
              variant="outlined"
              color="error"
              size="small"
              onClick={clearAllNotifications}
              startIcon={<DeleteIcon />}
            >
              Clear All
            </Button>
          )}
        </Box>

        {notifications.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
            No notifications yet
          </Typography>
        ) : (
          <List>
            {notifications.slice(0, 10).map((notification) => (
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
                <ListItemIcon>
                  {getNotificationIcon(notification.type)}
                </ListItemIcon>
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
      </Paper>
      </Box>
    </Box>
  );
};

export default NotificationSettings; 